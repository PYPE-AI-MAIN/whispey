/**
 * Large customer-held projects aggregate inside the customer's database: the same Spec goes to
 * `api.analytics_run(p_spec, p_ctx)` (PostgREST RPC) and comes back as the rows buildQuery's SQL returns.
 * Off unless CUSTOMER_ANALYTICS_RPC=1 (or the caller forces it); when the function is not installed
 * (PGRST202) the caller falls back to evaluating rows in memory on the same customer plane, never to Pype.
 */
import type { Spec } from './spec'
import { metaFor, type CustomerRun } from './customerQuery'
import type { Ctx } from './buildQuery'
import type { DataPlane } from '@/server/data-plane'

export const rpcEnabled = (): boolean => process.env.CUSTOMER_ANALYTICS_RPC === '1'

/** `timestamp` text from the function ('2026-11-06 00:00:00' or ISO) -> the ISO-with-Z form the in-memory path and Pype's driver produce. */
const bucketIso = (v: unknown): string => {
  const s = String(v)
  return /[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? new Date(s).toISOString() : `${s.replace(' ', 'T').slice(0, 19)}.000Z`
}

export async function runViaRpc(plane: DataPlane, spec: Spec, ctx: Ctx): Promise<CustomerRun | null> {
  let rows: Record<string, unknown>[]
  try {
    rows = await plane.callData.analyticsRun(spec as unknown as Record<string, unknown>, {
      project_id: ctx.projectId,
      agent_ids: ctx.agentIds,
      tz: ctx.tz,
      denied_fields: [...ctx.deniedFields], // the function enforces the same field permissions as the SQL path
      max_days: ctx.maxDays,
      ...(ctx.now ? { now: ctx.now.toISOString() } : {}),
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'PGRST202') return null // not installed on this destination
    throw e
  }
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    rows: rows.map((r) => ({
      ...(r.bucket === undefined || r.bucket === null ? {} : { bucket: bucketIso(r.bucket) }),
      ...(r.series === undefined ? {} : { series: r.series }),
      value: num(r.value),
      n_rows: Number(r.n_rows ?? 0),
      n_nonnull: Number(r.n_nonnull ?? 0),
    })),
    meta: metaFor(spec, ctx),
  }
}
