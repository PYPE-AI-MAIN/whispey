"use client"

// Redial a call straight from the call-logs table, reusing the exact same
// validation/DNC/dispatch path as the manual dial form (phone-call-config) —
// see src/lib/callDispatch.ts. This dials a real phone number, so every step
// that form already gates on (agent running, DNC list, a valid outbound
// number) applies here too, plus an explicit confirm before anything fires.

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { PhoneCall, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DispatchVariablesEditor, type DispatchVariable } from './DispatchVariablesEditor'
import type { CallLog } from '@/types/logs'
import {
  type PhoneNumber,
  type RunningAgent,
  type DispatchAgent,
  formatNumberLabel,
  formatDisplayNumber,
  looksLikePhoneNumber,
  getRunningAgentName,
  validateDispatch,
  extractDispatchError,
  buildDispatchVariables,
  extractCandidateVariables,
} from '@/lib/callDispatch'

interface CallAgainDialogProps {
  call: CallLog
  projectId: string
  agent: DispatchAgent
  phoneNumbers: PhoneNumber[]
}

function toVariableRows(record: Record<string, string>): DispatchVariable[] {
  return Object.entries(record).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
}

export default function CallAgainDialog({ call, projectId, agent, phoneNumbers }: Readonly<CallAgainDialogProps>) {
  const [open, setOpen] = useState(false)
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([])
  const [isCheckingRunning, setIsCheckingRunning] = useState(true)
  const [fromPhoneNumberId, setFromPhoneNumberId] = useState(phoneNumbers[0]?.id ?? '')
  const [variables, setVariables] = useState<DispatchVariable[]>([])
  const [isDispatching, setIsDispatching] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const runningStatus = getRunningAgentName(agent, runningAgents)
  // Production has real rows where customer_number is a 45+ digit garbled
  // value, not a phone number at all — caught here so it never reaches the
  // dispatch call, and displayed truncated so it can't blow out the layout
  // the way it did when this dialog rendered it raw.
  const isValidNumber = looksLikePhoneNumber(call.customer_number)
  const displayNumber = formatDisplayNumber(call.customer_number)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    // Fresh state every time this opens — a stale "dispatched!" message or an
    // edited-then-abandoned variable shouldn't carry over to the next open.
    setResult(null)
    setFromPhoneNumberId(phoneNumbers[0]?.id ?? '')
    setVariables(toVariableRows(extractCandidateVariables(call.metadata)))
    setIsCheckingRunning(true)
    fetch('/api/agents/running_agents')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setRunningAgents(data || []))
      .catch(() => setRunningAgents([]))
      .finally(() => setIsCheckingRunning(false))
  }

  const handleConfirm = async () => {
    const v = validateDispatch(true, call.customer_number, fromPhoneNumberId, phoneNumbers, runningStatus)
    if (!v.ok) {
      if (v.error) setResult({ type: 'error', text: v.error })
      return
    }
    const { selectedPhone, agentName } = v
    setIsDispatching(true)
    setResult(null)
    try {
      const dncRes = await fetch('/api/dnc/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: call.customer_number, project_id: projectId }),
      })
      if (dncRes.status === 406) {
        setResult({ type: 'error', text: `${call.customer_number} is on the Do Not Call (DNC) list — call blocked.` })
        return
      }

      const response = await fetch('/api/agents/dispatch-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          phone_number: call.customer_number,
          sip_trunk_id: selectedPhone.trunk_id,
          provider: selectedPhone.provider,
          number_type: selectedPhone.number_type,
          from_number: selectedPhone.phone_number,
          ...(variables.length > 0 ? { variables: buildDispatchVariables(variables) } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setResult({ type: 'error', text: extractDispatchError(body, response.status) })
        return
      }
      setResult({ type: 'success', text: `Call dispatched to ${call.customer_number}.` })
      toast.success(`Call dispatched to ${call.customer_number}`)
    } catch (err) {
      setResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to dispatch call' })
    } finally {
      setIsDispatching(false)
    }
  }

  const disabled = isDispatching || isCheckingRunning || !fromPhoneNumberId || !runningStatus.isRunning || !isValidNumber

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={(e) => e.stopPropagation()}>
          <PhoneCall className="h-3 w-3" /> Call Again
        </Button>
      </DialogTrigger>
      {/* flex + max-h caps the dialog to the viewport and keeps the title/footer
          always visible — a call can carry a dozen-plus metadata fields, and
          the default Dialog has no height limit at all, so that variable list
          alone can push the whole card, title included, off the top of the
          screen with no way to scroll back up to it. Only the middle section
          scrolls; header and footer stay put. */}
      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="line-clamp-2 break-all" title={call.customer_number}>
            Call {displayNumber} again?
          </DialogTitle>
          <DialogDescription>
            This places a live outbound call right now — not a simulation. Review the number and variables below first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!isValidNumber ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="break-all" title={call.customer_number}>
                &ldquo;{displayNumber}&rdquo; doesn&apos;t look like a valid phone number — dispatch is disabled.
              </span>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {isCheckingRunning
                  ? 'Checking whether the agent is currently running…'
                  : runningStatus.isRunning
                    ? `Will dial ${call.customer_number} using ${agent.name}.`
                    : 'Agent is not currently running — start it first to dispatch this call.'}
              </span>
            </div>
          )}

          <div>
            <label htmlFor="call-again-from-number" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Call from
            </label>
            {phoneNumbers.length === 1 ? (
              <p className="text-sm text-muted-foreground">{formatNumberLabel(phoneNumbers[0])}</p>
            ) : (
              <Select value={fromPhoneNumberId} onValueChange={setFromPhoneNumberId}>
                <SelectTrigger id="call-again-from-number" className="h-9">
                  <SelectValue placeholder="Select an outbound number" />
                </SelectTrigger>
                <SelectContent>
                  {phoneNumbers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{formatNumberLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DispatchVariablesEditor variables={variables} setVariables={setVariables} />

          {result && (
            <div
              className={
                result.type === 'success'
                  ? 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
              }
            >
              {result.type === 'success' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              {result.text}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
          <Button size="sm" onClick={handleConfirm} disabled={disabled} className="max-w-[70%] gap-1.5">
            {isDispatching ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">Call {displayNumber} now</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
