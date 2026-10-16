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

describe('workflowStore undo until deploy', () => {
  const load = () => {
    useWorkflowStore.setState({ workflow: null, isDirty: false, past: [], future: [] })
    useWorkflowStore.getState().setWorkflow(sampleWorkflow(), { dirty: false })
    return useWorkflowStore.getState().workflow!.nodes[0].id
  }

  it('undoes and redoes a change', () => {
    const id = load()
    const before = useWorkflowStore.getState().workflow!.nodes[0].name
    useWorkflowStore.getState().updateNode(id, { name: 'Renamed' })
    expect(useWorkflowStore.getState().workflow!.nodes[0].name).toBe('Renamed')
    useWorkflowStore.getState().undo()
    expect(useWorkflowStore.getState().workflow!.nodes[0].name).toBe(before)
    useWorkflowStore.getState().redo()
    expect(useWorkflowStore.getState().workflow!.nodes[0].name).toBe('Renamed')
  })

  it('counts typing in one field as one undo step', () => {
    const id = load()
    const before = useWorkflowStore.getState().workflow!.nodes[0].name
    for (const name of ['R', 'Re', 'Ren', 'Rena']) useWorkflowStore.getState().updateNode(id, { name })
    expect(useWorkflowStore.getState().past).toHaveLength(1)
    useWorkflowStore.getState().undo()
    expect(useWorkflowStore.getState().workflow!.nodes[0].name).toBe(before)
  })

  it('lets a template or AI change applied over your work be undone, but not the first load', () => {
    load()
    expect(useWorkflowStore.getState().past).toHaveLength(0)
    const mine = useWorkflowStore.getState().workflow!
    useWorkflowStore.getState().setWorkflow(sampleWorkflow())
    expect(useWorkflowStore.getState().past).toHaveLength(1)
    useWorkflowStore.getState().undo()
    expect(useWorkflowStore.getState().workflow).toEqual(mine)
  })

  it('remembers a move with a snapshot, and forgets everything at deploy', () => {
    const id = load()
    useWorkflowStore.getState().snapshot()
    useWorkflowStore.getState().updatePositions([{ id, position: { x: 999, y: 999 } }])
    expect(useWorkflowStore.getState().past).toHaveLength(1)
    useWorkflowStore.getState().undo()
    expect(useWorkflowStore.getState().workflow!.nodes[0].position).not.toEqual({ x: 999, y: 999 })
    useWorkflowStore.getState().markClean()
    expect(useWorkflowStore.getState().past).toHaveLength(0)
    expect(useWorkflowStore.getState().future).toHaveLength(0)
  })
})

describe('deleting a step', () => {
  it('is one undo, even though its connections are reported as deleted too', () => {
    useWorkflowStore.setState({ workflow: null, isDirty: false, past: [], future: [] })
    useWorkflowStore.getState().setWorkflow(sampleWorkflow(), { dirty: false })
    const wf = useWorkflowStore.getState().workflow!
    const edge = wf.edges[0]
    const { removeEdge, removeNode, undo } = useWorkflowStore.getState()
    removeEdge(edge.id)
    removeNode(edge.target)
    expect(useWorkflowStore.getState().past).toHaveLength(1)
    undo()
    const back = useWorkflowStore.getState().workflow!
    expect(back.nodes.some((n) => n.id === edge.target)).toBe(true)
    expect(back.edges.some((e) => e.id === edge.id)).toBe(true)
  })
})
