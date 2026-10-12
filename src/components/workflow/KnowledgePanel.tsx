'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { KnowledgeBaseUploadZone } from '@/components/knowledge/KnowledgeBaseUploadZone'
import { KnowledgeBaseDocumentList, type KnowledgeDocument } from '@/components/knowledge/KnowledgeBaseDocumentList'
import { useWorkflowStore } from '@/stores/workflowStore'

/** Upload documents and turn them on, in one place, without leaving the editor. */
export function KnowledgePanel({ open, onOpenChange, agentName }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void; agentName: string }>) {
  const enabled = useWorkflowStore((s) => s.workflow?.agent.knowledge?.enabled ?? false)
  const updateAgentConfig = useWorkflowStore((s) => s.updateAgentConfig)
  const knowledge = useWorkflowStore((s) => s.workflow?.agent.knowledge)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!agentName) return
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge/documents?agent_id=${encodeURIComponent(agentName)}`)
      const data = await res.json().catch(() => ({}))
      setDocuments(res.ok && Array.isArray(data.documents) ? data.documents : [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [agentName])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const setEnabled = (on: boolean) => updateAgentConfig({ knowledge: { ...(knowledge ?? { topK: 4 }), enabled: on } })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Knowledge base</SheetTitle>
          <SheetDescription>
            Upload files or a website link, like a price list or FAQ. Once it is on, the agent can look things up in it on any step of the call.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Let the agent use these documents</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? 'On: the agent searches them when a caller asks something its instructions do not cover.' : 'Off: the agent ignores everything below.'}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Let the agent use these documents" />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">1. Add content</h3>
            <KnowledgeBaseUploadZone agentId={agentName} onUploadSuccess={refresh} />
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">2. Check what is there</h3>
            <KnowledgeBaseDocumentList documents={documents} loading={loading} onRefresh={refresh} agentId={agentName} />
          </section>

          <p className="text-xs text-muted-foreground">
            Uploads are saved right away. Press <strong>Deploy</strong> afterwards only if you also changed the on/off switch above.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
