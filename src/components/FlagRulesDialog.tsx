"use client"

// Per-agent call-flagging rule builder. Shape mirrors utils/flagRulesEngine.mjs in the
// analytics lambda exactly — keep both in sync if the engine's condition shape changes.

import type React from "react"
import { useMemo, useState } from "react"
import { Plus, X, Flag } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"

type FlagSource = "field_extractor" | "call_log"
type FlagMatchType = "exact" | "starts_with" | "ends_with" | "contains"
type FlagOperator =
  | "equals" | "not_equals" | "greater_than" | "less_than" | "greater_than_or_equal" | "less_than_or_equal"
  | "in" | "not_in" | "is_empty" | "is_not_empty" | "invalid_phone_format"

// Operators that don't compare against a value at all — the value input is hidden for these.
const NO_VALUE_OPERATORS = new Set<FlagOperator>(["is_empty", "is_not_empty", "invalid_phone_format"])

interface FlagCondition {
  id: string // client-only, for stable React keys; stripped before save
  source: FlagSource
  matchType: FlagMatchType
  field: string
  operator: FlagOperator
  value: string
}

interface FlagRule {
  id: string
  reason: string
  conditions: FlagCondition[]
}

interface FlagRulesConfig {
  enabled: boolean
  rules: FlagRule[]
}

// Raw call_log columns — the small, fixed, exact part of the tiered allowlist. Metadata
// keys and metric ids are dynamic per-agent (see metadataKeys/metricKeys props below),
// not hardcoded here — they're discovered the same way the Columns picker already does.
const CALL_LOG_INFO_FIELDS = [
  { value: "duration_seconds", label: "Call duration (seconds)", type: "numeric" as const },
  { value: "customer_number", label: "Customer phone number", type: "string" as const },
  { value: "call_ended_reason", label: "Call status", type: "string" as const },
]

