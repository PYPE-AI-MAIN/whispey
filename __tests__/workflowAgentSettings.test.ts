import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkflowStore } from '@/stores/workflowStore'
import { parseWorkflow } from '@/lib/workflow/schema'

const base = () => parseWorkflow({ start: 'n1', agent: { llm: { name: 'azure', model: 'gpt-4.1-mini' } }, nodes: [], edges: [] })

describe('workflow agent settings', () => {
  beforeEach(() => useWorkflowStore.getState().setWorkflow(base(), { dirty: false }))

  it('keeps every change when the picker fires provider, model and temperature in one event', () => {
    const { updateAgentLlm } = useWorkflowStore.getState()
    // exactly what ModelSelector does on a model pick
    updateAgentLlm((cur) => ({ ...cur, name: 'groq' }))
    updateAgentLlm((cur) => ({ ...cur, model: 'llama-3.3-70b-versatile' }))
    updateAgentLlm((cur) => ({ ...cur, temperature: 1 }))
    expect(useWorkflowStore.getState().workflow?.agent.llm).toMatchObject({
      name: 'groq', model: 'llama-3.3-70b-versatile', temperature: 1,
    })
    expect(useWorkflowStore.getState().isDirty).toBe(true)
  })

  it('stores a self-hosted endpoint next to the model', () => {
    const { updateAgentLlm } = useWorkflowStore.getState()
    updateAgentLlm((cur) => ({ ...cur, name: 'self_hosted' }))
    updateAgentLlm((cur) => ({ ...cur, model: 'gemma4:e4b-it-qat', base_url: 'https://llm.example/v1' }))
    expect(useWorkflowStore.getState().workflow?.agent.llm).toMatchObject({ name: 'self_hosted', base_url: 'https://llm.example/v1' })
  })

  it('does not strip provider-specific settings when a workflow is loaded', () => {
    const wf = parseWorkflow({
      start: 'n1', nodes: [], edges: [],
      agent: {
        llm: { name: 'self_hosted', model: 'm', base_url: 'https://llm.example/v1' },
        stt: { name: 'sarvam', model: 'saaras:v4', language: 'unknown', mode: 'translate', adaptive_stt: true },
        tts: { name: 'sarvam', voice_id: 'shubh', model: 'bulbul:v3', pace: 1.1 },
      },
    })
    expect(wf.agent.llm).toMatchObject({ base_url: 'https://llm.example/v1' })
    expect(wf.agent.stt).toMatchObject({ mode: 'translate', adaptive_stt: true })
    expect(wf.agent.tts).toMatchObject({ pace: 1.1 })
  })
})
