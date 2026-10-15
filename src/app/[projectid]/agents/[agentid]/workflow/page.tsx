'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { useAgentLifecycle } from '@/hooks/useAgentLifecycle'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { deployable, stripExpandedEdges } from '@/lib/workflow/globalRules'
import { tracePathIds } from '@/lib/workflow/canvasModel'
import { hasErrors } from '@/lib/workflow/linter'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/lib/workflow/templates'
import { WorkflowPalette } from '@/components/workflow/WorkflowPalette'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { Inspector } from '@/components/workflow/Inspector'
import type { LintIssue } from '@/lib/workflow/linter'
import { WorkflowHeader } from '@/components/workflow/WorkflowHeader'
import { PublishDialog } from '@/components/workflow/PublishDialog'
import { WorkflowHistory } from '@/components/workflow/WorkflowHistory'
import { WebhookPanel } from '@/components/workflow/WebhookPanel'
import { useWorkflowDeploy } from '@/hooks/useWorkflowDeploy'
import { KnowledgePanel } from '@/components/workflow/KnowledgePanel'
import { GlobalRulesPanel } from '@/components/workflow/GlobalRulesPanel'
import { VariablesPanel } from '@/components/workflow/VariablesPanel'
import { AgentSettingsPanel } from '@/components/workflow/AgentSettingsPanel'
import { TemplatePicker } from '@/components/workflow/TemplatePicker'
import { CanvasHintBanner } from '@/components/workflow/CanvasHintBanner'
import TalkToAssistant from '@/components/agents/TalkToAssistant'
import { LiveEventLog, type WorkflowEvent } from '@/components/workflow/LiveEventLog'
import { WorkflowChat } from '@/components/workflow/WorkflowChat'
import { LoaderFive } from '@/components/ui/loader-five'

const LOADING_LINES = ['yup, warming things up…', 'stitching your nodes together…', 'almost there, hang tight…']
import { ImportJsonSheet } from '@/components/workflow/ImportJsonSheet'

/** Deploy is always available; it just has nothing to send when the canvas is unchanged. */
function deployButtonTitle(isDirty: boolean): string | undefined {
  return isDirty ? undefined : 'Already deployed — no changes to send'
}

/**
 * Backend expects agent_id = agent name (e.g. Test_a2e7a0fa_c64c_4840_a063_dad5a3df685e),
 * same derivation used by the knowledge-base page.
 */
function useBackendAgentName(agentId: string | undefined) {
  const { data: agentDataResponse, isLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, configuration',
    filters: agentId ? [{ column: 'id', operator: 'eq', value: agentId }] : [],
    limit: 1,
    auth: agentId ? { agentId } : undefined,
  })
  const backendAgentName = useMemo(() => {
    if (!agentDataResponse?.[0]?.name || !agentId) return ''
    return `${agentDataResponse[0].name}_${agentId.replaceAll('-', '_')}`
  }, [agentDataResponse, agentId])
  return { agentRow: agentDataResponse?.[0], backendAgentName, agentLoading: isLoading }
}

/**
 * Next.js App Router reuses this component instance across
 * /A/agents/AGENT1/workflow -> /A/agents/AGENT2/workflow navigations — it does
 * NOT remount just because a dynamic segment changes. Without a remount, the
 * one-shot init ref/state below would never re-run for the new agent, and the
 * Zustand workflow store (a module-level singleton) would keep showing —  and
 * letting you Deploy — the PREVIOUS agent's flow. `key={agentId}` on the inner
 * component forces a full remount on every agent change, resetting all of it.
 */
export default function WorkflowPage() {
  const params = useParams()
  const agentId = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  return <WorkflowPageInner key={agentId} />
}

