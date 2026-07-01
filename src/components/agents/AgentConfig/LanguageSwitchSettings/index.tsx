'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Edit2, Languages, AlertTriangle, Info } from 'lucide-react'
import SelectTTS from '../SelectTTSDialog'
import SelectSTT from '../SelectSTTDialog'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LanguageSwitchSTTConfig {
  name: 'sarvam' | 'deepgram' | 'google'
  language?: string
  model?: string
  adaptive_stt?: boolean
  mode?: string
  flush_signal?: boolean
  endpointing_ms?: number
  punctuate?: boolean
  smart_format?: boolean
  profanity_filter?: boolean
  numerals?: boolean
  keyterm?: string[]
  eot_threshold?: number
  eager_eot_threshold?: number
  eot_timeout_ms?: number
}

export interface LanguageSwitchConfig {
  tool_name: string
  description: string
  language_code: string
  system_message: string
  allow_interruptions: boolean
  interruption?: boolean
  switch_stt: boolean
  switch_tts: boolean
  stt: LanguageSwitchSTTConfig
  tts: any
}

interface LanguageSwitchSettingsProps {
  entries?: LanguageSwitchConfig[]
  onChange?: (entries: LanguageSwitchConfig[]) => void
  existingToolNames?: string[]
  turnDetection?: string | null
  // Controlled mode: parent drives open state and which entry to edit
  open?: boolean
  controlledEditingIndex?: number | null
  onOpenChange?: (open: boolean) => void
}


// ── Default new entry ──────────────────────────────────────────────────────────

const DEFAULT_ENTRY: LanguageSwitchConfig = {
  tool_name: '',
  description: '',
  language_code: '',
  system_message: '',
  allow_interruptions: true,
  interruption: true,
  switch_stt: true,
  switch_tts: true,
  stt: {
    name: 'sarvam',
    language: 'kn-IN',
    model: 'saaras:v3',
    adaptive_stt: true,
    mode: 'transcribe',
    flush_signal: true,
  },
  tts: {},
}

export function validate(entry: LanguageSwitchConfig, allEntries: LanguageSwitchConfig[], editingIndex: number | null, existingToolNames: string[] = []) {
  const errors: Record<string, string> = {}
  if (!entry.tool_name) {
    errors.tool_name = 'Required'
  } else if (entry.tool_name.length > 30) {
    errors.tool_name = 'Tool name must be 30 characters or less'
  } else if (/^[A-Za-z]\w*$/.test(entry.tool_name)) {
    const isDupe = allEntries.some((e, i) => i !== editingIndex && e.tool_name === entry.tool_name)
      || existingToolNames.includes(entry.tool_name)
    if (isDupe) errors.tool_name = `"${entry.tool_name}" tool already exists`
  } else {
    errors.tool_name = 'Must be snake_case (letters, digits, underscores, no spaces)'
  }
  if (!entry.description || entry.description.length < 10) errors.description = 'Min 10 characters'
  if (!entry.system_message) errors.system_message = 'Required'
  if (!entry.stt.name) errors.stt = 'Select an STT provider'
  if (!entry.tts?.name) errors.tts = 'Select a TTS provider'
  return errors
}

// ── Main Component ─────────────────────────────────────────────────────────────

