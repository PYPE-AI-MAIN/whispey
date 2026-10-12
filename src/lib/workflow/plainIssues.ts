import type { LintIssue } from './linter'
import type { Workflow } from './schema'

/**
 * The linter speaks in node ids and engine terms (it mirrors the backend). People building a flow need
 * to read what is wrong and what to do about it, so this turns each message into plain words.
 */
export function explainIssue(issue: LintIssue, wf: Pick<Workflow, 'nodes'> | null | undefined): string {
  const stepName = (id: string) => wf?.nodes.find((n) => n.id === id)?.name || id
  const m = issue.message
  const rules: Array<[RegExp, (r: RegExpExecArray) => string]> = [
    [/is unreachable from start/, () => 'Nothing leads to this step, so the call can never reach it. Connect an earlier step to it, or delete it.'],
    [/is a dead-end \(no outgoing edges\)/, () => 'This step has no way forward, so the call would stop here. Add what comes next, or end the call.'],
    [/skips the user response, so its condition edges/, () => 'This step moves on without waiting for a reply, so "when the caller says" connections from it never fire. Make them "Next step", or turn off "Move on without waiting for a reply".'],
    [/has more than one (\w+) edge — only the first is ever taken/, (r) => `This step has two "${r[1]}" connections and only the first is used. Make the second one "When the caller says something".`],
    [/has no Fallback edge — if the (\w+) call fails/, () => 'If this call to another system fails, the agent carries on as if it worked. Add an "Otherwise" connection to handle a failure.'],
    [/has a logic edge but is a/, () => 'Branch rules only work from a Branch step. Change this connection to "Next step".'],
    [/condition edge needs condition text/, () => 'A "when the caller says" connection has no description. Click it and fill in "Describe when".'],
    [/logic edge needs an expression/, () => 'A branch connection has no rule yet. Click it and choose a detail, a comparison and a value.'],
    [/condition edges are only meaningful on/, () => '"When the caller says" only works from a step that talks with the caller. Change this connection to "Next step".'],
    [/is a note node — it only exists on the canvas/, () => 'A connection leads to a sticky note, which does nothing. Point it at a real step.'],
    [/references undeclared variable\(s\) ([^—]+) —/, (r) => `This uses ${r[1].trim()}, which is not set up. Add it under Setup, then Variables, or fix the spelling.`],
    [/logic expression '.*' reads undeclared variable\(s\) ([^—]+) —/, (r) => `A branch rule uses ${r[1].trim()}, which does not exist yet. Collect it in an earlier step or add it under Variables.`],
    [/variable '([^']+)' is written by (\d+) nodes/, (r) => `Several steps save into "${r[1]}", and later ones overwrite earlier ones. Use a different name for each.`],
    [/requires the telephony transport/, () => 'This step only works on phone calls. Turn on Telephony under Setup, then Voice, model and language.'],
    [/No transport enabled/, () => 'Turn on Web calls or Telephony under Setup, then Voice, model and language.'],
    [/conversation node needs a prompt or static text/, () => 'Write what the agent should say or do on this step.'],
    [/function node needs a url/, () => 'Enter the web address this step should call.'],
    [/call_transfer node needs a destination/, () => 'Enter the phone number to transfer to.'],
    [/extract_variable node has no extractions/, () => 'Add at least one detail to collect.'],
    [/code node needs source/, () => 'Write the code this step should run.'],
    [/mcp node needs a server and tool/, () => 'Choose the tool server and the tool to use.'],
    [/is a knowledge step — the call would open mid-answer/, () => 'The call would start by searching your documents instead of greeting the caller. Start with the greeting step.'],
    [/the call starts at a (\w+) step/, () => 'The call does not start with a conversation step. Usually the greeting step should be first.'],
    [/knowledge base should be an agent ID/, () => 'The "use another agent\'s documents" box should be empty, or hold an agent ID, not a sentence.'],
    [/targets .* map to the same tool name|has several tools named/, () => 'Two connections or actions on this step end up with the same name. Rename one of the steps.'],
    [/attaches '.*', which is not a function node/, () => 'An action ticked on this step is not a "Call an API" step, so it is ignored.'],
  ]
  for (const [re, say] of rules) {
    const r = re.exec(m)
    if (r) return say(r)
  }
  return m.replaceAll(/'([^']+)'/g, (full, id: string) => (wf?.nodes.some((n) => n.id === id) ? `"${stepName(id)}"` : full))
}
