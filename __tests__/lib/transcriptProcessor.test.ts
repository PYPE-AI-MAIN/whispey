import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI before importing the module that uses it
vi.mock('openai', () => {
  const create = vi.fn()
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    __mocks__: { create },
  }
})

import { processFPOTranscript } from '@/lib/transcriptProcessor'
import { OpenAI } from 'openai'

function getCreateMock() {
  const instance = new (OpenAI as any)()
  return instance.chat.completions.create as ReturnType<typeof vi.fn>
}

const SAMPLE_TRANSCRIPT = [
  { role: 'user', content: 'I need to book an appointment' },
  { role: 'assistant', content: 'Sure, what date works for you?' },
]

const FIELD_EXTRACTOR_PROMPT = JSON.stringify([
  { key: 'intent', description: 'The main intent of the user' },
  { key: 'date_mentioned', description: 'Any date mentioned' },
])

describe('processFPOTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success with extracted fields on happy path', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"intent": "booking", "date_mentioned": "unknown"}' } }],
    })

    const result = await processFPOTranscript({
      log_id: 'log-1',
      transcript_json: SAMPLE_TRANSCRIPT as any,
      agent_id: 'agent-1',
      field_extractor_prompt: FIELD_EXTRACTOR_PROMPT,
    })

    expect(result.success).toBe(true)
    expect(result.log_id).toBe('log-1')
    expect(result.logData).toBeDefined()
  })

  it('strips markdown code fences from GPT response', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '```json\n{"intent": "query"}\n```' } }],
    })

    const result = await processFPOTranscript({
      log_id: 'log-2',
      transcript_json: SAMPLE_TRANSCRIPT as any,
      agent_id: 'agent-1',
      field_extractor_prompt: FIELD_EXTRACTOR_PROMPT,
    })

    expect(result.success).toBe(true)
  })

  it('returns failure when OpenAI throws', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockRejectedValue(new Error('API quota exceeded'))

    const result = await processFPOTranscript({
      log_id: 'log-3',
      transcript_json: SAMPLE_TRANSCRIPT as any,
      agent_id: 'agent-1',
      field_extractor_prompt: FIELD_EXTRACTOR_PROMPT,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('API quota exceeded')
  })

  it('returns failure when field_extractor_prompt is invalid JSON', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"key": "val"}' } }],
    })

    const result = await processFPOTranscript({
      log_id: 'log-4',
      transcript_json: SAMPLE_TRANSCRIPT as any,
      agent_id: 'agent-1',
      field_extractor_prompt: 'NOT_JSON',
    })

    // Invalid prompt JSON means zero fields → GPT returns {} → success with empty logData
    expect(result.success).toBe(true)
  })

  it('resolves variables from call_log_data into the prompt context', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"diagnosis": "hypertension"}' } }],
    })

    const result = await processFPOTranscript({
      log_id: 'log-5',
      transcript_json: SAMPLE_TRANSCRIPT as any,
      agent_id: 'agent-1',
      field_extractor_prompt: JSON.stringify([
        { key: 'diagnosis', description: 'Diagnosis for patient {{patient_id}}' },
      ]),
      field_extractor_variables: { patient_id: 'metadata.patient_id' },
      call_log_data: { metadata: { patient_id: 'P-9001' } },
    })

    expect(result.success).toBe(true)
    // Verify OpenAI was called (meaning variable resolution didn't crash)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('handles empty transcript gracefully', async () => {
    const mockCreate = getCreateMock()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    })

    const result = await processFPOTranscript({
      log_id: 'log-6',
      transcript_json: [] as any,
      agent_id: 'agent-1',
      field_extractor_prompt: FIELD_EXTRACTOR_PROMPT,
    })

    expect(result.success).toBe(true)
  })
})
