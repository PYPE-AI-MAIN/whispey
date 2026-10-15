import { EXCLUDED_METADATA_COLUMNS } from "@/lib/metadataColumnDenylist"
import type { CallLog } from "@/types/logs"

// transcription_metrics keys that are not dispositions: tag/flag/QA state the
// app writes itself, and the summary, which is shown on its own.
const NON_DISPOSITION_KEYS = new Set(["tags", "tagComments", "flag", "qa", "call_summary"])

export const SUMMARY_FIELD = "call_summary"

/** Field-extractor keys configured on the agent (the raw `key`s, as stored on calls). */
export function extractorKeys(agent: { field_extractor_prompt?: unknown } | null | undefined): string[] {
  const raw = agent?.field_extractor_prompt
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed.map((f: { key?: string }) => f?.key).filter((k): k is string => !!k) : []
  } catch {
    return []
  }
}

/**
 * The call's summary — only when the agent has a `call_summary` field-extractor
 * field. Agents without one show no summary at all rather than a fallback.
 */
export function callSummary(call: CallLog, hasSummaryField: boolean): string | null {
  if (!hasSummaryField) return null
  const value = call.transcription_metrics?.[SUMMARY_FIELD]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** Dispositions vs yes/no QA checks (`is_*` booleans), both from transcription_metrics. */
export function splitTranscriptionMetrics(call: CallLog) {
  const tm: Record<string, unknown> = call.transcription_metrics ?? {}
  const dispositions: Array<[string, unknown]> = []
  const checks: Array<[string, unknown]> = []
  for (const [key, value] of Object.entries(tm)) {
    if (NON_DISPOSITION_KEYS.has(key)) continue
    if (key.startsWith("is_") && (typeof value === "boolean" || value === null)) checks.push([key, value])
    else dispositions.push([key, value])
  }
  return { dispositions, checks }
}

export function visibleMetadata(call: CallLog): Array<[string, unknown]> {
  const meta: Record<string, unknown> = call.metadata && typeof call.metadata === "object" ? call.metadata : {}
  return Object.entries(meta).filter(([key]) => key !== WORKFLOW_PATH_KEY && !EXCLUDED_METADATA_COLUMNS.includes(key))
}

const WORKFLOW_PATH_KEY = "workflow_path"

/** The steps a workflow call went through, in order (the voice agent writes them joined by " > "). */
export function workflowPath(call: CallLog): string[] {
  const raw = call.metadata && typeof call.metadata === "object" ? (call.metadata as Record<string, unknown>)[WORKFLOW_PATH_KEY] : null
  return typeof raw === "string" && raw ? raw.split(" > ") : []
}

/**
 * Whether this person may see the customer's number. The agent's call-log
 * settings can hide it per person/role; the server then leaves the field out
 * of the call entirely, which is what this reads.
 */
export const isNumberHidden = (call: CallLog) => !("customer_number" in call)

/** How a call is named on screen: its number, or its id when the number is hidden (or it's a web call). */
export function callLabel(call: CallLog): { text: string; isId: boolean } {
  if (call.customer_number) return { text: call.customer_number, isId: false }
  return { text: `…${(call.call_id || call.id).slice(-8)}`, isId: true }
}

const PHONE_LIKE = /\+?\d[\d\s-]{8,}\d/g
/** Masks anything that looks like a phone number. */
export function maskNumbers(value: string): string {
  return value.replaceAll(PHONE_LIKE, "•••• ••••")
}

const showAsIs = (value: string) => value

/** How to show a call's text: numbers masked for people the call's number is hidden from, as-is otherwise. */
export function numberMaskFor(call: CallLog): (value: string) => string {
  return isNumberHidden(call) ? maskNumbers : showAsIs
}

/** A tool call's arguments as text: kept as-is when already a string, pretty JSON otherwise. */
const UNSAFE_TOOL_CHARS = /[^a-zA-Z0-9_-]+/g

/** A workflow step's hand-off tool is named go_<step id> on the voice agent; this maps those names back to the step's name. */
export function workflowStepNames(agent: any): Map<string, string> {
  const nodes = agent?.configuration?.workflow?.nodes
  const names = new Map<string, string>()
  if (!Array.isArray(nodes)) return names
  for (const n of nodes) {
    if (!n?.id) continue
    const safe = String(n.id).replaceAll(UNSAFE_TOOL_CHARS, "_").replace(/^_+|_+$/g, "") || "node"
    names.set(`go_${safe}`, n.name || String(n.id))
  }
  return names
}

function argumentKeys(args: unknown): string[] {
  try {
    const parsed = typeof args === "string" ? JSON.parse(args) : args
    return parsed && typeof parsed === "object" ? Object.keys(parsed) : []
  } catch {
    return []
  }
}

/** What a workflow tool call means in plain words, or null for any other tool. */
export function plainToolName(name: string, args: unknown, steps: Map<string, string>): string | null {
  const step = steps.get(name)
  if (step) return `Moved to “${step}”`
  if (name !== "save_extracted") return null
  const keys = argumentKeys(args)
  return keys.length ? `Saved ${keys.join(", ")}` : "Saved the answers"
}

export function toolArgumentsText(args: unknown): string | null {
  if (args == null) return null
  return typeof args === "string" ? args : JSON.stringify(args, null, 2)
}

export function relativeTime(iso: string | null | undefined): string {
  const at = utcSeconds(iso)
  if (at === null) return ""
  const diff = Date.now() / 1000 - at
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 172800) return "Yesterday"
  return new Date(at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/**
 * Seconds into the recording for a metrics-log turn. Turns rebuilt from
 * transcript_json carry their index, not a time, so have none.
 */
export function turnOffsetSeconds(unixTimestamp: number | undefined, timeZero: number | null): number | null {
  if (!unixTimestamp || unixTimestamp < 1e9 || timeZero === null) return null
  return Math.max(0, unixTimestamp - timeZero)
}

/** Epoch seconds for a stored timestamp; call_logs keeps UTC without a zone suffix. */
export function utcSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(ms) ? null : ms / 1000
}

/**
 * The epoch second the recording starts at. Recordings start with the call, so
 * call_started_at — checked against real recordings, turns land within about a
 * second. When the start time doesn't fit the turns (missing or skewed), the
 * first turn is used instead so offsets stay sensible.
 */
export function recordingTimeZero(turns: Array<{ unix_timestamp?: number }>, callStartedAt: string | null | undefined): number | null {
  const times = turns.map((t) => t.unix_timestamp).filter((t): t is number => typeof t === "number" && t >= 1e9)
  if (!times.length) return null
  const first = Math.min(...times)
  const start = utcSeconds(callStartedAt)
  return start !== null && first - start >= -1 && first - start <= 60 ? start : first
}

export interface TranscriptCue {
  /** `${turn.id}:user` or `${turn.id}:agent` */
  key: string
  start: number
}

// Durations come in seconds or milliseconds; anything over 100 is taken as milliseconds.
function cueSeconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return value > 100 ? value / 1000 : value
}

