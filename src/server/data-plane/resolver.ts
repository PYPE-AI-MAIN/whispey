/**
 * The ONLY code that reads the destination registry. Routes ask for a project's
 * data plane; the answer is Pype when no route is set, the customer destination
 * when one is, and an error when a route exists but cannot be used. There is no
 * fallback to Pype once a route exists.
 */
import { createServiceRoleClient } from '@/lib/supabase-server'
import { CircuitBreaker, withBreaker } from './breaker'
import { DestinationIncompatible, DestinationUnavailable, RouteInMaintenance } from './errors'
import type { DataPlane } from './ports'
import { createPostgrestPlane } from './adapters/postgrest'
import { createPypePlane } from './adapters/pype'

export const REGISTRY_CACHE_MS = 15_000
/** The schema pack version this dashboard build speaks. */
export const SUPPORTED_SCHEMA_VERSION = 1

/** Call data, QA tickets and DNC reference each other, so they live in one destination. */
const TOGETHER = ['call_data', 'qa', 'dnc'] as const

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

const readRegistry: RegistryReader = async (projectId) => {
  const { data, error } = await createServiceRoleClient()
    .from('data_destination_routes')
    .select('data_type, state, version, effective_from, destination:data_destinations(id, name, kind, config, secret_ref, schema_version, status)')
    .eq('project_id', projectId)
  if (error) throw new DestinationUnavailable(undefined, 'Data routing registry is unavailable')
  return (data ?? []) as unknown as RegistryRoute[]
}

// ponytail: only env:NAME references resolve here. ARN references need the AWS
// Secrets Manager client (a new dependency, needs a human yes); inject one via deps.secrets.
const envSecret: SecretResolver = async (ref) => {
  const value = ref.startsWith('env:') ? process.env[ref.slice(4)] : undefined
  if (!value) throw new DestinationUnavailable(undefined, 'Destination secret could not be resolved')
  return value
}

interface Deps {
  registry?: RegistryReader
  secrets?: SecretResolver
  now?: () => number
  pypePlane?: () => DataPlane
  postgrestPlane?: typeof createPostgrestPlane
}

export class DataPlaneResolver {
  private readonly cache = new Map<string, { at: number; plane: DataPlane }>()
  private readonly breakers = new Map<string, CircuitBreaker>()
  private readonly d: Required<Deps>

  constructor(deps: Deps = {}) {
    this.d = {
      registry: deps.registry ?? readRegistry,
      secrets: deps.secrets ?? envSecret,
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

  private async build(projectId: string): Promise<DataPlane> {
    // A route with a future effective_from has not switched yet.
    const routes = (await this.d.registry(projectId)).filter(
      (r) => !r.effective_from || Date.parse(r.effective_from) <= this.d.now()
    )
    if (routes.length === 0) return this.d.pypePlane()

    const byType = new Map(routes.map((r) => [r.data_type, r]))
    const paused = routes.find((r) => r.state === 'paused')
    if (paused) throw new RouteInMaintenance(projectId, paused.data_type)

    const campaigns = byType.get('campaigns')
    if (campaigns && campaigns.destination?.kind !== 'pype_supabase') {
      throw new DestinationIncompatible(campaigns.destination?.name, 'Campaigns can only use Pype for now')
    }

    const together = TOGETHER.map((t) => byType.get(t))
    if (together.some(Boolean)) {
      const ids = new Set(together.map((r) => r?.destination?.id))
      if (together.some((r) => !r?.destination) || ids.size !== 1) {
        throw new DestinationIncompatible(undefined, 'Call data, QA and DNC must share one destination')
      }
    }

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
    let breaker = this.breakers.get(dest.id)
    if (!breaker) this.breakers.set(dest.id, (breaker = new CircuitBreaker(dest.name, this.d.now)))
    return withBreaker(this.d.postgrestPlane({ id: dest.id, name: dest.name, config: dest.config }, key), breaker)
  }
}

let shared: Pick<DataPlaneResolver, 'forProject'> | null = null
export const getDataPlaneResolver = () => (shared ??= new DataPlaneResolver())
/** Tests swap in a resolver backed by fake planes; pass null to restore. */
export const setDataPlaneResolverForTests = (r: Pick<DataPlaneResolver, 'forProject'> | null) => { shared = r }
