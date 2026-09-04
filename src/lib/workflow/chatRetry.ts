/**
 * Decides whether a failed AI Builder response is worth one automatic
 * self-correction retry (WorkflowChat.tsx) before surfacing the error to
 * whoever is self-serving a workflow.
 *
 * Malformed/cut-off JSON is a generation-length problem a same-request retry
 * won't fix (the user-facing message already says "try a shorter request").
 * Invalid schema, an empty/unusable graph, and lint errors are concrete,
 * itemized mistakes (a dangling edge, {{var}} in a code node, a missing
 * fallback) the model can plausibly fix given the exact error text.
 */
export function isRetryableApplyError(applyError: string | undefined): boolean {
  return !!applyError && !applyError.startsWith('Response JSON was malformed')
}
