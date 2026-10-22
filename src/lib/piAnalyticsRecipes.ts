/**
 * Copy-paste analytics specs for Pi — aligned with Org Overview starter charts
 * (starterCharts.ts). Time series use `bucket`, not a timestamp dimension.
 */

export const PI_ANALYTICS_RECIPES_DOC = `
ANALYTICS RECIPES (use query_analytics — do NOT invent timestamp dimension columns like call_start_time):

Time trends (call volume, usage over time):
  { "spec_version": 1, "source": "voice", "agg": { "fn": "count" }, "bucket": "day", "range": { "days": 30 } }
  Optional agent_id to scope one agent. bucket: hour | day | week | month | auto.

Total calls in a period (single number):
  { "spec_version": 1, "source": "voice", "agg": { "fn": "count" }, "range": { "days": 30 } }

Calls by end reason:
  { "spec_version": 1, "agg": { "fn": "count" }, "dimension": { "field": { "col": "call_ended_reason" }, "limit": 12 }, "range": { "days": 30 } }

Calls by agent (org-wide):
  { "spec_version": 1, "agg": { "fn": "count" }, "dimension": { "field": { "col": "agent_id" }, "limit": 20 }, "range": { "days": 30 } }

Avg / p95 latency trend:
  { "spec_version": 1, "agg": { "fn": "p95", "field": { "col": "avg_latency" } }, "bucket": "day", "range": { "days": 30 } }

Rate on a disposition/extractor field (after list_analytics_fields returns the ref):
  { "spec_version": 1, "agg": { "fn": "rate", "field": <ref from catalog>, "denominator": "field_present" }, "range": { "days": 30 } }

Counting/filtering INSIDE a per-item array (one call can have several appointments/items, each with its own outcome — a disposition description saying "array of objects" or "JSON array of {..., someKey}" is the signal): a plain filter comparing the whole array field to a string ALWAYS returns 0, because you are comparing an array to a scalar — not a real "no matches", a guaranteed false negative. Use grain "element" instead: it expands the array to one row per item, and "element" becomes a pseudo-column for that item's own properties.
  { "spec_version": 1, "source": "voice", "grain": "element",
    "element_source": { "col": "transcription_metrics", "path": ["final_disposition"] },
    "agg": { "fn": "count" },
    "filters": [ { "op": "eq", "field": { "col": "element", "path": ["finalDisposition"] }, "value": "cancelled" } ],
    "range": { "days": 30 } }
  element_source is the array field itself (ref from the catalog/description). Every other field ref in this spec — filters, agg.field, dimension.field — must use col "element" with a path INTO one item's own keys (e.g. ["finalDisposition"], matching the key name the description says each array item has), never the array field's own col/path again.

list_analytics_fields: only needed for custom JSON/disposition fields — NOT for count+bucket trends.

When bucket is day/week/month, result rows include bucket (date) and value (metric). Summarize trend: total, avg per day, up/down vs first vs second half of period if helpful.
`.trim()

/** Default spec for "call volume last N days" trend. */
export function callVolumeTrendSpec(days = 30) {
  return {
    spec_version: 1 as const,
    source: 'voice' as const,
    agg: { fn: 'count' as const },
    bucket: 'day' as const,
    range: { days },
  }
}
