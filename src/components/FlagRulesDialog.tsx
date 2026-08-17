"use client"

// Per-agent call-flagging rule builder. Shape mirrors utils/flagRulesEngine.mjs in the
// analytics lambda exactly — keep both in sync if the engine's condition shape changes.

import type React from "react"
import { useMemo, useState } from "react"
import { Plus, X, Flag } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FlagSource = "field_extractor" | "call_log"
type FlagMatchType = "exact" | "starts_with" | "ends_with" | "contains"
type FlagOperator = "equals" | "not_equals" | "greater_than" | "less_than"

interface FlagCondition {
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

// Same allowlist as the API route and the lambda engine.
const CALL_LOG_FIELDS = [
  { value: "duration_seconds", label: "Call duration (seconds)" },
  { value: "customer_number", label: "Customer phone number" },
  { value: "call_status", label: "Call status" },
  { value: "metadata.transfer_call_initiated", label: "Transfer initiated" },
]

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
const newCondition = (): FlagCondition => ({ source: "field_extractor", matchType: "exact", field: "", operator: "equals", value: "" })
const newRule = (): FlagRule => ({ id: newId(), reason: "", conditions: [newCondition()] })

interface FlagRulesDialogProps {
  agentId?: string
  fieldExtractorPrompt?: string // raw JSON string of [{key, description}], same as agent.field_extractor_prompt
  initialFlagRules?: FlagRulesConfig | null
}

const FlagRulesDialog: React.FC<FlagRulesDialogProps> = ({ agentId, fieldExtractorPrompt, initialFlagRules }) => {
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
  const [rules, setRules] = useState<FlagRule[]>(initialFlagRules?.rules?.length ? initialFlagRules.rules : [newRule()])
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

    // drop rows nobody filled in — same shape the API validates
    const validRules = rules
      .map((r) => ({ ...r, conditions: r.conditions.filter((c) => c.field.trim() !== "" && c.value.trim() !== "") }))
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
        </DialogHeader>
        <Separator className="flex-shrink-0" />

        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800">
            <Label htmlFor="flagging-enabled" className="text-base font-medium text-gray-700 dark:text-gray-300">
              Enable Flagging
            </Label>
            <Switch id="flagging-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {extractorKeys.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No field extractor fields configured yet — set those up first so there's something to flag on.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-4">
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
                    <Label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Flag reason</Label>
                    <Input
                      placeholder="e.g. task_incomplete (defaults to the field name)"
                      value={rule.reason}
                      onChange={(e) => updateRule(ruleIndex, { reason: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => removeRule(ruleIndex)}
                      aria-label={`Remove rule ${ruleIndex + 1}`}
                      className="h-8 w-8 p-0 rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {rule.conditions.map((condition, conditionIndex) => (
                    <div key={conditionIndex}>
                      {conditionIndex > 0 && <div className="text-xs font-medium text-gray-400 dark:text-gray-500 pl-1 py-1">AND</div>}
                      <ConditionRow
                        condition={condition}
                        extractorKeys={extractorKeys}
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
            <Plus className="w-4 h-4 mr-2" /> Add Rule
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

// One condition row: [which field(s)] [comparison] [value]. The first select controls both
// the source (field_extractor vs call_log) and the matchType (exact vs a name pattern) at
// once, since that's the single choice a person is actually making.
function ConditionRow({
  condition, extractorKeys, onChange, onRemove,
}: {
  condition: FlagCondition
  extractorKeys: string[]
  onChange: (patch: Partial<FlagCondition>) => void
  onRemove?: () => void
}) {
  const fieldMode = condition.source === "call_log" ? "call_log" : condition.matchType === "exact" ? "exact" : `pattern:${condition.matchType}`

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-3">
        <Select
          value={fieldMode}
          onValueChange={(v) => {
            if (v === "call_log") onChange({ source: "call_log", matchType: "exact", field: "" })
            else if (v === "exact") onChange({ source: "field_extractor", matchType: "exact", field: "" })
            else onChange({ source: "field_extractor", matchType: v.replace("pattern:", "") as FlagMatchType, field: "" })
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="exact">Field extractor value</SelectItem>
            <SelectItem value="pattern:ends_with">Field name ends with</SelectItem>
            <SelectItem value="pattern:starts_with">Field name starts with</SelectItem>
            <SelectItem value="pattern:contains">Field name contains</SelectItem>
            <SelectItem value="call_log">Call metadata</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-3">
        {condition.source === "call_log" ? (
          <Select value={condition.field} onValueChange={(v) => onChange({ field: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent>
              {CALL_LOG_FIELDS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : condition.matchType === "exact" ? (
          <Select value={condition.field} onValueChange={(v) => onChange({ field: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
            <SelectContent>
              {extractorKeys.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="e.g. _correctly"
            value={condition.field}
            onChange={(e) => onChange({ field: e.target.value })}
            className="h-8 text-xs"
          />
        )}
      </div>

      <div className="col-span-3">
        <Select value={condition.operator} onValueChange={(v) => onChange({ operator: v as FlagOperator })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">equals</SelectItem>
            <SelectItem value="not_equals">not equals</SelectItem>
            {condition.source === "call_log" && (
              <>
                <SelectItem value="greater_than">greater than</SelectItem>
                <SelectItem value="less_than">less than</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2">
        <Input placeholder="value" value={condition.value} onChange={(e) => onChange({ value: e.target.value })} className="h-8 text-xs" />
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
