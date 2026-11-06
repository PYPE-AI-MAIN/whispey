/**
 * The routing rules, in one place. The resolver enforces them on every request
 * and the admin panel enforces them when a route is saved, so a bad combination
 * can neither be stored nor served.
 */
export const DATA_TYPES = ['call_data', 'recordings', 'campaigns', 'dnc', 'qa'] as const
export type DataType = (typeof DATA_TYPES)[number]
export const DESTINATION_KINDS = ['pype_supabase', 'postgrest'] as const
export type DestinationKind = (typeof DESTINATION_KINDS)[number]

/** Call data, QA tickets and DNC reference each other, so they live in one destination. */
export const TOGETHER: readonly DataType[] = ['call_data', 'qa', 'dnc']

export interface PolicyRoute {
  data_type: DataType
  destination: { id: string; name?: string; kind: DestinationKind } | null
}

/** null = the route set is allowed. */
export function checkRoutes(routes: PolicyRoute[]): string | null {
  const byType = new Map(routes.map((r) => [r.data_type, r]))
  const campaigns = byType.get('campaigns')
  if (campaigns && campaigns.destination?.kind !== 'pype_supabase') return 'Campaigns can only use Pype for now'

  const together = TOGETHER.map((t) => byType.get(t))
  if (together.some(Boolean)) {
    const ids = new Set(together.map((r) => r?.destination?.id))
    if (together.some((r) => !r?.destination) || ids.size !== 1) return 'Call data, QA and DNC must share one destination'
  }
  return null
}

/** A destination that any project routes to cannot be deleted or detached. */
export function checkDetach(routeCount: number): string | null {
  return routeCount > 0 ? `Destination is used by ${routeCount} route${routeCount === 1 ? '' : 's'}; remove them first` : null
}

export const SECRET_REF = /^(env:[A-Z0-9_]+|arn:aws[a-z-]*:secretsmanager:[a-z0-9-]+:\d{12}:secret:[\w/+=.@-]+)$/

export interface DestinationInput {
  name: string
  kind: DestinationKind
  config: Record<string, unknown>
  secret_ref: string | null
}

/** Validates an attach/edit body. Secrets are references only; a value is refused. */
export function parseDestinationInput(body: Record<string, unknown>, partial = false): { value: Partial<DestinationInput> } | { error: string } {
  const out: Partial<DestinationInput> = {}
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(body.name)) return { error: 'name must be 2-63 chars: lowercase letters, digits, dashes' }
    out.name = body.name
  }
  if (!partial || body.kind !== undefined) {
    if (!DESTINATION_KINDS.includes(body.kind as DestinationKind)) return { error: 'kind must be pype_supabase or postgrest' }
    out.kind = body.kind as DestinationKind
  }
  if (body.config !== undefined) {
    if (typeof body.config !== 'object' || body.config === null || Array.isArray(body.config)) return { error: 'config must be an object' }
    if (Object.keys(body.config).some((k) => /secret|key|token|password/i.test(k))) return { error: 'config is non-secret; put secrets behind secret_ref' }
    const cfg = body.config as Record<string, unknown>
    if (cfg.mtls !== undefined && typeof cfg.mtls !== 'boolean') return { error: 'config.mtls must be true or false' }
    if (cfg.ingress !== undefined && (typeof cfg.ingress !== 'string' || cfg.ingress.length > 500)) return { error: 'config.ingress must be text (500 chars max)' }
    out.config = cfg
  } else if (!partial) out.config = {}
  if (body.secret_ref !== undefined && body.secret_ref !== null) {
    if (typeof body.secret_ref !== 'string' || !SECRET_REF.test(body.secret_ref)) return { error: 'secret_ref must be an AWS Secrets Manager ARN (or env:NAME)' }
    out.secret_ref = body.secret_ref
  } else if (!partial) out.secret_ref = null
  return { value: out }
}