const LanguageSwitchSettings: React.FC<Readonly<LanguageSwitchSettingsProps>> = ({
  entries = [],
  onChange,
  existingToolNames = [],
  turnDetection,
  open: controlledOpen,
  controlledEditingIndex,
  onOpenChange,
}) => {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalEditingIndex, setInternalEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<LanguageSwitchConfig>(DEFAULT_ENTRY)
  const [touched, setTouched] = useState(false)

  const isDialogOpen = isControlled ? controlledOpen : internalOpen
  const editingIndex = isControlled ? (controlledEditingIndex ?? null) : internalEditingIndex

  const setIsDialogOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setInternalOpen(v)
  }

  // When controlled open flips to true, load the right draft
  React.useEffect(() => {
    if (!isControlled || !controlledOpen) return
    if (controlledEditingIndex !== null && controlledEditingIndex !== undefined) {
      setDraft(structuredClone(entries[controlledEditingIndex]))
    } else {
      setDraft(DEFAULT_ENTRY)
    }
    setTouched(false)
  }, [controlledOpen, controlledEditingIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const errors = touched ? validate(draft, entries, editingIndex, existingToolNames) : {}
  const isValid = Object.keys(validate(draft, entries, editingIndex, existingToolNames)).length === 0

  const showAdaptiveWarning =
    draft.allow_interruptions &&
    draft.interruption === true &&
    draft.stt.name === 'sarvam' &&
    !draft.stt.adaptive_stt

  const openAdd = () => {
    setDraft(DEFAULT_ENTRY)
    setInternalEditingIndex(null)
    setTouched(false)
    setIsDialogOpen(true)
  }

  const openEdit = (idx: number) => {
    setDraft(structuredClone(entries[idx]))
    setInternalEditingIndex(idx)
    setTouched(false)
    setIsDialogOpen(true)
  }

  const handleDelete = (idx: number) => {
    onChange?.(entries.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    setTouched(true)
    if (!isValid) return
    const derived_language_code = draft.switch_stt
      ? (draft.stt.language || '')
      : (draft.tts?.language || draft.stt.language || '')
    const entry = { ...draft, language_code: derived_language_code }
    if (editingIndex === null) {
      onChange?.([...entries, entry])
    } else {
      const updated = [...entries]
      updated[editingIndex] = entry
      onChange?.(updated)
    }
    setIsDialogOpen(false)
  }

  const handleSTTSelect = (provider: string, model: string, config: any) => {
    setDraft(prev => ({
      ...prev,
      stt: {
        name: provider as 'sarvam' | 'deepgram' | 'google',
        language: config?.language || prev.stt.language,
        model,
        ...(provider === 'sarvam' && {
          adaptive_stt: prev.stt.name === 'sarvam' ? (prev.stt.adaptive_stt ?? true) : true,
          flush_signal: prev.stt.name === 'sarvam' ? (prev.stt.flush_signal ?? true) : true,
          mode: config?.mode || (prev.stt.name === 'sarvam' ? prev.stt.mode : undefined) || 'transcribe',
        }),
        ...(provider === 'deepgram' && {
          punctuate: config?.punctuate,
          smart_format: config?.smart_format,
          profanity_filter: config?.profanity_filter,
          numerals: config?.numerals,
          keyterm: config?.keyterm,
          endpointing_ms: config?.endpointing_ms,
          eot_threshold: config?.eot_threshold,
          eager_eot_threshold: config?.eager_eot_threshold,
          eot_timeout_ms: config?.eot_timeout_ms,
        }),
      }
    }))
  }

  const handleTTSSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    const normalizedProvider = provider === 'sarvam_tts' ? 'sarvam' : provider
    let tts: any = { name: normalizedProvider }

    if (normalizedProvider === 'sarvam') {
      const vs = config?.voice_settings || config || {}
      tts = {
        name: 'sarvam',
        speaker: voiceId,
        model: model || 'bulbul:v3-beta',
        language: config?.target_language_code || config?.language || 'kn-IN',
        voice_settings: {
          pace: Math.min(2, Math.max(0.5, vs.pace ?? vs.speed ?? 1)),
          loudness: Math.min(2, Math.max(0.5, vs.loudness ?? 1)),
          pitch: vs.pitch ?? 0,
          enable_preprocessing: vs.enable_preprocessing ?? false,
        },
      }
    } else if (normalizedProvider === 'elevenlabs') {
      tts = {
        name: 'elevenlabs',
        voice_id: voiceId,
        model: model || 'eleven_multilingual_v2',
        language: config?.language || 'en',
        voice_settings: {
          similarity_boost: config?.similarityBoost ?? 0.75,
          stability: config?.stability ?? 0.5,
          style: config?.style ?? 0,
          use_speaker_boost: config?.useSpeakerBoost ?? true,
          speed: config?.speed ?? 1,
        },
      }
    } else if (normalizedProvider === 'google') {
      tts = {
        name: 'google',
        voice_name: voiceId,
        ...(config?.gender && { gender: config.gender }),
      }
    }

    setDraft(prev => ({ ...prev, tts }))
  }

  const getTTSInitialConfig = () => {
    if (!draft.tts?.name) return undefined
    const t = draft.tts
    if (t.name === 'sarvam') {
      return {
        target_language_code: t.voice_settings?.target_language_code || t.language || 'kn-IN',
        pace: t.voice_settings?.pace || 1,
        loudness: t.voice_settings?.loudness || 1,
        pitch: t.voice_settings?.pitch || 0,
        enable_preprocessing: t.voice_settings?.enable_preprocessing ?? false,
      }
    } else if (t.name === 'elevenlabs') {
      return {
        language: t.language || 'en',
        similarityBoost: t.voice_settings?.similarity_boost || 0.75,
        stability: t.voice_settings?.stability || 0.5,
        style: t.voice_settings?.style || 0,
        useSpeakerBoost: t.voice_settings?.use_speaker_boost ?? true,
        speed: t.voice_settings?.speed || 1,
      }
    } else if (t.name === 'google') {
      return { voice_name: t.voice_name || '', gender: t.gender }
    }
    return undefined
  }

  const dialog = (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              {editingIndex === null ? 'Add' : 'Edit'} Language Switch
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* ── Basic Fields ── */}
            <Section title="Basic">
              <div className="space-y-3">
                {/* Tool Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    Tool Name <span className="text-red-500">*</span>
                  </Label>
                  <input
                    type="text"
                    value={draft.tool_name}
                    maxLength={30}
                    onChange={(e) => setDraft(prev => ({ ...prev, tool_name: e.target.value }))}
                    onBlur={() => setTouched(true)}
                    placeholder="e.g. switch_to_kn"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {errors.tool_name && (
                    <p className="text-xs text-red-500">{errors.tool_name}</p>
                  )}
                  <p className="text-xs text-gray-500">Unique snake_case identifier, used as the LLM function name</p>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    Description (LLM trigger condition) <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft(prev => ({ ...prev, description: e.target.value }))}
                    onBlur={() => setTouched(true)}
                    placeholder="e.g. Switch to Kannada when user speaks 3+ Kannada words"
                    className="min-h-[72px] text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  />
                  {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                </div>

                {/* System Message */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    System Message <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={draft.system_message}
                    onChange={(e) => setDraft(prev => ({ ...prev, system_message: e.target.value }))}
                    onBlur={() => setTouched(true)}
                    placeholder="e.g. Language switched to Kannada. Respond ONLY in Kannada."
                    className="min-h-[64px] text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  />
                  {errors.system_message && <p className="text-xs text-red-500">{errors.system_message}</p>}
                  <p className="text-xs text-gray-500">Injected into LLM context after the switch fires</p>
                </div>
              </div>
            </Section>

            {/* ── STT ── */}
            <Section title="STT Configuration">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <SelectSTT
                  selectedProvider={draft.stt.name}
                  selectedModel={draft.stt.model || ''}
                  selectedLanguage={draft.stt.language || ''}
                  initialConfig={draft.stt}
                  onSTTSelect={handleSTTSelect}
                />
              </div>
              {errors.stt && <p className="text-xs text-red-500 mt-1">{errors.stt}</p>}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Switch STT</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Apply the STT config when this switch fires</p>
                </div>
                <Switch
                  checked={draft.switch_stt ?? true}
                  onCheckedChange={(v) => setDraft(prev => ({ ...prev, switch_stt: v }))}
                  className="scale-90"
                />
              </div>
            </Section>

            {/* ── TTS ── */}
            <Section title="TTS Configuration">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <SelectTTS
                  selectedVoice={draft.tts?.speaker || draft.tts?.voice_id || draft.tts?.voice_name || ''}
                  initialProvider={draft.tts?.name}
                  initialModel={draft.tts?.model}
                  initialConfig={getTTSInitialConfig()}
                  onVoiceSelect={handleTTSSelect}
                />
              </div>
              {errors.tts && <p className="text-xs text-red-500 mt-1">{errors.tts}</p>}
              {draft.tts?.name && (
                <p className="text-xs text-gray-500 mt-1">
                  {draft.tts.name === 'sarvam' && `Sarvam · ${draft.tts.model || ''} · ${draft.tts.speaker || ''}`}
                  {draft.tts.name === 'elevenlabs' && `ElevenLabs · ${draft.tts.model || ''}`}
                  {draft.tts.name === 'google' && `Google · ${draft.tts.voice_name || ''}`}
                </p>
              )}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Switch TTS</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Apply the TTS config when this switch fires</p>
                </div>
                <Switch
                  checked={draft.switch_tts ?? true}
                  onCheckedChange={(v) => setDraft(prev => ({ ...prev, switch_tts: v }))}
                  className="scale-90"
                />
              </div>
            </Section>

            {/* ── Interruption ── */}
            <Section title="Interruption">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Allow interruptions after switch</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Whether the agent can be interrupted after switching language</p>
                  </div>
                  <Switch
                    checked={draft.allow_interruptions}
                    onCheckedChange={(v) => setDraft(prev => ({ ...prev, allow_interruptions: v, interruption: v ? prev.interruption : undefined }))}
                    className="scale-90"
                  />
                </div>

                {draft.allow_interruptions ? (
                  <div className="flex items-center justify-between pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Use adaptive interruption detection</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(draft.interruption ?? true) ? 'Adaptive ML detector (requires AdaptiveSarvamSTT or Deepgram)' : 'VAD only'}
                      </p>
                    </div>
                    <Switch
                      checked={draft.interruption ?? true}
                      onCheckedChange={(v) => setDraft(prev => ({
                        ...prev,
                        interruption: v,
                        stt: prev.stt.name === 'sarvam' ? { ...prev.stt, adaptive_stt: v } : prev.stt,
                      }))}
                      className="scale-90"
                    />
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                    <Info className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">Agent cannot be interrupted after language switch</p>
                  </div>
                )}

                {showAdaptiveWarning && (
                  <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Adaptive interruption requires Sarvam AdaptiveSarvamSTT. Enable "Adaptive STT" below or the backend will fall back to VAD.
                    </p>
                  </div>
                )}

                {draft.allow_interruptions && (draft.interruption ?? true) && turnDetection !== 'multilingual' && (
                  <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Adaptive interruption works best with Turn Detection set to "Multilingual" (Session Behaviour section). Current setting may reduce accuracy.
                    </p>
                  </div>
                )}

                {draft.stt.name === 'sarvam' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Flush Signal</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Send flush signal on end of utterance</p>
                    </div>
                    <Switch
                      checked={draft.stt.flush_signal ?? true}
                      onCheckedChange={(v) => setDraft(prev => ({ ...prev, stt: { ...prev.stt, flush_signal: v } }))}
                      className="scale-90"
                    />
                  </div>
                )}
              </div>
            </Section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {editingIndex === null ? 'Add' : 'Update'} Language Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )

  // In controlled mode the parent owns the list; render only the dialog
  if (isControlled) return dialog

  return (
    <div className="w-full space-y-3">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Configure mid-call language switches (changes both STT and TTS)
      </p>

      <Button variant="outline" size="sm" onClick={openAdd} className="w-full h-8 text-xs">
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Language Switch
      </Button>

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div
              key={entry.tool_name}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Languages className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                    {entry.tool_name}
                  </span>
                  <Badge variant="secondary" className="text-xs">{entry.language_code}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{entry.stt.name}</Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 ml-5">
                  {entry.description}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(idx)} className="h-7 w-7 p-0">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm" onClick={() => handleDelete(idx)}
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog}
    </div>
  )
}

// ── Small section wrapper ──────────────────────────────────────────────────────

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h4>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>
      {children}
    </div>
  )
}

export default LanguageSwitchSettings
