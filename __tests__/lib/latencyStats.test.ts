import { describe, it, expect } from 'vitest'
import { computeConversationMetrics, formatLatency, isVapiAgentConfig, latencyTone, type LatencyTurn } from '@/lib/latencyStats'

// A full turn: the caller spoke, the agent answered, every stage reported.
const turn = (over: Partial<LatencyTurn> = {}): LatencyTurn => ({
  user_transcript: 'hello',
  agent_response: 'hi there',
  stt_metrics: { duration: 0.3 },
  llm_metrics: { ttft: 0.5 },
  tts_metrics: { ttfb: 0.2, duration: 0.1 },
  eou_metrics: { end_of_utterance_delay: 0.4 },
  ...over,
})

describe('computeConversationMetrics', () => {
  it('collects each stage and the combined latencies of a turn', () => {
    const m = computeConversationMetrics([turn()], false)
    expect(m.totalTurns).toBe(1)
    expect(m.stt).toEqual([0.3])
    expect(m.llm).toEqual([0.5])
    expect(m.tts).toEqual([0.2])
    expect(m.eou).toEqual([0.4])
    // agent response = LLM first token + TTS first byte + TTS duration
    expect(m.agentResponseLatencies[0]).toBeCloseTo(0.8)
    // non-Vapi agents leave STT out of the turn total
    expect(m.totalTurnLatencies[0]).toBeCloseTo(0.8)
    // end to end = end-of-utterance + LLM + TTS
    expect(m.endToEndLatencies[0]).toBeCloseTo(1.2)
  })

  it('counts STT in the totals for Vapi agents', () => {
    const m = computeConversationMetrics([turn()], true)
    expect(m.totalTurnLatencies[0]).toBeCloseTo(1.1)
    expect(m.endToEndLatencies[0]).toBeCloseTo(1.5)
  })

  it('skips combined figures a turn cannot support', () => {
    const agentOnly = turn({ user_transcript: '', eou_metrics: undefined })
    const noTts = turn({ tts_metrics: undefined })
    const silent = turn({ llm_metrics: undefined, tts_metrics: { ttfb: 0, duration: 0 }, stt_metrics: undefined })
    const m = computeConversationMetrics([agentOnly, noTts, silent], false)
    // agent-only turn has no user text; the no-TTS turn has no TTS; the silent one has no LLM
    expect(m.agentResponseLatencies).toHaveLength(0)
    expect(m.endToEndLatencies).toHaveLength(0)
    // a turn whose TTS took no time adds nothing to the totals
    expect(m.totalTurnLatencies.every((v) => v > 0)).toBe(true)
  })

  it('summarises each list with avg, min, max, p50 and p75', () => {
    const turns = [0.1, 0.2, 0.3, 0.4].map((ttft) => turn({ llm_metrics: { ttft } }))
    const { llmStats } = computeConversationMetrics(turns, false)
    expect(llmStats.count).toBe(4)
    expect(llmStats.min).toBe(0.1)
    expect(llmStats.max).toBe(0.4)
    expect(llmStats.avg).toBeCloseTo(0.25)
    expect(llmStats.p50).toBe(0.2)
    expect(llmStats.p75).toBe(0.3)
  })

  it('returns zeros when nothing was measured', () => {
    const m = computeConversationMetrics([], false)
    expect(m.totalTurns).toBe(0)
    expect(m.endToEndStats).toEqual({ avg: 0, min: 0, max: 0, count: 0, p50: 0, p75: 0 })
    expect(m.p50TotalLatency).toBe(0)
    expect(m.p50AgentResponseTime).toBe(0)
    expect(m.p50EndToEndLatency).toBe(0)
  })
})

describe('isVapiAgentConfig', () => {
  it('recognises Vapi agents by keys, config or type', () => {
    expect(isVapiAgentConfig(null)).toBe(false)
    expect(isVapiAgentConfig({ agent_type: 'pype_agent' })).toBe(false)
    expect(isVapiAgentConfig({ vapi_api_key_encrypted: 'a', vapi_project_key_encrypted: 'b' })).toBe(true)
    expect(isVapiAgentConfig({ vapi_api_key_encrypted: 'a' })).toBe(false)
    expect(isVapiAgentConfig({ configuration: { vapi: { assistantId: 'x' } } })).toBe(true)
    expect(isVapiAgentConfig({ agent_type: 'vapi' })).toBe(true)
  })
})

describe('latencyTone', () => {
  it('grades each stage against its own thresholds', () => {
    expect(latencyTone(0.5, 'stt')).toBe('good')
    expect(latencyTone(1.5, 'stt')).toBe('fair')
    expect(latencyTone(2.5, 'stt')).toBe('poor')
    expect(latencyTone(0.4, 'eou')).toBe('good')
    expect(latencyTone(2, 'llm')).toBe('fair')
    expect(latencyTone(5, 'total')).toBe('fair')
    expect(latencyTone(4, 'e2e')).toBe('good')
    expect(latencyTone(9, 'e2e')).toBe('poor')
    expect(latencyTone(1, 'tts')).toBe('good')
  })
})

describe('formatLatency', () => {
  it('shows milliseconds under a second and seconds above', () => {
    expect(formatLatency(0.25)).toBe('250ms')
    expect(formatLatency(1.234)).toBe('1.2s')
  })
})
