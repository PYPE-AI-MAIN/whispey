// Turns one AI Builder reply into a workflow, or says why it can't. Shared by
// the canvas chat (WorkflowChat) and the MCP flow routes, so both accept and
// reject exactly the same things.

import { extractJsonFence } from '@/lib/jsonFence'
import { safeParseWorkflow, type Workflow } from '@/lib/workflow/schema'
import { lintWorkflow, hasErrors } from '@/lib/workflow/linter'
import { extractGlobalRules } from '@/lib/workflow/globalRules'

// The system prompt tells the model to write "__KEEP__" instead of retyping a large
// unchanged prompt/persona field — restore the real value from the current workflow
// here so the model never has to round-trip huge text through its output.
const KEEP_MARKER = '__KEEP__'

export function restoreKeptFields(next: any, current: any): any {
  if (!current) return next
  if (next?.agent?.globalPrompt === KEEP_MARKER) {
    next.agent.globalPrompt = current.agent?.globalPrompt ?? ''
  }
  if (Array.isArray(next?.nodes)) {
    const currentNodesById = new Map<string, any>((current.nodes || []).map((n: any) => [n.id, n]))
    next.nodes = next.nodes.map((n: any) => {
      const orig = currentNodesById.get(n.id)
      if (!orig) return n
      // Whole-node keep: the model output only { id, __keep__: true } instead of
      // retyping a large function/mcp node's headers/tokens/body/params.
      if (n.__keep__ === true) return orig
      const patched = { ...n }
      if (patched.prompt === KEEP_MARKER) patched.prompt = orig.prompt ?? ''
      if (patched.staticText === KEEP_MARKER) patched.staticText = orig.staticText ?? ''
      return patched
    })
  }
  return next
}

export type BuilderOutput =
  | { status: 'none' }
  | { status: 'error'; error: string }
  | { status: 'ok'; workflow: Workflow; warnings: string[] }

export function checkBuilderOutput(assistantContent: string, current: unknown): BuilderOutput {
  const jsonBlockStart = assistantContent.indexOf('```json')
  const hasJsonBlock = jsonBlockStart !== -1 && assistantContent.slice(jsonBlockStart + 7).includes('```')
  const fenced = extractJsonFence(assistantContent)
  const json = typeof fenced === 'object' && fenced !== null ? fenced : null
  if (!json) {
    if (!hasJsonBlock) return { status: 'none' }
    return { status: 'error', error: 'Response JSON was malformed (likely cut off — try a shorter/simpler request)' }
  }

  const parsed = safeParseWorkflow(restoreKeptFields(json, current))
  // safeParse passes on an empty/graph-less workflow (only `start` is
  // required, and it isn't checked against node ids). That renders a blank
  // canvas but shows a misleading "applied" — reject it and say why.
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return { status: 'error', error: `AI returned invalid workflow JSON: ${detail}` }
  }
  if (parsed.data.nodes.length === 0 || !parsed.data.nodes.some((n) => n.id === parsed.data.start)) {
    return {
      status: 'error',
      error:
        'The AI returned a workflow with no usable nodes — the config is too large to convert in one shot. Ask it to "build the flow step by step" (greeting, then patient lookup, then symptoms, …), or paste the flow in a few smaller messages.',
    }
  }

  // "Chat-only" only works if problems surface HERE — the same lint the
  // canvas warning badge runs, since a user who never opens the canvas
  // would otherwise never see a dangling edge or dead-end node at all.
  const issues = lintWorkflow(parsed.data)
  if (hasErrors(issues)) {
    const detail = issues
      .filter((i) => i.severity === 'error')
      .slice(0, 3)
      .map((i) => i.message)
      .join('; ')
    return { status: 'error', error: `AI returned a broken workflow graph: ${detail}` }
  }

  const warnings = issues.filter((i) => i.severity === 'warning').map((i) => i.message)
  // Whatever the builder drew, fold repeated condition edges into global rules so the canvas stays readable.
  const merged = extractGlobalRules(parsed.data)
  return { status: 'ok', workflow: { ...parsed.data, edges: merged.edges, globalRules: merged.globalRules }, warnings }
}

export interface WorkflowSummary {
  node_count: number
  start: string
  nodes: Array<{ id: string; name: string; type: string }>
  edges: number
}

/**
 * What an MCP caller is shown about a flow: its shape only. Prompts, global
 * persona, static text, URLs, headers and code are deliberately left out —
 * clients cannot read prompts back, for flows as for single-prompt agents.
 */
export function summarizeWorkflow(workflow: Workflow): WorkflowSummary {
  const nodes = workflow.nodes
    .filter((n) => n.type !== 'note')
    .map((n) => ({ id: n.id, name: n.name || n.id, type: n.type }))
  return { node_count: nodes.length, start: workflow.start, nodes, edges: workflow.edges.length }
}
