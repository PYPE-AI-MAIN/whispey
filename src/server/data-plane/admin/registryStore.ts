/**
 * Admin-side access to the registry tables (the panel's own store; requests are
 * served by the resolver). secret_ref never leaves this module: callers get
 * `has_secret`, and only `getDestinationForVerify` returns the reference, for the
 * server-side verify step.
 */
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { DataType, DestinationInput, DestinationKind } from '../routingPolicy'

export interface DestinationView {
  id: string
  name: string
  kind: DestinationKind
  config: Record<string, unknown>
  has_secret: boolean
  schema_version: number
  status: string
  last_health_at: string | null
  last_health_detail: unknown
  created_by: string | null
  created_at: string
  route_count: number
}
export interface RouteRow {
  project_id: string
  data_type: DataType
  destination_id: string
  state: 'active' | 'paused'
  version: number
  effective_from: string | null
  destination?: { id: string; name: string; kind: DestinationKind } | null
}
export interface AuditEntry {
  action: string
  actor_email: string
  project_id?: string | null
  data_type?: string | null
  before?: unknown
  after?: unknown
  dry_run?: boolean
}
export interface AuditFilter { projectId?: string; actor?: string; action?: string; from?: string; to?: string; limit?: number }

export interface RegistryStore {
  listDestinations(): Promise<DestinationView[]>
  createDestination(input: DestinationInput, actor: string): Promise<DestinationView>
  updateDestination(id: string, patch: Partial<DestinationInput>): Promise<DestinationView | null>
  deleteDestination(id: string): Promise<void>
  getDestinationForVerify(id: string): Promise<{ id: string; name: string; kind: DestinationKind; config: Record<string, any>; secret_ref: string | null } | null>
  recordHealth(id: string, status: string, detail: unknown): Promise<void>
  routeCountFor(destinationId: string): Promise<number>
  listRoutes(projectId: string): Promise<RouteRow[]>
  /** Routes whose destination is a customer one (the kill switch's scope). */
  listCustomerRoutes(): Promise<RouteRow[]>
  upsertRoute(row: Omit<RouteRow, 'destination'>): Promise<void>
  setRouteState(projectId: string, dataType: DataType, state: 'active' | 'paused'): Promise<void>
  deleteRoute(projectId: string, dataType: DataType): Promise<void>
  addAudit(entry: AuditEntry): Promise<void>
  listAudit(filter: AuditFilter): Promise<Record<string, unknown>[]>
  /** When this project's call data first moved off Pype, if it has. */
  callDataSince(projectId: string): Promise<string | null>
}

const DEST_COLS = 'id, name, kind, config, secret_ref, schema_version, status, last_health_at, last_health_detail, created_by, created_at'

function view(row: any, routeCount = 0): DestinationView {
  const { secret_ref, ...rest } = row
  return { ...rest, has_secret: !!secret_ref, route_count: routeCount }
}
const must = <T>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export function createSupabaseRegistryStore(): RegistryStore {
  const db = () => createServiceRoleClient()
  return {
    async listDestinations() {
      const dests = must(await db().from('data_destinations').select(DEST_COLS).order('name')) as any[]
      const routes = must(await db().from('data_destination_routes').select('destination_id')) as any[]
      const counts = new Map<string, number>()
      for (const r of routes) counts.set(r.destination_id, (counts.get(r.destination_id) ?? 0) + 1)
      return dests.map((d) => view(d, counts.get(d.id) ?? 0))
    },
    async createDestination(input, actor) {
      return view(must(await db().from('data_destinations').insert({ ...input, created_by: actor }).select(DEST_COLS).single()))
    },
    async updateDestination(id, patch) {
      const row = must(await db().from('data_destinations').update(patch).eq('id', id).select(DEST_COLS).maybeSingle())
      return row ? view(row) : null
    },
    async deleteDestination(id) {
      must(await db().from('data_destinations').delete().eq('id', id))
    },
    async getDestinationForVerify(id) {
      return must(await db().from('data_destinations').select('id, name, kind, config, secret_ref').eq('id', id).maybeSingle()) as any
    },
    async recordHealth(id, status, detail) {
      must(await db().from('data_destinations').update({ status, last_health_at: new Date().toISOString(), last_health_detail: detail }).eq('id', id))
    },
    async routeCountFor(destinationId) {
      const res = await db().from('data_destination_routes').select('*', { count: 'exact', head: true }).eq('destination_id', destinationId)
      if (res.error) throw new Error(res.error.message)
      return res.count ?? 0
    },
    async listRoutes(projectId) {
      return must(await db().from('data_destination_routes')
        .select('project_id, data_type, destination_id, state, version, effective_from, destination:data_destinations(id, name, kind)')
        .eq('project_id', projectId)) as any
    },
    async listCustomerRoutes() {
      return must(await db().from('data_destination_routes')
        .select('project_id, data_type, destination_id, state, version, effective_from, destination:data_destinations!inner(id, name, kind)')
        .eq('destination.kind', 'postgrest')) as any
    },
    async upsertRoute(row) {
      must(await db().from('data_destination_routes').upsert(row, { onConflict: 'project_id,data_type' }))
    },
    async setRouteState(projectId, dataType, state) {
      must(await db().from('data_destination_routes').update({ state }).eq('project_id', projectId).eq('data_type', dataType))
    },
    async deleteRoute(projectId, dataType) {
      must(await db().from('data_destination_routes').delete().eq('project_id', projectId).eq('data_type', dataType))
    },
    async addAudit(entry) {
      must(await db().from('data_destination_audit').insert({ dry_run: false, ...entry }))
    },
    async listAudit(f) {
      let q = db().from('data_destination_audit').select('*').order('at', { ascending: false }).limit(Math.min(f.limit ?? 100, 500))
      if (f.projectId) q = q.eq('project_id', f.projectId)
      if (f.actor) q = q.eq('actor_email', f.actor)
      if (f.action) q = q.eq('action', f.action)
      if (f.from) q = q.gte('at', f.from)
      if (f.to) q = q.lte('at', f.to)
      return (must(await q) ?? []) as Record<string, unknown>[]
    },
    async callDataSince(projectId) {
      const row = must(await db().from('data_destination_routes').select('effective_from').eq('project_id', projectId).eq('data_type', 'call_data').maybeSingle()) as any
      return row?.effective_from ?? null
    },
  }
}

let store: RegistryStore | null = null
export const getRegistryStore = () => (store ??= createSupabaseRegistryStore())
export const setRegistryStoreForTests = (s: RegistryStore | null) => { store = s }
