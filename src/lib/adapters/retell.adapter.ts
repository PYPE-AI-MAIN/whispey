// src/lib/adapters/retell.adapter.ts
// Transforms Retell's `call_ended` webhook payload into NormalizedCallData.
// Only this file knows about Retell's payload shape. Nothing else does.

import type { ICallAdapter, NormalizedCallData, NormalizedTurn } from './types'

// ─── Retell payload types ────────────────────────────────────────────────────

export interface RetellTranscriptWord {
  word: string
  start: number
  end: number
}

export interface RetellTranscriptEntry {
  role: 'agent' | 'user'
  content: string
  words?: RetellTranscriptWord[]
}

export interface RetellCall {
  call_id: string
  agent_id: string
  call_type: 'phone_call' | 'web_call'
  from_number?: string
  to_number?: string
  direction?: 'inbound' | 'outbound'
  call_status: string
  start_timestamp?: number    // epoch ms
  end_timestamp?: number      // epoch ms
  duration_ms?: number
  disconnection_reason?: string
  transcript?: string
  transcript_object?: RetellTranscriptEntry[]
  recording_url?: string
  metadata?: Record<string, any>
  retell_llm_dynamic_variables?: Record<string, any>
  opt_out_sensitive_data_storage?: boolean
}

export interface RetellWebhookPayload {
  event: string
  call: RetellCall
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class RetellAdapter implements ICallAdapter<RetellWebhookPayload> {

  canHandle(payload: RetellWebhookPayload): boolean {
    // Retell payloads always have `event` and `call.call_id`
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'event' in payload &&
      'call' in payload &&
      typeof payload.call?.call_id === 'string'
    )
  }

