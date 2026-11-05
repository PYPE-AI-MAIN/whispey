# Analytics performance — standards

Rules learned from making prod queries fast, so the next chart/agent/index
doesn't re-discover them. Read before adding a widget type, a new base
column, or touching `buildQuery.ts` / `db.ts`.

## 1. Region: the function must run where the database is

The pooler is `aws-1-ap-south-1` (Mumbai). Every analytics route declares:

`export const preferredRegion` does **not** work here — do not add it back.
Next.js docs: on Vercel it was only ever honored for `runtime = 'edge'`, and
it is now deprecated outright. These routes use `runtime = 'nodejs'`
(required — `pg` is not edge-compatible), so it was always a no-op.

The real mechanism is project-level: a `regions` key in `vercel.json`, or
Project Settings → Functions → Function Regions in the dashboard. Hobby
plans get exactly one region for the *whole project* (all functions, not
just analytics) — Pro gets up to 5, with a `functions` block in
`vercel.json` to scope regions per route.

`runQuery()` opens a transaction and sends BEGIN, `SET LOCAL` ×2, the query,
and COMMIT — five statements per chart, minimum. If the project's function
region doesn't match the pooler's (new projects default to `iad1`,
Washington D.C.; the pooler is `aws-1-ap-south-1`, Mumbai), every one of
those five pays a cross-region round trip. That cost is invisible in local
testing (you're always "far" from prod) and invisible in `EXPLAIN ANALYZE`
(it only measures time inside Postgres) — it only shows up as "slower than a
tool that queries from the right region," e.g. Metabase or the SQL editor.

**Before changing the project region:** check what else the app's other
routes talk to (LLM APIs, auth, other third parties) — on Hobby, moving
the whole project to Mumbai for analytics' sake also moves everything else.
Confirm the current region first via the dashboard or a function's logs,
which print the region it executed in.

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

## 7. The connection pool is sized for Fluid Compute, not classic serverless

Fluid Compute (enabled on this project) means one warm instance serves many
concurrent requests and reuses the same `pg.Pool` — it isn't a fresh isolate
and a fresh pool per invocation. Vercel's own guidance for that model:
never `max: 1` (it doesn't reduce total connections, it only kills
concurrency), keep `min: 1`, and let the pool stay warm. `db.ts` runs
`max: 10, min: 1, idleTimeoutMillis: 5_000`.

That ceiling is per running instance and shared across every dashboard any
user has open — check the project's actual pooler client limit (Supabase
dashboard → Database → Connection Pooling) before raising it further, and
re-measure rather than guess.

`runQuery()` logs a warning when a query waited more than 2s just to get a
connection (`queued Nms for a pool connection`) — that's the pool being the
bottleneck, distinct from the query itself being slow, and previously both
looked identical from the browser as "this chart took too long."

Known related failure mode, not this app's bug but worth knowing the
symptom: Supabase's shared pooler (Supavisor) had a TLS bug where broken
connections under Vercel Fluid Compute leaked "zombie" client slots until
`FATAL: Max client connections reached`
([supabase/discussions#40671](https://github.com/orgs/supabase/discussions/40671)),
fixed server-side. If timeouts recur despite headroom in the app's own
pool, check for that symptom before re-tuning the app.
