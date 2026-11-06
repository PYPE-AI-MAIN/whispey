/**
 * The ONLY code that reads the destination registry. Routes ask for a project's
 * data plane; the answer is Pype when no route is set, the customer destination
 * when one is, and an error when a route exists but cannot be used. There is no
 * fallback to Pype once a route exists.
 */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { CircuitBreaker, withBreaker } from './breaker'
import { DestinationIncompatible, DestinationUnavailable, RouteInMaintenance } from './errors'
import type { DataPlane } from './ports'
import { createPostgrestPlane } from './adapters/postgrest'
import type { ClientCert } from './adapters/mtlsFetch'
import { createPypePlane } from './adapters/pype'
import { checkRoutes, TOGETHER } from './routingPolicy'

export const REGISTRY_CACHE_MS = 15_000
/** The schema pack version this dashboard build speaks. */
export const SUPPORTED_SCHEMA_VERSION = 1

export interface RegistryDestination {
  id: string
  name: string
  kind: 'pype_supabase' | 'postgrest'
  config: Record<string, any>
  secret_ref: string | null
  schema_version: number
  status: string
}
export interface RegistryRoute {
  data_type: 'call_data' | 'recordings' | 'campaigns' | 'dnc' | 'qa'
  state: 'active' | 'paused'
  version: number
  effective_from: string | null
  destination: RegistryDestination | null
}

export type RegistryReader = (projectId: string) => Promise<RegistryRoute[]>
/** Turns a secret reference into the secret. Never logged, never returned by an API. */
export type SecretResolver = (ref: string) => Promise<string>

/**
 * PostgREST PGRST205 / Postgres 42P01: the registry tables are not installed yet.
 * No table means no route can exist anywhere, so every project is on Pype (today's
 * behaviour). Any other registry error still fails closed.
 */
export const isMissingRegistryTable = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|relation .* does not exist/i.test(e.message ?? ''))

let warnedMissingRegistry = false

export const readRegistry: RegistryReader = async (projectId) => {
  const { data, error } = await createServiceRoleClient()
    .from('data_destination_routes')
    .select('data_type, state, version, effective_from, destination:data_destinations(id, name, kind, config, secret_ref, schema_version, status)')
    .eq('project_id', projectId)
  if (error) {
    if (isMissingRegistryTable(error)) {
      if (!warnedMissingRegistry) {
        warnedMissingRegistry = true
        console.warn('[data-plane] registry tables are not installed; every project stays on Pype (apply migrations/data_plane_registry.sql)')
      }
      return []
    }
    throw new DestinationUnavailable(undefined, 'Data routing registry is unavailable')
  }
  return (data ?? []) as unknown as RegistryRoute[]
}

// `env:NAME` reads the server environment (PEM as base64 or with literal \n, since an env file is one line);
// any other reference is an AWS Secrets Manager id whose value is the PEM or JSON with `private_key`.
const fromEnv = (raw: string) => {
  const decoded = raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  return decoded.includes('BEGIN') ? decoded.replace(/\\n/g, '\n') : raw
}

const SECRET_CACHE_MS = 60_000 // short, so a rotated key is picked up within a minute
const cachedSecrets = new Map<string, { at: number; value: string }>()
let secretsClient: SecretsManagerClient | undefined

async function rawFromSecretsManager(ref: string): Promise<string | undefined> {
  const hit = cachedSecrets.get(ref)
  if (hit && Date.now() - hit.at < SECRET_CACHE_MS) return hit.value
  secretsClient ??= new SecretsManagerClient({ region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-2' })
  const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: ref }))
  if (res.SecretString) cachedSecrets.set(ref, { at: Date.now(), value: res.SecretString })
  return res.SecretString
}

async function fromSecretsManager(ref: string): Promise<string | undefined> {
  const value = await rawFromSecretsManager(ref)
  if (!value) return undefined
  try {
    return fromEnv((JSON.parse(value) as { private_key?: string }).private_key ?? value)
  } catch {
    return fromEnv(value) // not JSON: the value is the key itself
  }
}

/**
 * The TLS client certificate of an mTLS destination (config.mtls): `client_cert` and `client_key` (PEM or base64 PEM)
 * in the same Secrets Manager JSON as the signing key, or for `env:NAME` the variables NAME_CLIENT_CERT / NAME_CLIENT_KEY.
 * Missing parts are an error (never a plain connection).
 */
export const resolveClientCert = async (ref: string): Promise<ClientCert> => {
  let cert: string | undefined
  let key: string | undefined
  try {
    if (ref.startsWith('env:')) {
      const name = ref.slice(4)
      cert = process.env[`${name}_CLIENT_CERT`]
      key = process.env[`${name}_CLIENT_KEY`]
    } else {
      const raw = await rawFromSecretsManager(ref)
      const doc = JSON.parse(raw ?? '') as { client_cert?: string; client_key?: string }
      cert = doc.client_cert
      key = doc.client_key
    }
  } catch (e) {
    console.error('[data-plane] destination client certificate lookup failed', ref, e instanceof Error ? e.name : 'error') // name only, never a value
  }
  if (!cert || !key) throw new DestinationUnavailable(undefined, 'Destination client certificate could not be resolved')
  return { cert: fromEnv(cert), key: fromEnv(key) }
}

export const resolveSecret: SecretResolver = async (ref) => {
  let value: string | undefined
  try {
    value = ref.startsWith('env:') ? (process.env[ref.slice(4)] ? fromEnv(process.env[ref.slice(4)] as string) : undefined) : await fromSecretsManager(ref)
  } catch (e) {
    console.error('[data-plane] destination secret lookup failed', ref, e instanceof Error ? e.name : 'error') // name only, never a value
    value = undefined
  }
  if (!value) throw new DestinationUnavailable(undefined, 'Destination secret could not be resolved')
  return value
}