  transform(
    payload: RetellWebhookPayload,
    environment: 'dev' | 'staging' | 'prod'
  ): NormalizedCallData | null {

    // Only process call_ended events
    if (payload.event !== 'call_ended') {
      console.log(`[RetellAdapter] Skipping event: ${payload.event}`)
      return null
    }

    const call = payload.call

    if (!call?.call_id) {
      console.error('[RetellAdapter] Missing call_id')
      return null
    }

    const customerNumber = this.extractCustomerNumber(call)
    const { startedAt, endedAt, durationSeconds } = this.extractTiming(call)
    const turns = this.extractTurns(call, startedAt)
    const endedReason = this.normalizeEndedReason(call.disconnection_reason)

    const normalized: NormalizedCallData = {
      call_id: call.call_id,
      agent_id: call.agent_id || 'unknown',
      recording_url: call.recording_url || '',
      customer_number: customerNumber,
      transcript_with_metrics: turns,
      call_ended_reason: endedReason,
      environment,
      metadata: {
        total_cost: 0,                    // Retell doesn't send cost in call_ended webhook
        total_duration_seconds: durationSeconds,
        call_started_at: startedAt,
        call_ended_at: endedAt,
        summary: '',                      // only available in call_analyzed event
        raw_transcript: call.transcript || '',
        customer_number: customerNumber,
        // Retell-specific extras — stored in metadata, ignored by core pipeline
        retell_call_type: call.call_type,
        retell_direction: call.direction,
        retell_to_number: call.to_number,
        retell_disconnection_reason: call.disconnection_reason,
        retell_dynamic_variables: call.retell_llm_dynamic_variables || {},
      },
    }

    console.log(`[RetellAdapter] ✅ Transformed call ${call.call_id} — ${turns.length} turns, ${durationSeconds}s`)
    return normalized
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private extractCustomerNumber(call: RetellCall): string {
    if (call.call_type === 'web_call') {
      return `web-call-${call.call_id}`
    }
    // Phone call — from_number is the caller for inbound, to_number for outbound
    if (call.direction === 'outbound') {
      return call.to_number || call.from_number || ''
    }
    return call.from_number || ''
  }

  private extractTiming(call: RetellCall): {
    startedAt: string
    endedAt: string
    durationSeconds: number
  } {
    let startedAt = ''
    let endedAt = ''
    let durationSeconds = 0

    // Retell sends timestamps in epoch milliseconds
    if (call.start_timestamp) {
      startedAt = new Date(call.start_timestamp).toISOString()
    }
    if (call.end_timestamp) {
      endedAt = new Date(call.end_timestamp).toISOString()
    }

    // Duration: prefer explicit field, fallback to diff
    if (call.duration_ms && call.duration_ms > 0) {
      durationSeconds = call.duration_ms / 1000
    } else if (call.start_timestamp && call.end_timestamp) {
      durationSeconds = (call.end_timestamp - call.start_timestamp) / 1000
    }

    // Safety fallback
    if (!endedAt) endedAt = new Date().toISOString()
    if (!startedAt && durationSeconds > 0) {
      startedAt = new Date(Date.now() - durationSeconds * 1000).toISOString()
    }

    return { startedAt, endedAt, durationSeconds }
  }

  private extractTurns(call: RetellCall, callStartedAt: string): NormalizedTurn[] {
    const entries = call.transcript_object
    if (!entries || entries.length === 0) return []

    const callStartMs = callStartedAt ? new Date(callStartedAt).getTime() : Date.now()
    const turns: NormalizedTurn[] = []
    let turnId = 1
    let i = 0

    while (i < entries.length) {
      const current = entries[i]

      if (current.role === 'user') {
        // Find the next agent response
        let agentEntry: RetellTranscriptEntry | null = null
        let j = i + 1
        while (j < entries.length) {
          if (entries[j].role === 'agent') {
            agentEntry = entries[j]
            break
          }
          j++
        }

        // Estimate timestamp from word timings if available, else use call start
        const firstWord = current.words?.[0]
        const timestamp = firstWord
          ? Math.floor(callStartMs / 1000 + firstWord.start)
          : Math.floor(callStartMs / 1000)

        turns.push(this.buildTurn(turnId, current.content, agentEntry?.content || '', timestamp))
        turnId++

        // Advance past the agent response we just consumed
        i = agentEntry ? j + 1 : i + 1

      } else if (current.role === 'agent') {
        // Agent-only turn (opening statement with no preceding user input)
        const firstWord = current.words?.[0]
        const timestamp = firstWord
          ? Math.floor(callStartMs / 1000 + firstWord.start)
          : Math.floor(callStartMs / 1000)

        turns.push(this.buildTurn(turnId, '', current.content, timestamp))
        turnId++
        i++
      } else {
        i++
      }
    }

    return turns
  }

  private buildTurn(
    turnId: number,
    userTranscript: string,
    agentResponse: string,
    timestamp: number
  ): NormalizedTurn {
    // Retell's call_ended webhook doesn't include per-turn latency metrics.
    // These are zeroed — Whispey frontend already handles 0 gracefully.
    return {
      turn_id: turnId,
      user_transcript: userTranscript,
      agent_response: agentResponse,
      timestamp,
      stt_metrics: { duration: 0, confidence: 0.95 },
      llm_metrics: {
        ttft: 0,
        total_time: 0,
        tokens: Math.ceil(agentResponse.length / 4), // estimated
      },
      tts_metrics: { ttfb: 0, duration: 0 },
      eou_metrics: { end_of_utterance_delay: 0 },
    }
  }

  private normalizeEndedReason(reason?: string): string {
    if (!reason) return 'completed'
    const r = reason.toLowerCase()
    if (r.includes('hangup') || r.includes('ended') || r.includes('completed')) return 'completed'
    if (r.includes('transfer')) return 'transferred'
    if (r.includes('timeout') || r.includes('exceeded')) return 'timeout'
    if (r.includes('error') || r.includes('failed')) return 'error'
    return 'completed'
  }
}

// Singleton export — no need to instantiate repeatedly
export const retellAdapter = new RetellAdapter()