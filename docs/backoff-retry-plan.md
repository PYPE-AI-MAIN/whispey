# Backoff Retry — Implementation Plan

## 1. Goal

Today every retry rule on a campaign waits a single fixed delay between attempts (`delayMinutes`, repeated up to `maxRetries` times). We want each rule to optionally use a **progressive backoff schedule** — an explicit list of delays per attempt, e.g. `[5, 10, 30]` meaning "1st retry after 5 min, 2nd retry after 10 min, 3rd retry after 30 min, then stop."

Hard requirements:
- **Backward compatible.** Existing campaigns and existing UI flows must continue to work without migration.
- **Per rule, not per campaign.** A campaign can mix a fixed-delay rule for `486 Busy` with a backoff rule for `480 Temporarily Unavailable`.
- **Mutually exclusive per rule.** A rule is either fixed or backoff — never both at once.
- **Minimum 5 minutes per backoff entry.** Tighter retries get the contact rate-limited by carriers.

## 2. Data model

Single optional field added to the existing `RetryConfig` shape — no other schema changes:

```ts
backoffMinutes?: number[]   // 5 ≤ value ≤ 1440, length 1..10
```

**Resolution rule** (one place: `retry-logic.mjs`):
- `backoffMinutes` absent or empty → **fixed mode**: use `delayMinutes` and `maxRetries` (legacy path, unchanged).
- `backoffMinutes` non-empty → **backoff mode**:
  - `effectiveMaxRetries = backoffMinutes.length`
  - `effectiveDelayMinutes = backoffMinutes[retryCount]` (clamped to last entry just in case)
  - `delayMinutes` and `maxRetries` are silently ignored.

This keeps the persisted shape stable. Old DynamoDB rows have no `backoffMinutes` and route through the legacy branch.

## 3. UX

In `RetryConfiguration.tsx`, each rule gains a radio toggle:

```
Retry Timing
( • ) Fixed delay         → shows "Delay (minutes)" + "Max Retries"
(   ) Backoff schedule    → shows "Backoff schedule (comma-separated minutes)"
```

- Default = **Fixed delay** so existing rules render identically.
- Switching to Backoff seeds `[5, 10, 30]` so the user has something concrete.
- Switching back to Fixed deletes `backoffMinutes` and restores fixed-mode defaults.
- The hidden fields stay populated in form state because Yup still requires them — they ride along on submit and are ignored by the backend in Backoff mode.

## 4. Files changed (six, scoped)

| # | Repo | File | Role |
|---|---|---|---|
| 1 | dashboard | `src/utils/campaigns/constants.ts` | Add `backoffMinutes?: number[]` to `RetryConfig` |
| 2 | dashboard | `src/components/campaigns/RetryConfiguration.tsx` | Radio toggle + comma-separated input + parser |
| 3 | dashboard | `src/app/[projectid]/campaigns/create/page.tsx` | Yup schema field + `formattedRetryConfig` carry-through (silent-strip blocker) |
| 4 | dashboard | `src/app/api/campaigns/schedule/route.ts` | Validation block for optional `backoffMinutes` |
| 5 | scheduler | `src/api/campaigns/configure-schedule.mjs` | Mirror validation server-side |
| 6 | scheduler | `src/lib/campaigns/retry-logic.mjs` | Resolve `effectiveMaxRetries` / `effectiveDelayMinutes` |

Files explicitly verified as **not** needing changes (passthrough or generic): `src/app/api/campaigns/list/route.ts`, `src/app/[projectid]/campaigns/[campaignId]/page.tsx`, scheduler `dynamodb.mjs` (`updateContactStatus` is a generic UpdateExpression builder), `schedule-processor.mjs`, `contact-status-stream.mjs`, `call-consumer.mjs`.

## 5. Validation (enforced at every layer)

| Layer | Behavior |
|---|---|
| UI input parser | strips entries `<5` or `>1440` while typing, caps array at 10 |
| Form sanitizer (`sanitizeBackoff`) | same — runs again before POST in case of paste |
| Yup schema | `min(5).max(1440)`, array length `≤10` — surfaces error message on submit |
| Dashboard `/api/campaigns/schedule` | 400 with explicit message on violation |
| Scheduler `configure-schedule.mjs` | 400 with explicit message — last line of defence for direct API calls |

## 6. Edge cases — confirmed covered

| Scenario | Result |
|---|---|
| Type `2, 10, 30` in UI | Persisted as `[10, 30]` (the `2` is silently dropped — below floor) |
| Type `0` only | Empty array → backoff cleared, falls back to fixed mode |
| Switch Fixed → Backoff | Seeds default `[5, 10, 30]` |
| Switch Backoff → Fixed | Removes `backoffMinutes`, restores `delayMinutes` / `maxRetries` |
| Direct POST with `[3]` | Both APIs reject 400 |
| `backoffMinutes=[5,10]` + dead `maxRetries=4` (from prior fixed config) | 2 retries (array wins), `maxRetries` ignored |
| `retryCount` ≥ array length | Contact marked failed at next failure event |
| Old campaign rows in DynamoDB (no `backoffMinutes`) | Untouched — fixed-mode path, identical behavior |
| Existing 408 default-injection logic in `configure-schedule.mjs` | Untouched — still force-injects default 408 rule with `maxRetries=3` |

## 7. Rollout

1. **Code merge** — the six file diffs above. No DB migration needed; field is optional on read and write.
2. **Deploy scheduler first** so the backend can accept `backoffMinutes` before the UI starts sending it. Order matters: validator on backend rejects unknown fields if not deployed first.
3. **Deploy dashboard.** Existing campaigns continue to render as Fixed mode.
4. **Verification:**
   - Create new campaign in Backoff mode `[5, 10, 30]`. Trigger 3 SIP failures (e.g. 480). Confirm `nextCallAt` waits 5, 10, 30 minutes via `[retry-logic]` log lines and DynamoDB `retryCount`.
   - Create new campaign in Fixed mode. Confirm logs show `mode=fixed` and behavior identical to today.
   - Edit an old campaign without changes — confirm save round-trips with no `backoffMinutes` field appearing.
5. **Rollback** is trivial — remove the `backoffMinutes` reads in `retry-logic.mjs` and the codepath returns to the legacy fixed-only path. No data cleanup required.

## 8. Out of scope

- Exponential math helpers (e.g. `2^n × base`). The user-supplied list is the only contract; if exponential is wanted later, it's a UI affordance that pre-fills the array — no logic change needed.
- Per-attempt jitter / randomization.
- Raising the floor on legacy fixed-mode `delayMinutes` (left at 0–1440 to preserve existing campaigns).
- Backoff for the `408` default-injection rule — that path enforces `maxRetries=3` and is left as-is per existing system contract.
