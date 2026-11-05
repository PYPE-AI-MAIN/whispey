import { describe, it, expect } from 'vitest'
import { plainToolName, workflowStepNames } from '@/components/calls/v2/split/callData'

const agent = { configuration: { workflow: { nodes: [{ id: 'confirm-slot', name: 'Confirm the slot' }, { id: 'end', name: 'End call' }] } } }

describe('plainToolName', () => {
  const steps = workflowStepNames(agent)

  it('turns a step hand-off into "Moved to <step name>"', () => {
    expect(plainToolName('go_confirm-slot', {}, steps)).toBe('Moved to “Confirm the slot”')
  })

  it('names the fields saved by save_extracted, from an object or a JSON string', () => {
    expect(plainToolName('save_extracted', { new_day: 'Friday', new_time: '11 AM' }, steps)).toBe('Saved new_day, new_time')
    expect(plainToolName('save_extracted', '{"new_day":"Friday"}', steps)).toBe('Saved new_day')
    expect(plainToolName('save_extracted', undefined, steps)).toBe('Saved the answers')
  })

  it('leaves other tools and agents without a workflow alone', () => {
    expect(plainToolName('transfer_call', {}, steps)).toBeNull()
    expect(workflowStepNames({}).size).toBe(0)
  })
})
