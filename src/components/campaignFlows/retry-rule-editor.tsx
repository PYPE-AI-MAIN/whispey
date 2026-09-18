'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SIP_CODE_GROUPS,
  CALL_METADATA_FIELDS,
  type RetryConfig,
} from '@/utils/campaigns/constants'

const TYPE_LABELS: Record<RetryConfig['type'], string> = {
  sipCode: 'Call failure reason',
  metric: 'Conversation outcome',
  fieldExtractor: 'Something the agent extracted',
  metadata: 'Call metadata',
}

function emptyRule(type: RetryConfig['type']): RetryConfig {
  if (type === 'sipCode') return { type, errorCodes: [], delayMinutes: 5, maxRetries: 2 }
  if (type === 'metric') return { type, metricName: '', operator: '<', threshold: 0.5, delayMinutes: 5, maxRetries: 2 }
  if (type === 'fieldExtractor') return { type, fieldName: '', operator: 'missing', delayMinutes: 5, maxRetries: 2 }
  return { type, fieldName: CALL_METADATA_FIELDS.find((f) => f.enabled)?.key ?? '', operator: 'equals', delayMinutes: 5, maxRetries: 2 }
}

export function RetryRuleEditor({
  rules,
  onChange,
  fieldExtractorKeys,
}: {
  rules: RetryConfig[]
  onChange: (rules: RetryConfig[]) => void
  /** Field names the attached agent's field extractor actually produces. Falls back to a free-text input when not known. */
  fieldExtractorKeys?: string[]
}) {
  const update = (i: number, patch: Partial<RetryConfig>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i))
  const add = () => onChange([...rules, emptyRule('sipCode')])

  return (
    <div className="flex flex-col gap-2.5">
      {rules.map((rule, i) => (
        <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <select
              value={rule.type}
              onChange={(e) => update(i, emptyRule(e.target.value as RetryConfig['type']))}
              className="h-7 flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-[12px] text-gray-900 dark:text-gray-100"
            >
              {(Object.keys(TYPE_LABELS) as RetryConfig['type'][]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <button onClick={() => remove(i)} className="shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
              <Trash2 className="size-3.5" />
            </button>
          </div>

          {rule.type === 'sipCode' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SIP_CODE_GROUPS.map((group) => {
                const groupCodes = group.codes.filter((c) => c.enabled).map((c) => c.code)
                const selected = groupCodes.every((c) => rule.errorCodes?.includes(c)) && groupCodes.length > 0
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      const current = new Set(rule.errorCodes ?? [])
                      if (selected) groupCodes.forEach((c) => current.delete(c))
                      else groupCodes.forEach((c) => current.add(c))
                      update(i, { errorCodes: Array.from(current) })
                    }}
                    className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                      selected
                        ? 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {group.label}
                  </button>
                )
              })}
            </div>
          )}

          {rule.type === 'metric' && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Input placeholder="e.g. sentiment" className="h-7 text-[12px]" value={rule.metricName ?? ''} onChange={(e) => update(i, { metricName: e.target.value })} />
              <select value={rule.operator} onChange={(e) => update(i, { operator: e.target.value as RetryConfig['operator'] })} className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]">
                {['<', '>', '<=', '>=', '==', '!='].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <Input type="number" step="0.1" className="h-7 text-[12px]" value={rule.threshold ?? 0} onChange={(e) => update(i, { threshold: Number(e.target.value) })} />
            </div>
          )}

          {rule.type === 'fieldExtractor' && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {fieldExtractorKeys && fieldExtractorKeys.length > 0 ? (
                <select value={rule.fieldName ?? ''} onChange={(e) => update(i, { fieldName: e.target.value })} className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]">
                  <option value="">Select field…</option>
                  {fieldExtractorKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                </select>
              ) : (
                <Input placeholder="e.g. orderId" className="h-7 text-[12px]" value={rule.fieldName ?? ''} onChange={(e) => update(i, { fieldName: e.target.value })} />
              )}
              <select value={rule.operator} onChange={(e) => update(i, { operator: e.target.value as RetryConfig['operator'] })} className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]">
                {['missing', 'equals', 'not_equals', 'contains', 'not_contains'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <Input placeholder="expected value" className="h-7 text-[12px]" value={rule.expectedValue ?? ''} onChange={(e) => update(i, { expectedValue: e.target.value })} />
            </div>
          )}

          {rule.type === 'metadata' && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <select value={rule.fieldName} onChange={(e) => update(i, { fieldName: e.target.value })} className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]">
                {CALL_METADATA_FIELDS.filter((f) => f.enabled).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={rule.operator} onChange={(e) => update(i, { operator: e.target.value as RetryConfig['operator'] })} className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]">
                {['equals', 'not_equals', 'contains', 'not_contains', 'missing'].map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <Input placeholder="expected value" className="h-7 text-[12px]" value={rule.expectedValue ?? ''} onChange={(e) => update(i, { expectedValue: e.target.value })} />
            </div>
          )}

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-gray-500">Wait before retry (min)</Label>
              <Input type="number" className="h-7 text-[12px]" value={rule.delayMinutes} onChange={(e) => update(i, { delayMinutes: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-gray-500">Max retries</Label>
              <Input type="number" className="h-7 text-[12px]" value={rule.maxRetries} onChange={(e) => update(i, { maxRetries: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="h-7 justify-start gap-1.5 text-[12px]">
        <Plus className="size-3" />
        Add retry rule
      </Button>
    </div>
  )
}