// Operators grouped by value type, plus the always-available no-value ones (is_empty etc).
const STRING_OPERATORS: FlagOperator[] = ["equals", "not_equals", "in", "not_in"]
const NUMERIC_OPERATORS: FlagOperator[] = ["equals", "not_equals", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal"]
const NO_VALUE_OPERATOR_LIST: FlagOperator[] = ["is_empty", "is_not_empty", "invalid_phone_format"]
const OPERATOR_LABELS: Record<FlagOperator, string> = {
  equals: "equals", not_equals: "not equals",
  greater_than: "greater than", greater_than_or_equal: "greater than or equal to",
  less_than: "less than", less_than_or_equal: "less than or equal to",
  in: "is any of", not_in: "is none of",
  is_empty: "is empty", is_not_empty: "is not empty",
  invalid_phone_format: "is an invalid phone number",
}

// Known-type fields (call_info columns, metric scores) restrict the operator list to what
// actually makes sense for that type. Field extractor / metadata values have no declared
// type (any agent can put a number or a string in an LLM-extracted field), so those keep
// the full operator list — the engine already handles a mismatched value safely at eval time.
function operatorsForCondition(fieldMode: FieldModeChoice, field: string): FlagOperator[] {
  if (fieldMode === "metric_score") return [...NUMERIC_OPERATORS, "is_empty", "is_not_empty"]
  if (fieldMode === "call_info") {
    const known = CALL_LOG_INFO_FIELDS.find((f) => f.value === field)
    if (known?.type === "numeric") return [...NUMERIC_OPERATORS, "is_empty", "is_not_empty"]
    const ops: FlagOperator[] = [...STRING_OPERATORS, "is_empty", "is_not_empty"]
    return field === "customer_number" ? [...ops, "invalid_phone_format"] : ops
  }
  return [...STRING_OPERATORS, ...NUMERIC_OPERATORS.filter((o) => !STRING_OPERATORS.includes(o)), ...NO_VALUE_OPERATOR_LIST]
}

const METADATA_PREFIX = "metadata."
const METRIC_SCORE_SUFFIX = ".score"
const METRIC_SCORE_PATH = /^metrics\.[^.]+\.score$/

type CallLogFieldMode = "call_info" | "call_metadata" | "metric_score"
function callLogFieldMode(field: string): CallLogFieldMode {
  if (field.startsWith(METADATA_PREFIX)) return "call_metadata"
  if (METRIC_SCORE_PATH.test(field)) return "metric_score"
  return "call_info"
}

// Plain-English label for one condition, e.g. "is_task_complete equals 0" or
// "field name ends with “_correctly” is empty" — used in the live rule preview.
function conditionLabel(c: FlagCondition): string {
  let field: string
  if (c.source === "call_log") {
    if (c.field.startsWith(METADATA_PREFIX)) field = c.field.slice(METADATA_PREFIX.length)
    else if (METRIC_SCORE_PATH.test(c.field)) field = `${c.field.slice("metrics.".length, -METRIC_SCORE_SUFFIX.length)} score`
    else field = CALL_LOG_INFO_FIELDS.find((f) => f.value === c.field)?.label ?? c.field
  } else {
    field = c.matchType === "exact" ? c.field : `field name ${c.matchType.replaceAll("_", " ")} “${c.field}”`
  }
  const val = NO_VALUE_OPERATORS.has(c.operator) ? "" : ` ${c.value.trim()}`
  return `${field.trim() || "…"} ${OPERATOR_LABELS[c.operator]}${val}`.trim()
}

// Live preview of a whole rule; returns null until at least one condition has a field.
function ruleSummary(rule: FlagRule): string | null {
  const filled = rule.conditions.filter((c) => c.field.trim() !== "")
  if (filled.length === 0) return null
  return filled.map(conditionLabel).join(" AND ")
}

// Client-only stable ids for React keys (rule.id also persists as the rule identifier).
// crypto.randomUUID is available in every browser secure context and modern Node; the
// counter is only a non-crypto fallback for old runtimes — no Math.random (security).
let idCounter = 0
function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  idCounter += 1
  return `id-${idCounter}`
}
const newCondition = (): FlagCondition => ({ id: newId(), source: "field_extractor", matchType: "exact", field: "", operator: "equals", value: "" })
const newRule = (): FlagRule => ({ id: newId(), reason: "", conditions: [newCondition()] })

// Field-mode is a single derived choice (source + matchType + call_log field category).
function computeFieldMode(condition: FlagCondition): FieldModeChoice {
  if (condition.source === "call_log") return callLogFieldMode(condition.field)
  if (condition.matchType === "exact") return "exact"
  return `pattern:${condition.matchType}` as FieldModeChoice
}

interface FlagRulesDialogProps {
  agentId?: string
  fieldExtractorPrompt?: string // raw JSON string of [{key, description}], same as agent.field_extractor_prompt
  initialFlagRules?: FlagRulesConfig | null
  metadataKeys?: string[] // discovered call_log.metadata keys (same list the Columns picker uses — already denylist-filtered)
  metricKeys?: string[]   // discovered pype_voice_call_logs.metrics keys (configured Metrics — score only)
  onSaved?: () => void    // refetch the agent after a successful save, so reopening this dialog shows the just-saved config, not a stale cache
}

