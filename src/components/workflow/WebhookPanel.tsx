'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import WebhookSettings from '@/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/WebhookSettings'
import { saveSupplementalSettings, type WebhookConfig } from '@/lib/supplementalSettings'

const EMPTY: WebhookConfig = { webhookUrl: '', httpMethod: 'POST', headers: {}, isActive: false }

/** Send each finished call's log to your own address: the same webhook the single-prompt agents have. */
export function WebhookPanel({ open, onOpenChange, agentId, projectId }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void; agentId: string; projectId: string }>) {
  const [cfg, setCfg] = useState<WebhookConfig>(EMPTY)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveSupplementalSettings(agentId, projectId, { webhook: cfg })
      toast.success('Webhook saved')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the webhook')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Webhook</SheetTitle>
          <SheetDescription>Get each finished call, with its transcript and details, sent to your own system. It applies right away; no Deploy needed.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <WebhookSettings
            triggerOnCallLog
            webhookUrl={cfg.webhookUrl}
            httpMethod={cfg.httpMethod}
            headers={cfg.headers}
            isActive={cfg.isActive}
            onFieldChange={(_field, value) => setCfg(value as WebhookConfig)}
            onDataLoaded={setCfg}
            agentId={agentId}
            projectId={projectId}
          />
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save webhook
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
