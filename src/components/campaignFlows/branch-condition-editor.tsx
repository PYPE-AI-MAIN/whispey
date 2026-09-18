'use client'

import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SIP_CODE_GROUPS, CALL_METADATA_FIELDS } from '@/utils/campaigns/constants'
import type { BranchCondition, BranchConditionType } from '@/lib/campaignFlows/types'

const TYPE_LABELS: Record<BranchConditionType, string> = {
  sipCode: 'Call failure reason',
  metric: 'A metric (e.g. transcription_metrics)',
  fieldExtractor: 'Something the agent extracted',
  metadata: 'Call metadata',
}

export function emptyBranchCondition(type: BranchConditionType): BranchCondition {
  if (type === 'sipCode') return { type, errorCodes: [] }
  if (type === 'metric') return { type, metricName: '', operator: '>=', threshold: 3 }
  if (type === 'fieldExtractor') return { type, fieldName: '', operator: 'missing' }
  return { type, fieldName: CALL_METADATA_FIELDS.find((f) => f.enabled)?.key ?? '', operator: 'equals' }
}

/** A short, human-readable summary of a condition, used as the branch's default label. */
export function summarizeCondition(condition: BranchCondition): string {
  if (condition.type === 'sipCode') {
    const groups = SIP_CODE_GROUPS.filter((g) => g.codes.some((c) => condition.errorCodes?.includes(c.code)))
    return groups.length ? groups.map((g) => g.label).join(', ') : 'Call failure reason'
  }
  if (condition.type === 'metric') {
    return condition.metricName ? `${condition.metricName} ${condition.operator ?? ''} ${condition.threshold ?? ''}` : 'Metric condition'
  }
  if (condition.type === 'fieldExtractor') {
    return condition.fieldName ? `${condition.fieldName} ${condition.operator ?? ''}` : 'Field condition'
  }
  const field = CALL_METADATA_FIELDS.find((f) => f.key === condition.fieldName)
  return field ? `${field.label} ${condition.operator ?? ''}` : 'Call metadata'
}

export function BranchConditionEditor({
  condition,
  onChange,
  onRemove,
  fieldExtractorKeys,
}: {
  condition: BranchCondition
  onChange: (condition: BranchCondition) => void
  onRemove: () => void
  /** Field names the attached agent's field extractor actually produces. Falls back to a free-text input when not known. */
  fieldExtractorKeys?: string[]
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <select
          value={condition.type}
          onChange={(e) => onChange(emptyBranchCondition(e.target.value as BranchConditionType))}
          className="h-7 flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-[12px] text-gray-900 dark:text-gray-100"
        >
          {(Object.keys(TYPE_LABELS) as BranchConditionType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button onClick={onRemove} className="shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {condition.type === 'sipCode' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SIP_CODE_GROUPS.map((group) => {
            const groupCodes = group.codes.filter((c) => c.enabled).map((c) => c.code)
            const selected = groupCodes.every((c) => condition.errorCodes?.includes(c)) && groupCodes.length > 0
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => {
                  const current = new Set(condition.errorCodes ?? [])
                  if (selected) groupCodes.forEach((c) => current.delete(c))
                  else groupCodes.forEach((c) => current.add(c))
                  onChange({ ...condition, errorCodes: Array.from(current) })
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

      {condition.type === 'metric' && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Input
            placeholder="e.g. disconnect_count"
            className="h-7 text-[12px]"
            value={condition.metricName ?? ''}
            onChange={(e) => onChange({ ...condition, metricName: e.target.value })}
          />
          <select
            value={condition.operator}
            onChange={(e) => onChange({ ...condition, operator: e.target.value as BranchCondition['operator'] })}
            className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]"
          >
            {['<', '>', '<=', '>=', '==', '!='].map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <Input
            type="number"
            step="0.1"
            className="h-7 text-[12px]"
            value={condition.threshold ?? 0}
            onChange={(e) => onChange({ ...condition, threshold: Number(e.target.value) })}
          />
        </div>
      )}

      {condition.type === 'fieldExtractor' && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {fieldExtractorKeys && fieldExtractorKeys.length > 0 ? (
            <select
              value={condition.fieldName ?? ''}
              onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
              className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]"
            >
              <option value="">Select field…</option>
              {fieldExtractorKeys.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          ) : (
            <Input
              placeholder="e.g. orderId"
              className="h-7 text-[12px]"
              value={condition.fieldName ?? ''}
              onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
            />
          )}
          <select
            value={condition.operator}
            onChange={(e) => onChange({ ...condition, operator: e.target.value as BranchCondition['operator'] })}
            className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]"
          >
            {['missing', 'equals', 'not_equals', 'contains', 'not_contains'].map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <Input
            placeholder="expected value"
            className="h-7 text-[12px]"
            value={(condition.expectedValue as string) ?? ''}
            onChange={(e) => onChange({ ...condition, expectedValue: e.target.value })}
          />
        </div>
      )}

      {condition.type === 'metadata' && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <select
            value={condition.fieldName}
            onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
            className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]"
          >
            {CALL_METADATA_FIELDS.filter((f) => f.enabled).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select
            value={condition.operator}
            onChange={(e) => onChange({ ...condition, operator: e.target.value as BranchCondition['operator'] })}
            className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-[12px]"
          >
            {['equals', 'not_equals', 'contains', 'not_contains', 'missing'].map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
          <Input
            placeholder="expected value"
            className="h-7 text-[12px]"
            value={(condition.expectedValue as string) ?? ''}
            onChange={(e) => onChange({ ...condition, expectedValue: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
