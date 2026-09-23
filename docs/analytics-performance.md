# Analytics performance — standards

Rules learned from making prod queries fast, so the next chart/agent/index
doesn't re-discover them. Read before adding a widget type, a new base
column, or touching `buildQuery.ts` / `db.ts`.

## 1. Region: the function must run where the database is

The pooler is `aws-1-ap-south-1` (Mumbai). Every analytics route declares:

```ts
export const runtime = 'nodejs'
export const preferredRegion = 'bom1'
```

`runQuery()` opens a transaction and sends BEGIN, `SET LOCAL` ×2, the query,
and COMMIT — five statements per chart, minimum. If the function runs in a
different region than the pooler, every one of those five pays a
cross-region round trip. That cost is invisible in local testing (you're
always "far" from prod) and invisible in `EXPLAIN ANALYZE` (it only measures
time inside Postgres) — it only shows up as "slower than a tool that queries
from the right region," e.g. Metabase, Supabase's own SQL editor, or a script
run from a nearby box.

**Caveat:** `preferredRegion` may be a no-op on some Vercel plans. Confirm in
the Vercel dashboard → the route's function logs, which print the executing
region.

## 2. Every dashboard column needs to be in an index, not just filterable

A query that isn't fully covered by an index has to fetch the row —
and `pype_voice_call_logs` rows are wide (transcript, three JSON columns),
so one heap fetch is expensive, and 15–45k of them is seconds, especially
cold. `idx_call_logs_dash_cover` covers `(agent_id, call_started_at)
INCLUDE (customer_number, call_ended_reason, wcall_event, environment,
duration_seconds, billing_duration_seconds, avg_latency, call_id,
created_at)` — the columns every built-in KPI reads.

Before adding a new built-in column to `BUILTIN_COLUMNS` (catalog.ts) or a
new base filter to `buildQuery.ts`, check whether it's already in that
INCLUDE list. If not: `EXPLAIN (ANALYZE, BUFFERS)` first, add the column to
the index only if `Heap Fetches` or `Buffers: … read=` is high, then
`VACUUM (ANALYZE)` afterward — an index-only scan needs the visibility map
current or it silently falls back to the heap anyway.

A JSON path (`transcription_metrics->>'final_disposition'`, etc.) needs its
own expression index — the covering index above can't help it. Only add one
once a real dashboard filters on it; check current usage with:

```sql
-- distinct (col, json path) pairs referenced by saved widgets
```
(see the query used to find `final_disposition` was the most-used path —
grep `pype_analytics_widgets.spec` for `"path"` if repeating this.)

## 3. Timeouts scale with the biggest agent, not the dev table

`PER_CHART_TIMEOUT_MS` in `query/route.ts` was originally set against a dev
table of ~2k rows. Re-derive it against the largest real agent
(`SELECT agent_id, count(*) FROM pype_voice_call_logs GROUP BY 1 ORDER BY 2
DESC LIMIT 5`) whenever the ceiling starts rejecting real charts. Bound it
below `BATCH_DEADLINE_MS` (45s) and the `statement_timeout` cap (55s) in
`db.ts`.

## 4. A dedupe/identity key must be normalized before it's compared

`customer_number` and any future phone-shaped field get written in more than
one shape by different sources (`+917012224839`, `917012224839`,
`+91-8951539819` all seen in prod). `count_distinct` and `dedupe.key`
compare by the field's last 10 digits (`identity()` in `buildQuery.ts`), not
raw text — otherwise the same person is counted twice, or a "one row per
patient" dedupe fails to merge them. Extend `PHONE_FIELD` (buildQuery.ts) if
a new column holds phone numbers under a different name; don't normalize a
column that also holds non-phone identity values (session ids, etc.) — check
its value shapes on real data first.

## 5. Prefer a dedupe key the platform always writes

`metadata.wcalling_number` (JSON, dispatcher-injected) is missing on 31–58%
of rows depending on the agent. `customer_number` (a real column, written on
every call) is not. When wiring a new "one per X" chart, use the built-in
column unless there's a specific reason the JSON key is more correct for
that agent.

## 6. Verify against real data, not the dev table

Dev holds ~2k rows; prod agents run from a few hundred to tens of thousands
in 30 days. A query, an index, or a cache-freshness rule that looks fine on
dev can be wrong or catastrophically slow on the smallest prod agent that
happens to be busy. Before shipping a performance-sensitive analytics
change, run the real `EXPLAIN (ANALYZE, BUFFERS)` against prod (read-only
key) on at least one agent with tens of thousands of rows.
