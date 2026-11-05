import type { AuditEntry, DestinationView, RegistryStore, RouteRow } from '../admin/registryStore'

/** In-memory registry for admin route tests. */
export interface FakeRegistry extends RegistryStore {
  destinations: (DestinationView & { secret_ref: string | null })[]
  routes: RouteRow[]
  audit: (AuditEntry & { at: string })[]
}

export function createFakeRegistry(): FakeRegistry {
  let n = 0
  const r: FakeRegistry = {
    destinations: [],
    routes: [],
    audit: [],
    async listDestinations() {
      return r.destinations.map(({ secret_ref, ...d }) => ({ ...d, has_secret: !!secret_ref, route_count: r.routes.filter((x) => x.destination_id === d.id).length }))
    },
    async createDestination(input, actor) {
      const d = { id: `d${++n}`, ...input, has_secret: !!input.secret_ref, schema_version: 1, status: 'unverified', last_health_at: null, last_health_detail: null, created_by: actor, created_at: 'now', route_count: 0 }
      r.destinations.push(d as any)
      const { secret_ref, ...pub } = d as any
      return pub
    },
    async updateDestination(id, patch) {
      const d = r.destinations.find((x) => x.id === id)
      if (!d) return null
      Object.assign(d, patch)
      const { secret_ref, ...pub } = d
      return { ...pub, has_secret: !!secret_ref }
    },
    async deleteDestination(id) { r.destinations = r.destinations.filter((x) => x.id !== id) },
    async getDestinationForVerify(id) { return r.destinations.find((x) => x.id === id) as any ?? null },
    async recordHealth(id, status, detail) {
      const d = r.destinations.find((x) => x.id === id)
      if (d) Object.assign(d, { status, last_health_detail: detail })
    },
    async routeCountFor(id) { return r.routes.filter((x) => x.destination_id === id).length },
    async listRoutes(projectId) {
      return r.routes.filter((x) => x.project_id === projectId).map((x) => ({ ...x, destination: dest(x.destination_id) }))
    },
    async listCustomerRoutes() {
      return r.routes.map((x) => ({ ...x, destination: dest(x.destination_id) })).filter((x) => x.destination?.kind === 'postgrest')
    },
    async upsertRoute(row) {
      r.routes = r.routes.filter((x) => !(x.project_id === row.project_id && x.data_type === row.data_type)).concat(row)
    },
    async setRouteState(p, t, state) { r.routes.filter((x) => x.project_id === p && x.data_type === t).forEach((x) => (x.state = state)) },
    async deleteRoute(p, t) { r.routes = r.routes.filter((x) => !(x.project_id === p && x.data_type === t)) },
    async addAudit(e) { r.audit.push({ at: new Date(r.audit.length).toISOString(), ...e }) },
    async listAudit(f) { return r.audit.filter((a) => (!f.projectId || a.project_id === f.projectId) && (!f.action || a.action === f.action)).reverse() as any },
    async callDataSince(p) { return r.routes.find((x) => x.project_id === p && x.data_type === 'call_data')?.effective_from ?? null },
  }
  const dest = (id: string) => {
    const d = r.destinations.find((x) => x.id === id)
    return d ? { id: d.id, name: d.name, kind: d.kind } : null
  }
  return r
}
