/**
 * Changing where a project's data goes, safely: pause the current routes, wait
 * out the registry caches, make sure no call is in flight, bump the version,
 * switch, resume. A failed or timed-out step puts the old routes back.
 * `dryRun` writes nothing but the audit entry (marked dry_run) and reports the plan.
 */
import { checkRoutes, type DataType, type PolicyRoute } from '../routingPolicy'
import { REGISTRY_CACHE_MS } from '../resolver'
import type { RegistryStore, RouteRow } from './registryStore'

export interface DesiredRoute { data_type: DataType; destination_id: string | null }

export interface RouteChangeOptions {
  projectId: string
  desired: DesiredRoute[]
  actor: string
  dryRun: boolean
  /** Apply even if calls are still active when the drain times out. */
  force?: boolean
  store: RegistryStore
  /** Calls in flight for this project; read through the plane the project had before the change. */
  activeCalls: () => Promise<number>
  sleep?: (ms: number) => Promise<void>
  drainTimeoutMs?: number
  drainPollMs?: number
}

export type RouteChangeResult =
  | { ok: true; dryRun: boolean; plan: string[]; activeCalls: number; routes: { data_type: DataType; destination_id: string | null; version: number }[] }
  | { ok: false; status: 400 | 409; error: string; activeCalls?: number }

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function finalRoutes(o: RouteChangeOptions, current: RouteRow[]) {
  const dests = new Map((await o.store.listDestinations()).map((d) => [d.id, d]))
  const merged = new Map<DataType, string | null>(current.map((r) => [r.data_type, r.destination_id]))
  for (const d of o.desired) merged.set(d.data_type, d.destination_id)
  const policy: PolicyRoute[] = []
  for (const [data_type, id] of merged) {
    if (id === null) continue
    const d = dests.get(id)
    if (!d) return { error: `Destination ${id} does not exist` as const }
    policy.push({ data_type, destination: { id: d.id, name: d.name, kind: d.kind } })
  }
  return { policy, error: checkRoutes(policy) }
}

async function drain(o: RouteChangeOptions): Promise<number> {
  const sleep = o.sleep ?? realSleep
  const deadline = Date.now() + (o.drainTimeoutMs ?? 120_000)
  let n = await o.activeCalls()
  while (n > 0 && Date.now() < deadline) {
    await sleep(o.drainPollMs ?? 5_000)
    n = await o.activeCalls()
  }
  return n
}

export async function changeProjectRoutes(o: RouteChangeOptions): Promise<RouteChangeResult> {
  const current = await o.store.listRoutes(o.projectId)
  const final = await finalRoutes(o, current)
  if (final.error) return { ok: false, status: 400, error: final.error }

  const active = await o.activeCalls()
  const plan = [
    ...(current.length ? ['pause current routes', `wait ${Math.round(REGISTRY_CACHE_MS / 1000)}s for caches`] : []),
    `drain: ${active} active call${active === 1 ? '' : 's'}`,
    'bump version and switch',
    'resume',
  ]
  const nextVersion = (t: DataType) => (current.find((r) => r.data_type === t)?.version ?? 0) + 1
  const routes = o.desired.map((d) => ({ data_type: d.data_type, destination_id: d.destination_id, version: nextVersion(d.data_type) }))
  const audit = (action: string, extra: Partial<{ data_type: string; before: unknown; after: unknown }> = {}) =>
    o.store.addAudit({ action, actor_email: o.actor, project_id: o.projectId, dry_run: o.dryRun, ...extra })

  if (o.dryRun) {
    await audit('route_change', { before: current.map(({ destination, ...r }) => r), after: routes })
    return { ok: true, dryRun: true, plan, activeCalls: active, routes }
  }

  const sleep = o.sleep ?? realSleep
  const restore = async () => {
    for (const r of current) await o.store.setRouteState(o.projectId, r.data_type, r.state)
  }

  if (current.length) {
    for (const r of current) await o.store.setRouteState(o.projectId, r.data_type, 'paused')
    await audit('pause', { before: current.map((r) => r.data_type) })
    await sleep(REGISTRY_CACHE_MS + 1000)
  }
  try {
    const left = await drain(o)
    if (left > 0 && !o.force) {
      await restore()
      await audit('route_change_aborted', { after: { activeCalls: left } })
      return { ok: false, status: 409, error: `${left} call${left === 1 ? ' is' : 's are'} still active; try again later or force`, activeCalls: left }
    }
    const effective_from = new Date().toISOString()
    for (const d of o.desired) {
      if (d.destination_id === null) await o.store.deleteRoute(o.projectId, d.data_type)
      else await o.store.upsertRoute({ project_id: o.projectId, data_type: d.data_type, destination_id: d.destination_id, state: 'paused', version: nextVersion(d.data_type), effective_from })
    }
    for (const d of o.desired) if (d.destination_id !== null) await o.store.setRouteState(o.projectId, d.data_type, 'active')
    // Routes the change did not touch were paused above and are active again.
    for (const r of current) if (!o.desired.some((d) => d.data_type === r.data_type)) await o.store.setRouteState(o.projectId, r.data_type, r.state)
    await audit('route_change', { before: current.map(({ destination, ...r }) => r), after: routes })
    return { ok: true, dryRun: false, plan, activeCalls: left, routes }
  } catch (e) {
    await restore().catch(() => undefined)
    await audit('route_change_failed').catch(() => undefined)
    throw e
  }
}
