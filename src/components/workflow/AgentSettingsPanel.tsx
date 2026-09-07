'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Languages as LanguagesIcon, Edit2, Trash2, Phone, Loader2 } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import LanguageSwitchSettings, { LanguageSwitchConfig } from '@/components/agents/AgentConfig/LanguageSwitchSettings'

interface OutboundPhoneNumber {
  id: string
  phone_number: string
  trunk_id: string
  provider: string | null
  project_id: string | null
  status: string | null
  trunk_direction: string | null
}

// LanguageSwitchSettings' TTS picker writes the provider's native voice-id
// field (sarvam: speaker, google: voice_name) because it was built to feed the
// classic agent's raw config.yaml shape. The workflow schema's ttsConfig uses
// voice_id uniformly for every provider (see workflow/providers.py build_tts),
// so normalize on the way into agent.languages.
function normalizeLanguageEntry(entry: LanguageSwitchConfig): LanguageSwitchConfig {
  const tts = entry.tts as Record<string, unknown> | undefined
  if (!tts) return entry
  const voiceId = tts.voice_id ?? tts.speaker ?? tts.voice_name
  if (voiceId === undefined) return entry
  const { speaker: _speaker, voice_name: _voiceName, ...rest } = tts
  return { ...entry, tts: { ...rest, voice_id: voiceId } }
}

export function AgentSettingsPanel({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void }>) {
  const workflow = useWorkflowStore((s) => s.workflow)
  const updateAgentConfig = useWorkflowStore((s) => s.updateAgentConfig)
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)
  const [isLSOpen, setIsLSOpen] = useState(false)
  const [editingLSIndex, setEditingLSIndex] = useState<number | null>(null)
  const params = useParams()
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''
  const [phoneNumbers, setPhoneNumbers] = useState<OutboundPhoneNumber[]>([])
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false)

  // Same source + filter as the classic agent's transfer_call tool config
  // (ToolsActionsSettingsProps.tsx) — every workflow agent otherwise shared
  // ONE trunk/number from a server env var with no way to pick a different
  // one per agent, even though the backend has supported an override
  // (transports.telephony.outbound) since it was added.
  useEffect(() => {
    if (!projectId) return
    setLoadingPhoneNumbers(true)
    fetch('/api/calls/phone-numbers/?limit=100')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OutboundPhoneNumber[]) => {
        const seen = new Set<string>()
        setPhoneNumbers(
          data.filter((p) => {
            if (seen.has(p.id)) return false
            seen.add(p.id)
            return p.project_id === projectId && p.status === 'active' && p.trunk_direction === 'outbound'
          })
        )
      })
      .catch((err) => console.error('Error fetching phone numbers:', err))
      .finally(() => setLoadingPhoneNumbers(false))
  }, [projectId])

  if (!workflow) return null
  const { agent, transports } = workflow
  const languages = (agent.languages ?? []) as LanguageSwitchConfig[]
  const outbound = (transports.telephony?.outbound ?? {}) as { sip_trunk_id?: string; sms_from?: string }
  const selectedPhoneId = phoneNumbers.find((p) => p.trunk_id === outbound.sip_trunk_id)?.id

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
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-500 dark:text-gray-400">
                Languages — lets any conversation node switch language mid-call instead of duplicating nodes
              </Label>
              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => { setEditingLSIndex(null); setIsLSOpen(true) }}>
                + Add
              </Button>
            </div>
            {languages.map((ls, idx) => (
              <div key={`${ls.tool_name}-${idx}`} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <LanguagesIcon className="h-3 w-3 text-purple-500 shrink-0" />
                  <span className="text-xs font-mono truncate">{ls.tool_name}</span>
                  <span className="text-xs text-gray-400">{ls.language_code}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingLSIndex(idx); setIsLSOpen(true) }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-500 hover:text-red-700"
                    onClick={() => updateAgentConfig({ languages: languages.filter((_, i) => i !== idx) as typeof agent.languages })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <LanguageSwitchSettings
              entries={languages}
              onChange={(entries) => updateAgentConfig({ languages: entries.map(normalizeLanguageEntry) as typeof agent.languages })}
              open={isLSOpen}
              controlledEditingIndex={editingLSIndex}
              onOpenChange={setIsLSOpen}
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
            {transports.telephony?.enabled && (
              <div className="pt-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> Outbound number
                </Label>
                {loadingPhoneNumbers && (
                  <div className="w-full h-8 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg mt-1">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                {!loadingPhoneNumbers && phoneNumbers.length === 0 && (
                  <div className="w-full h-8 flex items-center px-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">No active outbound numbers on this project</span>
                  </div>
                )}
                {!loadingPhoneNumbers && phoneNumbers.length > 0 && (
                  <Select
                    value={selectedPhoneId || '__none__'}
                    onValueChange={(phoneId) => {
                      const nextOutbound =
                        phoneId === '__none__'
                          ? { ...outbound, sip_trunk_id: undefined, sms_from: undefined }
                          : (() => {
                              const phone = phoneNumbers.find((p) => p.id === phoneId)
                              return phone ? { ...outbound, sip_trunk_id: phone.trunk_id, sms_from: phone.phone_number } : outbound
                            })()
                      patchWorkflow({
                        transports: { ...transports, telephony: { ...transports.telephony, enabled: true, outbound: nextOutbound } },
                      })
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs mt-1">
                      <SelectValue placeholder="Select phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-xs text-gray-400">None — use the server&apos;s default trunk</span>
                      </SelectItem>
                      {phoneNumbers.map((phone) => (
                        <SelectItem key={phone.id} value={phone.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{phone.phone_number}</span>
                            {phone.provider && <span className="text-gray-500 text-xs">({phone.provider})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used by this agent&apos;s Call Transfer and SMS nodes. Leave as &quot;None&quot; to share the
                  deployment&apos;s default trunk/number with every other agent.
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
