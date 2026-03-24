import type { CallLog } from '@/types/logs'

/** Remove tag fields from rows when the caller is a viewer (server-side response shaping). */
export function redactTagsFromCallLogsForViewer(rows: CallLog[]): CallLog[] {
  return rows.map((row) => {
    const tm = row.transcription_metrics
    if (!tm || typeof tm !== 'object' || Array.isArray(tm)) return row
    const next = { ...(tm as Record<string, unknown>) }
    delete next.tags
    delete next.tagComments
    return { ...row, transcription_metrics: next }
  })
}
