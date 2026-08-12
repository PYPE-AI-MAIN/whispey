'use client'

import React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useWorkflowStore } from '@/stores/workflowStore'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'

export function AgentSettingsPanel({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void }>) {
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

          {/* LLM */}
          <div className="space-y-1">
            <Label className="text-xs">LLM</Label>
            <ModelSelector
              selectedProvider={agent.llm.name}
              selectedModel={agent.llm.model ?? ''}
              temperature={agent.llm.temperature ?? undefined}
              onProviderChange={(provider) => updateAgentConfig({ llm: { ...agent.llm, name: provider } })}
              onModelChange={(model) => updateAgentConfig({ llm: { ...agent.llm, model } })}
              onTemperatureChange={(temperature) => updateAgentConfig({ llm: { ...agent.llm, temperature } })}
            />
          </div>

          {/* STT */}
          <div className="space-y-1">
            <Label className="text-xs">STT</Label>
            <SelectSTT
              selectedProvider={agent.stt.name}
              selectedModel={agent.stt.model ?? ''}
              selectedLanguage={agent.stt.language ?? 'en'}
              onSTTSelect={(provider, model, config) =>
                updateAgentConfig({ stt: { name: provider, model, language: config?.language ?? agent.stt.language } })
              }
            />
          </div>

          {/* TTS */}
          <div className="space-y-1">
            <Label className="text-xs">TTS</Label>
            <SelectTTS
              selectedVoice={agent.tts.voice_id ?? ''}
              initialProvider={agent.tts.name}
              initialModel={agent.tts.model ?? undefined}
              initialConfig={agent.tts.voice_settings ?? undefined}
              onVoiceSelect={(voiceId, provider, model, config) =>
                updateAgentConfig({
                  tts: {
                    ...agent.tts,
                    name: provider,
                    voice_id: voiceId,
                    model: model ?? agent.tts.model,
                    voice_settings: config,
                  },
                })
              }
            />
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