const FlagRulesDialog: React.FC<FlagRulesDialogProps> = ({
  agentId, fieldExtractorPrompt, initialFlagRules, metadataKeys = [], metricKeys = [], onSaved,
}) => {
  const extractorKeys = useMemo(() => {
    try {
      const parsed = JSON.parse(fieldExtractorPrompt || "[]")
      return Array.isArray(parsed)
        ? parsed.map((f: any) => f?.key).filter((k: unknown): k is string => typeof k === "string" && k.length > 0)
        : []
    } catch {
      return []
    }
  }, [fieldExtractorPrompt])

  const [enabled, setEnabled] = useState(initialFlagRules?.enabled ?? false)
  const [rules, setRules] = useState<FlagRule[]>(() =>
    initialFlagRules?.rules?.length
      ? initialFlagRules.rules.map((r) => ({
          ...r,
          conditions: r.conditions.map((c) => ({ ...c, id: c.id || newId() })), // backfill ids on load (persisted configs have none)
        }))
      : [newRule()]
  )
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addRule = () => setRules([...rules, newRule()])
  const removeRule = (index: number) => setRules(rules.filter((_, i) => i !== index))
  const updateRule = (index: number, patch: Partial<FlagRule>) => setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const addCondition = (ruleIndex: number) => updateRule(ruleIndex, { conditions: [...rules[ruleIndex].conditions, newCondition()] })
  const removeCondition = (ruleIndex: number, conditionIndex: number) =>
    updateRule(ruleIndex, { conditions: rules[ruleIndex].conditions.filter((_, i) => i !== conditionIndex) })
  const updateCondition = (ruleIndex: number, conditionIndex: number, patch: Partial<FlagCondition>) =>
    updateRule(ruleIndex, { conditions: rules[ruleIndex].conditions.map((c, i) => (i === conditionIndex ? { ...c, ...patch } : c)) })

  const handleSave = async () => {
    if (!agentId) return
    setError(null)

    // drop rows nobody filled in — same shape the API validates. Value is optional
    // for is_empty/is_not_empty/invalid_phone_format, which don't compare against one.
    const validRules = rules
      .map((r) => ({
        ...r,
        conditions: r.conditions
          .filter((c) => c.field.trim() !== "" && (NO_VALUE_OPERATORS.has(c.operator) || c.value.trim() !== ""))
          // strip the client-only id so the saved shape matches the documented contract
          .map((c): Omit<FlagCondition, "id"> => ({
            source: c.source, matchType: c.matchType, field: c.field, operator: c.operator, value: c.value,
          })),
      }))
      .filter((r) => r.conditions.length > 0)

    setIsSaving(true)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_rules: { enabled, rules: validRules } }),
      })
      const j = (await res.json()) as { error?: string }
      if (res.ok) {
        setIsOpen(false)
        onSaved?.()
      } else {
        setError(j.error || res.statusText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
          <Flag className="w-4 h-4 mr-2" />
          Flag Rules
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-lg shadow-xl p-0 flex flex-col h-[85vh]">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Call Flagging</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            Automatically flag calls for review when they match a rule you define. Flagged calls are highlighted in Call Logs and can be filtered by their flag.
          </DialogDescription>
        </DialogHeader>
        <Separator className="flex-shrink-0" />

        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-800">
            <div>
              <Label htmlFor="flagging-enabled" className="text-base font-medium text-gray-700 dark:text-gray-300">
                Enable Flagging
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Off = rules are saved but no calls are flagged.</p>
            </div>
            <Switch id="flagging-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
            A call is flagged if it matches <span className="font-semibold">any</span> rule below. A rule matches only when <span className="font-semibold">all</span> of its conditions are true.
          </p>
          {extractorKeys.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No field extractor fields configured yet — set those up first so there's something to flag on.
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Tip: values vary by agent — some use <code>0</code>/<code>1</code>, others <code>pass</code>/<code>fail</code>/<code>not_applicable</code>, or <code>yes</code>/<code>no</code>. Check a real call's actual values before assuming a convention.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Flags <span className="font-normal text-gray-400 dark:text-gray-500">({rules.length})</span>
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">each flag is checked independently</span>
            </div>
            {rules.map((rule, ruleIndex) => (
              <div key={rule.id}>
                {ruleIndex > 0 && (
                  <div className="flex items-center gap-2 my-3">
                    <Separator className="flex-1" />
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">OR</span>
                    <Separator className="flex-1" />
                  </div>
                )}
                <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
                      {ruleIndex + 1}
                    </span>
                    <Label className="text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">Flag</Label>
                    <Input
                      placeholder="name this flag — e.g. task_incomplete (defaults to the field name)"
                      value={rule.reason}
                      onChange={(e) => updateRule(ruleIndex, { reason: e.target.value })}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeRule(ruleIndex)}
                      aria-label={`Remove flag ${ruleIndex + 1}`}
                      className="h-8 w-8 p-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-12 gap-2 px-1">
                    <div className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">What to check</div>
                    <div className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Field</div>
                    <div className="col-span-3 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Condition</div>
                    <div className="col-span-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Value</div>
                    <div className="col-span-1" />
                  </div>

                  {rule.conditions.map((condition, conditionIndex) => (
                    <div key={condition.id}>
                      {conditionIndex > 0 && <div className="text-xs font-medium text-gray-400 dark:text-gray-500 pl-1 py-1">AND</div>}
                      <ConditionRow
                        condition={condition}
                        extractorKeys={extractorKeys}
                        metadataKeys={metadataKeys}
                        metricKeys={metricKeys}
                        onChange={(patch) => updateCondition(ruleIndex, conditionIndex, patch)}
                        onRemove={rule.conditions.length > 1 ? () => removeCondition(ruleIndex, conditionIndex) : undefined}
                      />
                    </div>
                  ))}

                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => addCondition(ruleIndex)}
                    className="text-xs h-7 text-gray-500 dark:text-gray-400"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add condition (AND)
                  </Button>

                  {ruleSummary(rule) && (
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                      <span className="font-medium">Flags when</span> {ruleSummary(rule)}
                      <span className="text-blue-400 dark:text-blue-500"> → “{rule.reason.trim() || "reason defaults to the field name"}”</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 p-6 pt-4 border-t dark:border-gray-700 space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            type="button" variant="outline"
            onClick={addRule}
            className="w-full rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
          >
            <Plus className="w-4 h-4 mr-2" /> Add another flag
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-md bg-gray-900 text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {isSaving ? "Saving…" : "Save Flag Rules"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// One condition row: [which field(s)] [comparison] [value]. The first select controls
// the source (field_extractor vs call_log), the matchType (exact vs a name pattern), and
// — for call_log — which of the three field categories (raw call info / metadata / metric
// score) all at once, since that's the single choice a person is actually making.
type FieldModeChoice = "exact" | "pattern:starts_with" | "pattern:ends_with" | "pattern:contains" | "call_info" | "call_metadata" | "metric_score"

// Second-column input: which concrete field within the chosen mode. Early-returns per mode
// (no nested ternaries) and renders a free-text box for the name-pattern modes.
function FieldInput({
  fieldMode, field, extractorKeys, metadataKeys, metricKeys, onChange,
}: Readonly<{
  fieldMode: FieldModeChoice
  field: string
  extractorKeys: string[]
  metadataKeys: string[]
  metricKeys: string[]
  onChange: (patch: Partial<FlagCondition>) => void
}>) {
  if (fieldMode === "call_info") {
    return (
      <Select value={field} onValueChange={(v) => onChange({ field: v })}>
        <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue placeholder="Select field" /></SelectTrigger>
        <SelectContent>
          {CALL_LOG_INFO_FIELDS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
        </SelectContent>
      </Select>
    )
  }
  if (fieldMode === "call_metadata") {
    return (
      <Select
        value={field.startsWith(METADATA_PREFIX) ? field.slice(METADATA_PREFIX.length) : ""}
        onValueChange={(v) => onChange({ field: `${METADATA_PREFIX}${v}` })}
      >
        <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue placeholder={metadataKeys.length ? "Select field" : "No metadata fields yet"} /></SelectTrigger>
        <SelectContent>
          {metadataKeys.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
        </SelectContent>
      </Select>
    )
  }
  if (fieldMode === "metric_score") {
    return (
      <Select
        value={field.endsWith(METRIC_SCORE_SUFFIX) ? field.slice("metrics.".length, -METRIC_SCORE_SUFFIX.length) : ""}
        onValueChange={(v) => onChange({ field: `metrics.${v}${METRIC_SCORE_SUFFIX}` })}
      >
        <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue placeholder={metricKeys.length ? "Select metric" : "No metrics configured yet"} /></SelectTrigger>
        <SelectContent>
          {metricKeys.map((k) => (<SelectItem key={k} value={k}>{k} score</SelectItem>))}
        </SelectContent>
      </Select>
    )
  }
  if (fieldMode === "exact") {
    return (
      <Select value={field} onValueChange={(v) => onChange({ field: v })}>
        <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue placeholder="Select field" /></SelectTrigger>
        <SelectContent>
          {extractorKeys.map((k) => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
        </SelectContent>
      </Select>
    )
  }
  // pattern:starts_with / ends_with / contains — free-text against field names
  return (
    <Input placeholder="e.g. _correctly" value={field} onChange={(e) => onChange({ field: e.target.value })} className="h-8 text-xs" />
  )
}

// Reset a condition to sensible defaults when its mode changes (source/matchType/category).
function applyFieldMode(v: FieldModeChoice, onChange: (patch: Partial<FlagCondition>) => void) {
  if (v === "call_info" || v === "call_metadata" || v === "metric_score") {
    onChange({ source: "call_log", matchType: "exact", field: "", operator: "equals", value: "" })
  } else if (v === "exact") {
    onChange({ source: "field_extractor", matchType: "exact", field: "", operator: "equals", value: "" })
  } else {
    onChange({ source: "field_extractor", matchType: v.replace("pattern:", "") as FlagMatchType, field: "", operator: "equals", value: "" })
  }
}

function ConditionRow({
  condition, extractorKeys, metadataKeys, metricKeys, onChange, onRemove,
}: Readonly<{
  condition: FlagCondition
  extractorKeys: string[]
  metadataKeys: string[]
  metricKeys: string[]
  onChange: (patch: Partial<FlagCondition>) => void
  onRemove?: () => void
}>) {
  const fieldMode = computeFieldMode(condition)

  // Include the condition's current operator even if it falls outside the type-restricted
  // list — e.g. a rule saved before this field existed, or before restricting by type — so
  // an existing saved rule never silently loses its value in the dropdown.
  const baseOperators = operatorsForCondition(fieldMode, condition.field)
  const availableOperators = baseOperators.includes(condition.operator) ? baseOperators : [condition.operator, ...baseOperators]

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-3 min-w-0">
        <Select value={fieldMode} onValueChange={(v: FieldModeChoice) => applyFieldMode(v, onChange)}>
          <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-gray-400">From the AI analysis</SelectLabel>
              <SelectItem value="exact">Field extractor value</SelectItem>
              <SelectItem value="metric_score">Metric score</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-gray-400">From the call record</SelectLabel>
              <SelectItem value="call_info">Call info</SelectItem>
              <SelectItem value="call_metadata">Call metadata</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wide text-gray-400">Match many fields by name</SelectLabel>
              <SelectItem value="pattern:starts_with">Field name starts with</SelectItem>
              <SelectItem value="pattern:ends_with">Field name ends with</SelectItem>
              <SelectItem value="pattern:contains">Field name contains</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-3 min-w-0">
        <FieldInput
          fieldMode={fieldMode}
          field={condition.field}
          extractorKeys={extractorKeys}
          metadataKeys={metadataKeys}
          metricKeys={metricKeys}
          onChange={onChange}
        />
      </div>

      <div className="col-span-3 min-w-0">
        <Select value={condition.operator} onValueChange={(v) => onChange({ operator: v as FlagOperator, value: NO_VALUE_OPERATORS.has(v as FlagOperator) ? "" : condition.value })}>
          <SelectTrigger className="h-8 text-xs w-full min-w-0"><SelectValue className="truncate" /></SelectTrigger>
          <SelectContent>
            {availableOperators.map((op) => (
              <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 min-w-0">
        {!NO_VALUE_OPERATORS.has(condition.operator) && (
          <Input
            placeholder={condition.operator === "in" || condition.operator === "not_in" ? "a, b, c" : "value"}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
            className="h-8 text-xs"
          />
        )}
      </div>

      <div className="col-span-1 flex justify-center">
        {onRemove && (
          <Button
            variant="ghost" size="icon" onClick={onRemove}
            aria-label="Remove condition"
            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default FlagRulesDialog
