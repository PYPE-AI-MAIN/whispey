'use client'

import { Loader2, Settings2 } from 'lucide-react'
import FieldExtractorDialog from '@/components/FieldExtractorLogs'

interface FieldExtractorItem {
  key: string
  description: string
}

export default function OutputVariablesPanel({
  agentId,
  fieldExtractorPrompt,
  fieldExtractorVariables,
  fieldExtractorEnabled,
  latestValues,
  loading,
  inProgress,
  canEdit = true,
  onSaved,
}: Readonly<{
  agentId: string
  /** Raw JSON string, as stored on the agent row (may be empty/invalid). */
  fieldExtractorPrompt: string | null | undefined
  fieldExtractorVariables: Record<string, string> | null | undefined
  fieldExtractorEnabled: boolean
  /** transcription_metrics from the most recent completed call, if any. */
  latestValues: Record<string, string> | null | undefined
  /** Still resolving the last call (initial mount, or a call just ended and hasn't landed yet). */
  loading?: boolean
  /** A test call is live right now — values shown would be from a call before this one. */
  inProgress?: boolean
  /** Whether this member may edit the extractor (mirrors the API's visibility gate). */
  canEdit?: boolean
  onSaved: () => void
}>) {
  let fields: FieldExtractorItem[] = []
  try {
    const parsed = JSON.parse(fieldExtractorPrompt || '[]')
    if (Array.isArray(parsed)) fields = parsed.filter((f) => f?.key)
  } catch {
    // malformed config — treat as unset, dialog starts fresh
  }

  const configured = fieldExtractorEnabled && fields.length > 0

  // Nothing to show and nothing they're allowed to change — leave it out.
  if (!canEdit && !configured) return null

  const handleSave = async (data: FieldExtractorItem[], enabled: boolean, variables: Record<string, string>) => {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_extractor_prompt: JSON.stringify(data),
        field_extractor: enabled,
        field_extractor_variables: variables,
      }),
    })
    if (res.ok) {
      onSaved()
    } else {
      const j = await res.json().catch(() => ({}))
      console.error('[Studio] saving dispositions failed:', j.error || res.statusText)
      alert("We couldn't save your dispositions. Please try again, or refresh the page.")
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          Dispositions
          {configured && loading && <Loader2 className="h-3 w-3 animate-spin text-gray-300 dark:text-gray-600" />}
        </span>
        {/* Same trigger the full config page uses for this exact dialog — left
            as-is rather than re-skinned, so it stays visually consistent with
            the rest of the app instead of risking a mismatched override. */}
        {canEdit && (
        <FieldExtractorDialog
          initialData={fields.length > 0 ? fields : []}
          initialVariables={fieldExtractorVariables || {}}
          isEnabled={fieldExtractorEnabled}
          terminology="dispositions"
          onSave={handleSave}
        />
        )}
      </div>

      {!configured ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center dark:border-gray-800">
          <Settings2 className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Nothing extracted yet</p>
          <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            Define the dispositions to pull out of each call and they'll be computed
            automatically right after the call ends.
          </p>
        </div>
      ) : inProgress ? (
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center dark:border-gray-800">
          <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            Call in progress — values from this call will show up once it ends.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          {fields.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400">{f.key}</span>
              <span className="truncate text-right text-gray-900 dark:text-gray-100">
                {loading ? (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin text-gray-300 dark:text-gray-600" />
                ) : (
                  (latestValues?.[f.key] ?? <span className="text-gray-300 dark:text-gray-600">—</span>)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