interface Deps {
  registry?: RegistryReader
  secrets?: SecretResolver
  clientCert?: (ref: string) => Promise<ClientCert>
  now?: () => number
  pypePlane?: () => DataPlane
  postgrestPlane?: typeof createPostgrestPlane
}

export class DataPlaneResolver {
  private readonly cache = new Map<string, { at: number; plane: DataPlane }>()
  private readonly routeCache = new Map<string, { at: number; routes: RegistryRoute[] }>()
  private readonly breakers = new Map<string, CircuitBreaker>()
  private readonly d: Required<Deps>

  constructor(deps: Deps = {}) {
    this.d = {
      registry: deps.registry ?? readRegistry,
      secrets: deps.secrets ?? resolveSecret,
      clientCert: deps.clientCert ?? resolveClientCert,
      now: deps.now ?? Date.now,
      pypePlane: deps.pypePlane ?? createPypePlane,
      postgrestPlane: deps.postgrestPlane ?? createPostgrestPlane,
    }
  }

  async forProject(projectId: string): Promise<DataPlane> {
    const hit = this.cache.get(projectId)
    if (hit && this.d.now() - hit.at < REGISTRY_CACHE_MS) return hit.plane
    const plane = await this.build(projectId)
    this.cache.set(projectId, { at: this.d.now(), plane })
    return plane
  }

  /** Pype's own plane, for data that always stays in Pype (global DNC entries). No registry read. */
  pype(): DataPlane {
    return this.d.pypePlane()
  }

  /** True when any of the project's routes points at a customer destination (not Pype). */
  async isCustomerHeld(projectId: string): Promise<boolean> {
    return (await this.routesFor(projectId)).some((r) => r.destination?.kind !== 'pype_supabase')
  }

  /** Read-only, for the campaign pages' data-location note: where contacts live. */
  async campaignLocation(projectId: string): Promise<'pype' | 'customer'> {
    const route = (await this.routesFor(projectId)).find((x) => x.data_type === 'campaigns')
    return route?.destination && route.destination.kind !== 'pype_supabase' ? 'customer' : 'pype'
  }

  /** The routes in effect for the project; a route with a future effective_from has not switched yet. */
  private async routesFor(projectId: string): Promise<RegistryRoute[]> {
    const hit = this.routeCache.get(projectId)
    if (hit && this.d.now() - hit.at < REGISTRY_CACHE_MS) return hit.routes
    const routes = (await this.d.registry(projectId)).filter(
      (r) => !r.effective_from || Date.parse(r.effective_from) <= this.d.now()
    )
    this.routeCache.set(projectId, { at: this.d.now(), routes })
    return routes
  }

  private async build(projectId: string): Promise<DataPlane> {
    const routes = await this.routesFor(projectId)
    if (routes.length === 0) return this.d.pypePlane()

    const byType = new Map(routes.map((r) => [r.data_type, r]))
    const paused = routes.find((r) => r.state === 'paused')
    if (paused) throw new RouteInMaintenance(projectId, paused.data_type)

    const violation = checkRoutes(routes)
    if (violation) throw new DestinationIncompatible(undefined, violation)
    const together = TOGETHER.map((t) => byType.get(t))

    const callPlane = together[0]?.destination ? await this.planeFor(together[0].destination) : this.d.pypePlane()
    const recordings = byType.get('recordings')?.destination
    const storage = recordings ? (await this.planeFor(recordings)).storage : callPlane.storage
    return { ...callPlane, storage }
  }

  private async planeFor(dest: RegistryDestination): Promise<DataPlane> {
    if (dest.kind === 'pype_supabase') return this.d.pypePlane()
    if (dest.status !== 'healthy') throw new DestinationUnavailable(dest.name, `Destination is ${dest.status}`)
    if (dest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      throw new DestinationIncompatible(dest.name, `Destination schema version ${dest.schema_version} is not supported`)
    }
    if (!dest.secret_ref) throw new DestinationIncompatible(dest.name, 'Destination has no secret reference')
    const key = await this.d.secrets(dest.secret_ref)
    const breaker = this.breakers.get(dest.id) ?? new CircuitBreaker(dest.name, this.d.now)
    this.breakers.set(dest.id, breaker)
    const clientCert = dest.config.mtls === true ? await this.d.clientCert(dest.secret_ref) : undefined
    return withBreaker(this.d.postgrestPlane({ id: dest.id, name: dest.name, config: dest.config }, key, clientCert), breaker)
  }
}

export type PlaneSource = Pick<DataPlaneResolver, 'forProject' | 'isCustomerHeld' | 'pype' | 'campaignLocation'>

export const campaignDataLocation = (projectId: string) => getDataPlaneResolver().campaignLocation(projectId)

let shared: PlaneSource | null = null
export const getDataPlaneResolver = (): PlaneSource => (shared ??= new DataPlaneResolver())
/**
 * Tests swap in a resolver backed by fake planes; pass null to restore. Only
 * forProject is required: a project is Pype-held unless the test says otherwise.
 */
export const setDataPlaneResolverForTests = (
  r: (Pick<PlaneSource, 'forProject'> & Partial<PlaneSource>) | null
) => {
  shared = r && {
    isCustomerHeld: async () => false,
    campaignLocation: async () => 'pype' as const,
    pype: () => { throw new Error('no Pype plane in this test') },
    ...r,
  }
}
