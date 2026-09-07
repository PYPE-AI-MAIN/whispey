import { create } from 'zustand'
import type { Workflow, WorkflowNode, Edge, AgentConfig, VarType } from '@/lib/workflow/schema'
import { lintWorkflow, type LintIssue, collectAllVarRefs, knownVariableNames } from '@/lib/workflow/linter'

interface WorkflowState {
  workflow: Workflow | null
  isDirty: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  past: Workflow[]
  future: Workflow[]
  lintIssues: LintIssue[]
  activeNodeId: string | null
  /** Whether the AI Builder chat is currently generating/streaming a response —
   *  read by the canvas to show a working indicator, since chat and canvas are
   *  separate components and this is the only state they share. */
  chatStreaming: boolean
  /** Bumped whenever the whole workflow is swapped (chat apply, template pick,
   *  undo/redo) so the canvas knows to re-fit the viewport — incremental edits
   *  (addNode, updateNode, ...) don't touch this, so the camera doesn't jump
   *  around during normal editing. */
  replaceCount: number

  /** `dirty` defaults to true: most callers (template pick, AI Builder apply,
   *  JSON import) are applying content that has never been deployed, so it
   *  must be treated as unsaved. Only loading the agent's already-deployed
   *  config on page load should pass `{ dirty: false }` — otherwise Start
   *  Agent's "deploy first if dirty" check never fires for a workflow that
   *  was never actually sent to the backend, and Start just fails/no-ops. */
  setWorkflow: (wf: Workflow, opts?: { dirty?: boolean }) => void
  addNode: (node: WorkflowNode) => void
  removeNode: (nodeId: string) => void
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void
  addEdge: (edge: Edge) => void
  removeEdge: (edgeId: string) => void
  updateEdge: (edgeId: string, patch: Partial<Edge>) => void
  updatePositions: (changes: { id: string; position: { x: number; y: number } }[]) => void
  setSelectedNode: (id: string | null) => void
  setSelectedEdge: (id: string | null) => void
  updateAgentConfig: (patch: Partial<AgentConfig>) => void
  patchWorkflow: (patch: Partial<Workflow>) => void
  setStart: (nodeId: string) => void
  undo: () => void
  redo: () => void
  markClean: () => void
  setActiveNode: (id: string | null) => void
  setChatStreaming: (v: boolean) => void
}

const MAX_UNDO = 50

function pushUndo(state: WorkflowState): Pick<WorkflowState, 'past' | 'future'> {
  if (!state.workflow) return { past: state.past, future: state.future }
  const past = [...state.past, structuredClone(state.workflow)].slice(-MAX_UNDO)
  return { past, future: [] }
}

function relint(wf: Workflow | null): LintIssue[] {
  if (!wf) return []
  try { return lintWorkflow(wf) } catch { return [] }
}

/** Auto-declares any {{ref}} typed into a templated field (prompt, message,
 * url, ...) as a top-level variable, so self-serve users don't also have to
 * visit the Variables tab by hand for something they already named inline. */
function withAutoVars(wf: Workflow): Workflow {
  try {
    const known = knownVariableNames(wf)
    const newRefs = collectAllVarRefs(wf).filter((r) => !known.has(r))
    if (!newRefs.length) return wf
    return { ...wf, variables: [...wf.variables, ...newRefs.map((key) => ({ key, type: 'string' as VarType }))] }
  } catch {
    return wf
  }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: null,
  isDirty: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],
  lintIssues: [],
  activeNodeId: null,
  chatStreaming: false,
  replaceCount: 0,

  setWorkflow: (wf, opts) =>
    set((s) => {
      const workflow = withAutoVars(wf)
      return {
        workflow,
        isDirty: opts?.dirty ?? true,
        past: [],
        future: [],
        lintIssues: relint(workflow),
        selectedNodeId: null,
        selectedEdgeId: null,
        replaceCount: s.replaceCount + 1,
      }
    }),

  addNode: (node) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = withAutoVars({ ...s.workflow, nodes: [...s.workflow.nodes, node] })
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  removeNode: (nodeId) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const remaining = s.workflow.nodes.filter((n) => n.id !== nodeId)
      const workflow = {
        ...s.workflow,
        nodes: remaining,
        edges: s.workflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        start: s.workflow.start === nodeId ? (remaining[0]?.id ?? '') : s.workflow.start,
      }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow), selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId }
    }),

  updateNode: (nodeId, patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = withAutoVars({
        ...s.workflow,
        nodes: s.workflow.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } as WorkflowNode : n)),
      })
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  addEdge: (edge) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, edges: [...s.workflow.edges, edge] }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  removeEdge: (edgeId) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, edges: s.workflow.edges.filter((e) => e.id !== edgeId) }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow), selectedEdgeId: s.selectedEdgeId === edgeId ? null : s.selectedEdgeId }
    }),

  updateEdge: (edgeId, patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = {
        ...s.workflow,
        edges: s.workflow.edges.map((e) => (e.id === edgeId ? { ...e, ...patch } : e)),
      }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  updatePositions: (changes) =>
    set((s) => {
      if (!s.workflow) return s
      const posMap = new Map(changes.map((c) => [c.id, c.position]))
      const workflow = {
        ...s.workflow,
        nodes: s.workflow.nodes.map((n) => {
          const pos = posMap.get(n.id)
          return pos ? { ...n, position: pos } as WorkflowNode : n
        }),
      }
      // ponytail: no undo push for drags — too noisy. isDirty yes.
      return { workflow, isDirty: true }
    }),

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),

  updateAgentConfig: (patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = withAutoVars({ ...s.workflow, agent: { ...s.workflow.agent, ...patch } })
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  patchWorkflow: (patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = withAutoVars({ ...s.workflow, ...patch })
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  setStart: (nodeId) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, start: nodeId }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  undo: () =>
    set((s) => {
      if (!s.past.length || !s.workflow) return s
      const prev = s.past[s.past.length - 1]
      return {
        workflow: prev,
        past: s.past.slice(0, -1),
        future: [structuredClone(s.workflow), ...s.future],
        isDirty: true,
        lintIssues: relint(prev),
        replaceCount: s.replaceCount + 1,
      }
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length || !s.workflow) return s
      const next = s.future[0]
      return {
        workflow: next,
        past: [...s.past, structuredClone(s.workflow)],
        future: s.future.slice(1),
        isDirty: true,
        lintIssues: relint(next),
        replaceCount: s.replaceCount + 1,
      }
    }),

  markClean: () => set({ isDirty: false }),
  setActiveNode: (id) => set({ activeNodeId: id }),
  setChatStreaming: (v) => set({ chatStreaming: v }),
}))
