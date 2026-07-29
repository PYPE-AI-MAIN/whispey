import { create } from 'zustand'
import type { Workflow, WorkflowNode, Edge, AgentConfig } from '@/lib/workflow/schema'
import { lintWorkflow, type LintIssue } from '@/lib/workflow/linter'

interface WorkflowState {
  workflow: Workflow | null
  isDirty: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  past: Workflow[]
  future: Workflow[]
  lintIssues: LintIssue[]
  activeNodeId: string | null

  setWorkflow: (wf: Workflow) => void
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

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflow: null,
  isDirty: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  past: [],
  future: [],
  lintIssues: [],
  activeNodeId: null,

  setWorkflow: (wf) =>
    set({ workflow: wf, isDirty: false, past: [], future: [], lintIssues: relint(wf), selectedNodeId: null, selectedEdgeId: null }),

  addNode: (node) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, nodes: [...s.workflow.nodes, node] }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  removeNode: (nodeId) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = {
        ...s.workflow,
        nodes: s.workflow.nodes.filter((n) => n.id !== nodeId),
        edges: s.workflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow), selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId }
    }),

  updateNode: (nodeId, patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = {
        ...s.workflow,
        nodes: s.workflow.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } as WorkflowNode : n)),
      }
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

  setSelectedNode: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : undefined }),
  setSelectedEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : undefined }),

  updateAgentConfig: (patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, agent: { ...s.workflow.agent, ...patch } }
      return { ...undo, workflow, isDirty: true, lintIssues: relint(workflow) }
    }),

  patchWorkflow: (patch) =>
    set((s) => {
      if (!s.workflow) return s
      const undo = pushUndo(s)
      const workflow = { ...s.workflow, ...patch }
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
      }
    }),

  markClean: () => set({ isDirty: false }),
  setActiveNode: (id) => set({ activeNodeId: id }),
}))
