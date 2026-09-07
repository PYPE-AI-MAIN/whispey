import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from '@/stores/workflowStore'
import { WORKFLOW_TEMPLATES } from '@/lib/workflow/templates'

const sampleWorkflow = () => WORKFLOW_TEMPLATES[0].build('test-agent')

describe('workflowStore.setWorkflow', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ workflow: null, isDirty: false })
  })

  it('defaults to dirty — template pick / AI Builder apply / JSON import all hand it content that was never deployed', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow())
    expect(useWorkflowStore.getState().isDirty).toBe(true)
  })

  it('is clean when the caller explicitly says so (loading the already-deployed config)', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow(), { dirty: false })
    expect(useWorkflowStore.getState().isDirty).toBe(false)
  })
})