function WorkflowPageInner() {
  const params = useParams()
  const router = useRouter()
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''
  const agentId = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''

  const { role, isLoading: roleLoading } = useMemberVisibility(projectId || undefined)
  useEffect(() => {
    if (roleLoading || !projectId || !agentId) return
    if (role === 'viewer') router.replace(`/${projectId}/agents/${agentId}`)
  }, [role, roleLoading, projectId, agentId, router])

  const { agentRow, backendAgentName, agentLoading } = useBackendAgentName(agentId)
  const agentLifecycle = useAgentLifecycle(backendAgentName || undefined)

  const workflow = useWorkflowStore((s) => s.workflow)
  const isDirty = useWorkflowStore((s) => s.isDirty)
  const lintIssues = useWorkflowStore((s) => s.lintIssues)
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow)
  const setActiveNode = useWorkflowStore((s) => s.setActiveNode)
  const setTracePath = useWorkflowStore((s) => s.setTracePath)

  // "Show on canvas" from a call's details: ?path=Step one > Step two. Applied once per link, so Clear stays cleared.
  const pathParam = useSearchParams().get('path')
  const appliedPath = useRef<string | null>(null)
  useEffect(() => {
    if (!pathParam || !workflow || appliedPath.current === pathParam) return
    appliedPath.current = pathParam
    setTracePath(tracePathIds(workflow, pathParam.split(' > ')))
  }, [pathParam, workflow, setTracePath])
  useEffect(() => () => setTracePath(null), [setTracePath])

  const [needsTemplate, setNeedsTemplate] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [agentNotFound, setAgentNotFound] = useState(false)

  // Rotating copy for the initial-load screen — cycles regardless of whether
  // this render actually needs it; harmless since the screen it feeds is only
  // shown for a couple seconds anyway.
  const [loadingLineIndex, setLoadingLineIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLoadingLineIndex((i) => (i + 1) % LOADING_LINES.length), 2200)
    return () => clearInterval(id)
  }, [])
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || agentLoading) return
    initialized.current = true
    if (!agentRow) {
      setAgentNotFound(true)
      return
    }
    const existing = safeParseWorkflow(agentRow.configuration?.workflow)
    if (existing.success) {
      // This is already the deployed config (it came from the agent row we
      // just loaded), not new content waiting to be deployed.
      setWorkflow(stripExpandedEdges(existing.data), { dirty: false })
    } else {
      setNeedsTemplate(true)
    }
  }, [agentLoading, agentRow, setWorkflow])

  const handlePickTemplate = (template: WorkflowTemplate) => {
    setWorkflow(template.build(agentRow?.name ?? ''))
    setNeedsTemplate(false)
  }

  // Chat-first start: a prompt typed before any workflow exists. Seed a blank
  // workflow (AI Builder edits it same as any other), then open the chat panel
  // pre-loaded with what they typed so building starts immediately instead of
  // pick-template -> open-chat -> retype.
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null)
  const handleStartWithPrompt = (prompt: string) => {
    const blank = WORKFLOW_TEMPLATES.find((t) => t.id === 'blank') ?? WORKFLOW_TEMPLATES[0]
    handlePickTemplate(blank)
    setPendingChatMessage(prompt)
    setChatOpen(true)
  }

  const [variablesOpen, setVariablesOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [serverIssues, setServerIssues] = useState<LintIssue[]>([])
  // Results from a server check describe the flow as it was then; drop them once it changes.
  useEffect(() => setServerIssues([]), [workflow])
  // Steps are added with the + on a step, so the side list stays out of the way until asked for.
  // Open by default, like Retell: the node types are always in view.
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [voiceChecked, setVoiceChecked] = useState(false)
  const [tested, setTested] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [webhookOpen, setWebhookOpen] = useState(false)

  // Copy the canvas as workflow JSON — the counterpart to ImportJsonSheet.
  const copyJson = useCallback(async () => {
    if (!workflow) return
    const json = JSON.stringify(workflow, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      toast.success(`Copied workflow JSON (${workflow.nodes.length} nodes)`)
    } catch {
      // clipboard API needs a secure context + permission; fall back to a prompt
      // the user can copy out of manually rather than failing silently.
      globalThis.prompt('Copy the workflow JSON:', json)
    }
  }, [workflow])

  // Talk to Assistant — same component the classic Agent Config page uses.
  const [talkOpen, setTalkOpen] = useState(false)
  const [flashEndCall, setFlashEndCall] = useState(false)
  const talkSessionActiveRef = useRef(false)

  // Live "wf-node" events from the interpreter — drives active-node highlighting
  // on the canvas and the event log below it.
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([])
  const eventSeq = useRef(0)
  const handleWorkflowEvent = useCallback(
    (event: Record<string, any>) => {
      // _id is a monotonic counter: Date.now() collides when two events arrive
      // in the same millisecond, which React rejects as a duplicate key.
      const withId = { ...event, _ts: Date.now(), _id: eventSeq.current++ } as WorkflowEvent
      setWorkflowEvents((prev) => [...prev.slice(-49), withId])
      if (event.type === 'node_enter' && event.node_id) setActiveNode(event.node_id)
    },
    [setActiveNode]
  )
  const handleTalkSessionActiveChange = useCallback(
    (active: boolean) => {
      talkSessionActiveRef.current = active
      if (!active) setActiveNode(null)
    },
    [setActiveNode]
  )

  const errorCount = useMemo(() => lintIssues.filter((i) => i.severity === 'error').length, [lintIssues])

  const handleValidate = async () => {
    if (!workflow) return
    setSaving(true)
    try {
      const res = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: deployable(workflow) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message || 'Validation request failed')
      } else if (data?.valid === false) {
        const found = ((data.issues ?? []) as Array<{ severity: 'error' | 'warning'; message: string; node_id?: string; edge_id?: string }>).map(
          (i) => ({ severity: i.severity, message: i.message, nodeId: i.node_id ?? undefined, edgeId: i.edge_id ?? undefined })
        )
        setServerIssues(found)
        setIssuesOpen(true)
        toast.error(`Found ${found.length || 'some'} ${found.length === 1 ? 'problem' : 'problems'} to fix`)
      } else {
        setServerIssues([])
        toast.success('No problems found')
      }
    } catch {
      toast.error('Could not reach the validation endpoint')
    } finally {
      setSaving(false)
    }
  }

  const { deploying, deploy } = useWorkflowDeploy({ backendAgentName, agentId, onDeployed: agentLifecycle.refresh })

  // Deploy asks what changed first; a flow with errors cannot be deployed, so show them instead.
  const requestDeploy = () => {
    if (!workflow || !backendAgentName) return
    if (hasErrors(lintIssues)) {
      // The list opens next to the button: a long multi-line toast ran its lines together.
      setIssuesOpen(true)
      toast.error(`Fix ${errorCount} ${errorCount === 1 ? 'problem' : 'problems'} before deploying`)
      return
    }
    setPublishOpen(true)
  }

  if (!agentId || !projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">Invalid agent or organization.</p>
      </div>
    )
  }

  if (agentNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">This agent could not be found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${projectId}/agents`)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to agents
        </Button>
      </div>
    )
  }

  if (agentLoading || (!workflow && !needsTemplate)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <LoaderFive text={LOADING_LINES[loadingLineIndex]} className="text-sm text-muted-foreground" />
      </div>
    )
  }

  if (needsTemplate) {
    return (
      <div className="h-screen flex flex-col bg-muted/50">
        <div className="border-b border-border bg-card flex items-center gap-3 px-4 py-2.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/${projectId}/agents/${agentId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-semibold text-foreground">{agentRow?.name || 'Workflow'}</h1>
        </div>
        <TemplatePicker onPick={handlePickTemplate} onStartWithPrompt={handleStartWithPrompt} />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-muted/50">
      <WorkflowHeader
        name={agentRow?.name || 'Workflow'}
        onBack={() => router.push(`/${projectId}/agents/${agentId}`)}
        paletteOpen={paletteOpen}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        serverIssues={serverIssues}
        issuesOpen={issuesOpen}
        onIssuesOpenChange={setIssuesOpen}
        isDirty={isDirty}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        onOpenAgent={() => setSettingsOpen(true)}
        onOpenVariables={() => setVariablesOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        rulesCount={workflow?.globalRules?.length ?? 0}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
        canTest={agentLifecycle.status.status === 'running'}
        onTest={() => {
          // The call runs the deployed version, so unsaved edits are not in it.
          if (isDirty) toast('You have unsaved changes. This test uses the last deployed version. Deploy first to include them.', { duration: 6000 })
          setTalkOpen(true)
          setTested(true)
        }}
        onValidate={handleValidate}
        validating={saving}
        onPaste={() => setImportOpen(true)}
        onCopy={copyJson}
        onDeploy={requestDeploy}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenWebhook={() => setWebhookOpen(true)}
        deploying={deploying}
        deployTitle={deployButtonTitle(isDirty)}
      />

      <div className="flex-1 flex min-h-0 relative">
        <CanvasHintBanner
          onAskPi={() => setChatOpen(true)}
          onShowIssues={() => setIssuesOpen(true)}
          onOpenAgent={() => { setSettingsOpen(true); setVoiceChecked(true) }}
          onOpenKnowledge={() => setKnowledgeOpen(true)}
          onTest={() => {
            if (agentLifecycle.status.status !== 'running') return toast('Deploy first, then you can test it')
            setTalkOpen(true)
            setTested(true)
          }}
          deployed={!isDirty && agentLifecycle.status.status === 'running'}
          tested={tested}
          voiceChecked={voiceChecked}
          paletteOpen={paletteOpen}
        />
        <ReactFlowProvider>
          {paletteOpen && <WorkflowPalette />}
          <WorkflowCanvas />
        </ReactFlowProvider>
        <WorkflowChat
          open={chatOpen}
          onOpenChange={setChatOpen}
          initialMessage={pendingChatMessage}
          onInitialMessageConsumed={() => setPendingChatMessage(null)}
        />
      </div>

      <Inspector />
      <VariablesPanel open={variablesOpen} onOpenChange={setVariablesOpen} />
      <GlobalRulesPanel open={rulesOpen} onOpenChange={setRulesOpen} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} publishing={deploying} onPublish={async (m) => { if (await deploy(m)) setPublishOpen(false) }} />
      <WorkflowHistory open={historyOpen} onOpenChange={setHistoryOpen} agentId={agentId} />
      <WebhookPanel open={webhookOpen} onOpenChange={setWebhookOpen} agentId={agentId} projectId={projectId} />
      <KnowledgePanel open={knowledgeOpen} onOpenChange={setKnowledgeOpen} agentName={backendAgentName} />
      <ImportJsonSheet open={importOpen} onOpenChange={setImportOpen} />
      <AgentSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

      <Sheet
        open={talkOpen}
        onOpenChange={(open) => {
          if (!open && talkSessionActiveRef.current) {
            setFlashEndCall(true)
            return
          }
          setTalkOpen(open)
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Talk to Assistant</SheetTitle>
        </SheetHeader>
        <SheetContent side="right" className="w-full sm:w-96 p-0 flex flex-col gap-0">
          <div className="flex-1 min-h-0">
            <TalkToAssistant
              agentName={backendAgentName}
              isOpen={talkOpen}
              onClose={() => setTalkOpen(false)}
              agentStatus={agentLifecycle.status}
              onAgentStatusChange={agentLifecycle.refresh}
              flashEndCall={flashEndCall}
              onFlashEndCallDone={() => setFlashEndCall(false)}
              onSessionActiveChange={handleTalkSessionActiveChange}
              onWorkflowEvent={handleWorkflowEvent}
            />
          </div>
          <LiveEventLog events={workflowEvents} onClear={() => setWorkflowEvents([])} />
        </SheetContent>
      </Sheet>

    </div>
  )
}
