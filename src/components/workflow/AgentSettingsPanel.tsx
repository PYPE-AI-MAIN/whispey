'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useWorkflowStore } from '@/stores/workflowStore'

export function AgentSettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const workflow = useWorkflowStore((s) => s.workflow)
  const updateAgentConfig = useWorkflowStore((s) => s.updateAgentConfig)
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)

  if (!workflow) return null
  const { agent, transports } = workflow

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Agent settings</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Global prompt</Label>
            <Textarea
              className="min-h-[140px]"
              value={agent.globalPrompt}
              onChange={(e) => updateAgentConfig({ globalPrompt: e.target.value })}
              placeholder="Persona and rules that apply across every node."
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">STT</Label>
              <Input value={agent.stt.name} onChange={(e) => updateAgentConfig({ stt: { ...agent.stt, name: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">LLM</Label>
              <Input value={agent.llm.name} onChange={(e) => updateAgentConfig({ llm: { ...agent.llm, name: e.target.value } })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TTS</Label>
              <Input value={agent.tts.name} onChange={(e) => updateAgentConfig({ tts: { ...agent.tts, name: e.target.value } })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Voice ID</Label>
            <Input
              value={agent.tts.voice_id ?? ''}
              onChange={(e) => updateAgentConfig({ tts: { ...agent.tts, voice_id: e.target.value } })}
              placeholder="e.g. EXAVITQu4vr4xnSDxMaL (ElevenLabs voice)"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Required for ElevenLabs — the plugin&apos;s built-in default voice isn&apos;t available on every account. Leave blank only if you know your account has it.
            </p>
          </div>
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Label className="text-xs text-gray-500 dark:text-gray-400">Transports</Label>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Web calls</Label>
              <Switch
                checked={!!transports.web?.enabled}
                onCheckedChange={(v) => patchWorkflow({ transports: { ...transports, web: { enabled: v } } })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Telephony</Label>
              <Switch
                checked={!!transports.telephony?.enabled}
                onCheckedChange={(v) =>
                  patchWorkflow({ transports: { ...transports, telephony: { ...transports.telephony, enabled: v } } })
                }
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
