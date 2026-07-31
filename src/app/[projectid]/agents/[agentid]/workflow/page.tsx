'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import toast from 'react-hot-toast'
import { ArrowLeft, Braces, BookOpen, Copy, Loader2, Play, PhoneIcon, Rocket, Settings2, ShieldCheck, Sparkles, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { useAgentLifecycle } from '@/hooks/useAgentLifecycle'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { hasErrors } from '@/lib/workflow/linter'
import type { WorkflowTemplate } from '@/lib/workflow/templates'
import { WorkflowPalette } from '@/components/workflow/WorkflowPalette'
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas'
import { Inspector } from '@/components/workflow/Inspector'
import { VariablesPanel } from '@/components/workflow/VariablesPanel'
import { AgentSettingsPanel } from '@/components/workflow/AgentSettingsPanel'
import { TemplatePicker } from '@/components/workflow/TemplatePicker'
import { CanvasHintBanner } from '@/components/workflow/CanvasHintBanner'
import TalkToAssistant from '@/components/agents/TalkToAssistant'
import { KnowledgeBaseUploadZone } from '@/components/knowledge/KnowledgeBaseUploadZone'
import { KnowledgeBaseDocumentList, type KnowledgeDocument } from '@/components/knowledge/KnowledgeBaseDocumentList'
import { LiveEventLog, type WorkflowEvent } from '@/components/workflow/LiveEventLog'
import { WorkflowChat } from '@/components/workflow/WorkflowChat'
import { ImportJsonSheet } from '@/components/workflow/ImportJsonSheet'

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
    return `${agentDataResponse[0].name}_${agentId.replace(/-/g, '_')}`
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
  const markClean = useWorkflowStore((s) => s.markClean)
  const setActiveNode = useWorkflowStore((s) => s.setActiveNode)

  const [needsTemplate, setNeedsTemplate] = useState(false)
  const [agentNotFound, setAgentNotFound] = useState(false)
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
      setWorkflow(existing.data)
    } else {
      setNeedsTemplate(true)
    }
  }, [agentLoading, agentRow, setWorkflow])

  const handlePickTemplate = (template: WorkflowTemplate) => {
    setWorkflow(template.build(agentRow?.name ?? ''))
    setNeedsTemplate(false)
  }

  const [variablesOpen, setVariablesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)

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
      window.prompt('Copy the workflow JSON:', json)
    }
  }, [workflow])

  // Talk to Assistant — same component the classic Agent Config page uses.
  const [talkOpen, setTalkOpen] = useState(false)
  const [flashEndCall, setFlashEndCall] = useState(false)
  const talkSessionActiveRef = useRef(false)

  // Live "wf-node" events from the interpreter — drives active-node highlighting
  // on the canvas and the event log below it.
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([])
  const handleWorkflowEvent = useCallback(
    (event: Record<string, any>) => {
      setWorkflowEvents((prev) => [...prev.slice(-49), { ...event, _ts: Date.now() } as WorkflowEvent])
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

  // Knowledge Base — same upload/list components the classic Knowledge Base page uses.
  const [chatOpen, setChatOpen] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const fetchDocuments = useCallback(async () => {
    if (!backendAgentName) return
    setDocsLoading(true)
    try {
      const res = await fetch(`/api/knowledge/documents?agent_id=${encodeURIComponent(backendAgentName)}`)
      const data = await res.json().catch(() => ({}))
      setDocuments(res.ok && Array.isArray(data.documents) ? data.documents : [])
    } catch {
      setDocuments([])
    } finally {
      setDocsLoading(false)
    }
  }, [backendAgentName])
  useEffect(() => {
    if (kbOpen) fetchDocuments()
  }, [kbOpen, fetchDocuments])

  const errorCount = useMemo(() => lintIssues.filter((i) => i.severity === 'error').length, [lintIssues])
  const warningCount = lintIssues.length - errorCount

  const handleValidate = async () => {
    if (!workflow) return
    setSaving(true)
    try {
      const res = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message || 'Validation request failed')
      } else if (data?.valid === false) {
        toast.error(`Backend found ${data.issues?.length ?? 'some'} issue(s)`)
      } else {
        toast.success('Workflow is valid')
      }
    } catch {
      toast.error('Could not reach the validation endpoint')
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (!workflow || !backendAgentName) return
    if (hasErrors(lintIssues)) {
      const errors = lintIssues.filter((i) => i.severity === 'error')
      toast.error(`Fix ${errorCount} error(s):\n${errors.map((e) => `• ${e.message}`).join('\n')}`, { duration: 6000 })
      return
    }
    setDeploying(true)
    try {
      const res = await fetch(`/api/workflow/${encodeURIComponent(backendAgentName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message || `Deploy failed (${res.status})`)
      } else {
        toast.success('Workflow deployed')
        markClean()
      }
    } catch {
      toast.error('Could not reach the deploy endpoint')
    } finally {
      setDeploying(false)
    }
  }

  if (!agentId || !projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Invalid agent or project.</p>
      </div>
    )
  }

  if (agentNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">This agent could not be found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${projectId}/agents`)}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to agents
        </Button>
      </div>
    )
  }

  if (agentLoading || (!workflow && !needsTemplate)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (needsTemplate) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 px-4 py-2.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/${projectId}/agents/${agentId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Workflow</h1>
        </div>
        <TemplatePicker onPick={handlePickTemplate} />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 px-4 py-2.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/${projectId}/agents/${agentId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Workflow</h1>
        {isDirty && <Badge variant="secondary" className="text-[10px]">Unsaved</Badge>}

        <div className="flex-1" />

        {lintIssues.length > 0 && (
          <Badge
            variant={errorCount > 0 ? 'destructive' : 'secondary'}
            className="text-[10px] cursor-help"
            title={lintIssues.map((i) => `[${i.severity}] ${i.message}`).join('\n')}
          >
            {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : `${warningCount} warning${warningCount > 1 ? 's' : ''}`}
          </Badge>
        )}

        {agentLifecycle.status.status === 'running' ? (
          <Button variant="outline" size="sm" onClick={agentLifecycle.stop} disabled={agentLifecycle.isLoading}>
            {agentLifecycle.isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1.5" />}
            Stop Agent
          </Button>
        ) : agentLifecycle.status.status === 'starting' || agentLifecycle.status.status === 'stopping' ? (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            {agentLifecycle.status.status === 'starting' ? 'Starting...' : 'Stopping...'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={agentLifecycle.start} disabled={agentLifecycle.isLoading || !backendAgentName}>
            {agentLifecycle.isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            Start Agent
          </Button>
        )}
        <Button
          variant={chatOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChatOpen((v) => !v)}
          className={chatOpen ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Builder
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Braces className="h-3.5 w-3.5 mr-1.5" /> Paste JSON
        </Button>
        <Button variant="outline" size="sm" onClick={copyJson}>
          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => setKbOpen(true)}>
          <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Knowledge
        </Button>
        <Button variant="outline" size="sm" onClick={() => setVariablesOpen(true)}>
          <Braces className="h-3.5 w-3.5 mr-1.5" /> Variables
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Agent
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTalkOpen(true)}>
          <PhoneIcon className="h-3.5 w-3.5 mr-1.5" /> Talk to Assistant
        </Button>
        <Button variant="outline" size="sm" onClick={handleValidate} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
          Validate
        </Button>
        <Button size="sm" onClick={handleDeploy} disabled={deploying}>
          {deploying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1.5" />}
          Deploy
        </Button>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        <CanvasHintBanner />
        <ReactFlowProvider>
          <WorkflowPalette />
          <WorkflowCanvas />
        </ReactFlowProvider>
        <WorkflowChat open={chatOpen} onOpenChange={setChatOpen} />
      </div>

      <Inspector />
      <VariablesPanel open={variablesOpen} onOpenChange={setVariablesOpen} />
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

      <Sheet open={kbOpen} onOpenChange={setKbOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Knowledge base</SheetTitle>
          </SheetHeader>
          <div className="px-4 space-y-6">
            <KnowledgeBaseUploadZone
              agentId={backendAgentName}
              agentIdForRegenerate={agentId}
              onUploadSuccess={fetchDocuments}
            />
            <KnowledgeBaseDocumentList documents={documents} loading={docsLoading} onRefresh={fetchDocuments} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