/**
 * Where each bubble starts in the recording. A turn's timestamp is when the
 * agent starts replying; the customer spoke just before it, for their audio
 * length plus the end-of-turn wait.
 */
export function transcriptCues(
  turns: Array<{ id: string; unix_timestamp?: number; user_transcript?: string; agent_response?: string; stt_metrics?: any; eou_metrics?: any; tts_metrics?: any }>,
  timeZero: number | null
): TranscriptCue[] {
  const timed = turns
    .map((turn) => ({ turn, offset: turnOffsetSeconds(turn.unix_timestamp, timeZero) }))
    .filter((t): t is { turn: (typeof turns)[number]; offset: number } => t.offset !== null)
    .sort((a, b) => a.offset - b.offset)
  const cues: TranscriptCue[] = []
  // When the agent's previous line finished playing — the customer can't have
  // started talking before then.
  let agentDoneAt: number | null = null
  for (const { turn, offset } of timed) {
    if (turn.user_transcript) {
      // Counting back from the reply by the customer's audio length is often too
      // short (a long greeting, a missing STT duration), which lit their bubble
      // late. The end of the agent's last line is a safer floor, so take the earlier.
      const spoken = cueSeconds(turn.stt_metrics?.audio_duration) + cueSeconds(turn.eou_metrics?.end_of_utterance_delay)
      const fromReply = offset - spoken
      const start = agentDoneAt !== null && agentDoneAt < fromReply ? agentDoneAt : fromReply
      cues.push({ key: `${turn.id}:user`, start: Math.max(0, start) })
    }
    if (turn.agent_response) {
      cues.push({ key: `${turn.id}:agent`, start: offset })
      const speaking = cueSeconds(turn.tts_metrics?.audio_duration)
      agentDoneAt = speaking > 0 ? offset + speaking : null
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

/** The bubble being heard at `seconds`: the last one that has started. */
export function activeCueKey(cues: TranscriptCue[], seconds: number): string | null {
  let key: string | null = null
  for (const cue of cues) {
    if (cue.start > seconds + 0.2) break
    key = cue.key
  }
  return key
}

export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

/**
 * The call's length. duration_seconds is not filled in for every call (some
 * agents never report it), so fall back to the start/end times.
 */
export function callDurationSeconds(call: Pick<CallLog, "duration_seconds" | "call_started_at" | "call_ended_at">): number | null {
  if (typeof call.duration_seconds === "number" && call.duration_seconds > 0) return call.duration_seconds
  const start = utcSeconds(call.call_started_at)
  const end = utcSeconds(call.call_ended_at)
  return start !== null && end !== null && end > start ? Math.round(end - start) : null
}

// Extractors write these strings when a field wasn't found; they mean "no value".
const EMPTY_STRINGS = new Set(["null", "none", "undefined", "n/a", "na", "nan", "-"])

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value === "string" && EMPTY_STRINGS.has(value.trim().toLowerCase())) return ""
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") return String(value)
  return ""
}
