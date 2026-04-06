// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChevronDownIcon, MicIcon, WrenchIcon, PhoneIcon, Plus, Trash2, EditIcon,
  CodeIcon, PhoneOffIcon, PhoneForwardedIcon, BrainIcon, TimerIcon, Volume2Icon,
  DatabaseIcon, MapPinIcon, LanguagesIcon, RefreshCwIcon,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, { type: string; description: string; required: boolean }>
  headers: Record<string, string>
}

interface BackendTool {
  name: string
  description: string
  config_schema: Record<string, {
    type: 'multiselect' | 'select' | 'text' | 'number'
    label: string
    hint?: string
    placeholder?: string
    options?: { value: string; label: string }[]
    default?: unknown
    min?: number
    max?: number
  }>
  prompt_hint: string
}

interface PipecatAdvancedSettingsProps {
  // VAD
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
  onVadChange: (field: string, value: number) => void
  // Transfer
  transferNumber: string
  onTransferNumberChange: (value: string) => void
  // Tools
  builtinTools: string[]
  onBuiltinToolsChange: (tools: string[]) => void
  toolConfigs: Record<string, Record<string, unknown>>
  onToolConfigsChange: (configs: Record<string, Record<string, unknown>>) => void
  customTools: CustomTool[]
  onCustomToolsChange: (tools: CustomTool[]) => void
  // Smart Turn
  smartTurnStopSecs: number
  smartTurnPreSpeechMs: number
  smartTurnMaxDurSecs: number
  onSmartTurnChange: (field: string, value: number) => void
  // Turn Management
  turnStopTimeout: number
  userIdleTimeout: number | null
  onTurnChange: (field: string, value: number | null) => void
  // TTS Voice Character
  ttsStability: number | null
  ttsSimilarityBoost: number | null
  ttsStyle: number | null
  ttsSpeed: number
  onTtsCharChange: (field: string, value: number | null) => void
  // RAG
  ragEnabled: boolean
  onRagEnabledChange: (v: boolean) => void
  projectId?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_TOOL: CustomTool = {
  name: '', description: '', url: '', method: 'POST',
  parameters: {}, headers: { 'Content-Type': 'application/json' },
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  end_call: <PhoneOffIcon className="w-3 h-3 text-gray-400" />,
  transfer_call: <PhoneForwardedIcon className="w-3 h-3 text-gray-400" />,
  switch_stt_model: <LanguagesIcon className="w-3 h-3 text-gray-400" />,
  switch_tts_model: <Volume2Icon className="w-3 h-3 text-gray-400" />,
  find_nearby_location: <MapPinIcon className="w-3 h-3 text-gray-400" />,
}

// ── Slider Row helper ────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, unit = '',
  hint, onReset, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  unit?: string; hint?: string; onReset?: () => void
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Label>
        <div className="flex items-center gap-2">
          {onReset && (
            <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              reset
            </button>
          )}
          <span className="text-xs font-mono text-gray-500">{value.toFixed(2)}{unit}</span>
        </div>
      </div>
      <Slider value={[value]} onValueChange={v => onChange(v[0])} min={min} max={max} step={step} />
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

// ── Nullable Slider Row ──────────────────────────────────────────────────────

function NullableSliderRow({
  label, value, defaultValue, min, max, step, unit = '',
  hint, nullLabel = 'Default', onChange,
}: {
  label: string; value: number | null; defaultValue: number
  min: number; max: number; step: number; unit?: string
  hint?: string; nullLabel?: string
  onChange: (v: number | null) => void
}) {
  const isNull = value === null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <Checkbox
              checked={!isNull}
              onCheckedChange={checked => onChange(checked ? defaultValue : null)}
              className="h-3 w-3"
            />
            <span>{isNull ? nullLabel : 'Custom'}</span>
          </label>
          <span className={`text-xs font-mono ${isNull ? 'text-gray-400' : 'text-gray-500'}`}>
            {isNull ? '—' : `${(value as number).toFixed(2)}${unit}`}
          </span>
        </div>
      </div>
      <Slider
        value={[value ?? defaultValue]}
        onValueChange={v => !isNull && onChange(v[0])}
        min={min} max={max} step={step}
        disabled={isNull}
        className={isNull ? 'opacity-40' : ''}
      />
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

// ── Tool Config Renderer ─────────────────────────────────────────────────────

function ToolConfigEditor({
  tool,
  config,
  onChange,
}: {
  tool: BackendTool
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  if (!tool.config_schema || Object.keys(tool.config_schema).length === 0) return null

  return (
    <div className="mt-2 ml-5 space-y-3 pb-2">
      {Object.entries(tool.config_schema).map(([key, schema]) => {
        const currentValue = config[key] ?? schema.default

        if (schema.type === 'multiselect' && schema.options) {
          const selected = (currentValue as string[]) ?? []
          return (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <div className="space-y-1">
                {schema.options.map(opt => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={selected.includes(opt.value)}
                      onCheckedChange={checked => {
                        const next = checked
                          ? [...selected, opt.value]
                          : selected.filter(v => v !== opt.value)
                        onChange({ ...config, [key]: next })
                      }}
                      className="h-3 w-3 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-tight">{opt.label}</span>
                  </label>
                ))}
              </div>
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'select' && schema.options) {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Select
                value={(currentValue as string) ?? ''}
                onValueChange={v => onChange({ ...config, [key]: v })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schema.options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'text') {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Input
                value={(currentValue as string) ?? ''}
                onChange={e => onChange({ ...config, [key]: e.target.value })}
                placeholder={schema.placeholder ?? ''}
                className="h-7 text-xs"
              />
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'number') {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Input
                type="number"
                value={(currentValue as number) ?? ''}
                min={schema.min}
                max={schema.max}
                onChange={e => onChange({ ...config, [key]: parseFloat(e.target.value) })}
                className="h-7 text-xs"
              />
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  id, icon, label, open, onToggle, children,
}: {
  id: string; icon: React.ReactNode; label: string
  open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <>
      <Collapsible open={open} onOpenChange={onToggle}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{icon}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          </div>
          <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 ml-5 space-y-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
      <div className="h-px bg-gray-200 dark:bg-gray-700" />
    </>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PipecatAdvancedSettings({
  vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume, onVadChange,
  transferNumber, onTransferNumberChange,
  builtinTools, onBuiltinToolsChange,
  toolConfigs, onToolConfigsChange,
  customTools, onCustomToolsChange,
  smartTurnStopSecs, smartTurnPreSpeechMs, smartTurnMaxDurSecs, onSmartTurnChange,
  turnStopTimeout, userIdleTimeout, onTurnChange,
  ttsStability, ttsSimilarityBoost, ttsStyle, ttsSpeed, onTtsCharChange,
  ragEnabled, onRagEnabledChange,
}: PipecatAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vad: false, smartTurn: false, turn: false, ttsChar: false,
    transfer: false, tools: false, rag: false,
  })

  // Dynamic tools from backend
  const [backendTools, setBackendTools] = useState<BackendTool[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)

  // Custom tool dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingTool, setEditingTool] = useState<CustomTool>(EMPTY_TOOL)
  const [parametersJson, setParametersJson] = useState('{}')
  const [headersJson, setHeadersJson] = useState('{"Content-Type": "application/json"}')
  const [jsonError, setJsonError] = useState('')

  const toggle = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

  // Fetch tools from /api/pipecat/tools on mount
  useEffect(() => {
    setToolsLoading(true)
    fetch('/api/pipecat/tools')
      .then(r => r.json())
      .then((data: BackendTool[]) => {
        if (Array.isArray(data)) setBackendTools(data)
      })
      .catch(() => {})
      .finally(() => setToolsLoading(false))
  }, [])

  const toggleBuiltin = (toolName: string) => {
    if (builtinTools.includes(toolName)) {
      onBuiltinToolsChange(builtinTools.filter(t => t !== toolName))
      // Remove config when tool is disabled
      const { [toolName]: _, ...rest } = toolConfigs
      onToolConfigsChange(rest)
    } else {
      onBuiltinToolsChange([...builtinTools, toolName])
      // Seed default config
      const tool = backendTools.find(t => t.name === toolName)
      if (tool && Object.keys(tool.config_schema).length > 0) {
        const defaults: Record<string, unknown> = {}
        Object.entries(tool.config_schema).forEach(([k, s]) => {
          if (s.default !== undefined) defaults[k] = s.default
        })
        onToolConfigsChange({ ...toolConfigs, [toolName]: defaults })
      }
    }
  }

  const updateToolConfig = (toolName: string, config: Record<string, unknown>) => {
    onToolConfigsChange({ ...toolConfigs, [toolName]: config })
  }

  // Custom tool dialog handlers
  const openAddDialog = () => {
    setEditingIndex(null); setEditingTool(EMPTY_TOOL)
    setParametersJson('{}'); setHeadersJson('{"Content-Type": "application/json"}')
    setJsonError(''); setIsDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const tool = customTools[index]
    setEditingIndex(index); setEditingTool({ ...tool })
    setParametersJson(JSON.stringify(tool.parameters || {}, null, 2))
    setHeadersJson(JSON.stringify(tool.headers || {}, null, 2))
    setJsonError(''); setIsDialogOpen(true)
  }

  const handleSave = () => {
    setJsonError('')
    let parsedParams: Record<string, unknown> = {}
    let parsedHeaders: Record<string, string> = {}
    try { parsedParams = JSON.parse(parametersJson || '{}') } catch { setJsonError('Invalid parameters JSON'); return }
    try { parsedHeaders = JSON.parse(headersJson || '{}') } catch { setJsonError('Invalid headers JSON'); return }
    const saved: CustomTool = { ...editingTool, parameters: parsedParams as any, headers: parsedHeaders }
    if (editingIndex !== null) {
      const updated = [...customTools]; updated[editingIndex] = saved
      onCustomToolsChange(updated)
    } else {
      onCustomToolsChange([...customTools, saved])
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-full overflow-y-auto">
      <div className="p-4 space-y-3">

        {/* ── RAG ─────────────────────────────────────────────────────── */}
        <Section id="rag" icon={<DatabaseIcon className="w-3.5 h-3.5" />} label="Knowledge Base (RAG)" open={openSections.rag} onToggle={() => toggle('rag')}>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            When enabled, relevant documents from the agent's knowledge base are injected into context each turn.
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">RAG Enabled</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {ragEnabled ? 'Knowledge base is active' : 'Knowledge base is disabled'}
              </p>
            </div>
            <Switch checked={ragEnabled} onCheckedChange={onRagEnabledChange} className="scale-75" />
          </div>
        </Section>

        {/* ── VAD ─────────────────────────────────────────────────────── */}
        <Section id="vad" icon={<MicIcon className="w-3.5 h-3.5" />} label="Voice Activity Detection" open={openSections.vad} onToggle={() => toggle('vad')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Controls when the agent detects speech start/stop.</p>
          {([
            { label: 'Confidence', field: 'confidence', value: vadConfidence, min: 0.1, max: 1, step: 0.05, def: 0.7, hint: 'Min score to classify audio as speech.' },
            { label: 'Start Secs', field: 'startSecs', value: vadStartSecs, min: 0.05, max: 1, step: 0.05, unit: 's', def: 0.2, hint: 'Speech must persist this long before SPEAKING state.' },
            { label: 'Stop Secs', field: 'stopSecs', value: vadStopSecs, min: 0.1, max: 2, step: 0.05, unit: 's', def: 0.8, hint: 'Silence required before exiting SPEAKING state.' },
            { label: 'Min Volume', field: 'minVolume', value: vadMinVolume, min: 0, max: 1, step: 0.05, def: 0.6, hint: 'Minimum volume to consider audio as speech.' },
          ] as { label: string; field: string; value: number; min: number; max: number; step: number; unit?: string; def: number; hint: string }[]).map(({ label, field, value, min, max, step, unit, def, hint }) => (
            <SliderRow
              key={field} label={label} value={value} min={min} max={max} step={step}
              unit={unit} hint={hint}
              onReset={() => onVadChange(field, def)}
              onChange={v => onVadChange(field, v)}
            />
          ))}
        </Section>

        {/* ── Smart Turn ───────────────────────────────────────────────── */}
        <Section id="smartTurn" icon={<BrainIcon className="w-3.5 h-3.5" />} label="Smart Turn Detection" open={openSections.smartTurn} onToggle={() => toggle('smartTurn')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            LocalSmartTurnAnalyzerV3 — analyses prosody and intonation for accurate end-of-turn detection.
          </p>
          {([
            { label: 'Stop Secs', field: 'stopSecs', value: smartTurnStopSecs, min: 0.5, max: 6, step: 0.5, unit: 's', def: 3.0, hint: 'Silence before confirming end-of-turn.' },
            { label: 'Pre-speech Buffer', field: 'preSpeechMs', value: smartTurnPreSpeechMs, min: 100, max: 1000, step: 50, unit: 'ms', def: 500, hint: 'Audio captured before speech for analysis context.' },
            { label: 'Max Segment Secs', field: 'maxDurSecs', value: smartTurnMaxDurSecs, min: 4, max: 20, step: 1, unit: 's', def: 8.0, hint: 'Max segment before rolling window kicks in.' },
          ] as { label: string; field: string; value: number; min: number; max: number; step: number; unit?: string; def: number; hint: string }[]).map(({ label, field, value, min, max, step, unit, def, hint }) => (
            <SliderRow
              key={field} label={label} value={value} min={min} max={max} step={step}
              unit={unit} hint={hint}
              onReset={() => onSmartTurnChange(field, def)}
              onChange={v => onSmartTurnChange(field, v)}
            />
          ))}
        </Section>

        {/* ── Turn Management ──────────────────────────────────────────── */}
        <Section id="turn" icon={<TimerIcon className="w-3.5 h-3.5" />} label="Turn Management" open={openSections.turn} onToggle={() => toggle('turn')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Controls LLM user aggregator timing.</p>
          <SliderRow
            label="Turn Stop Timeout" value={turnStopTimeout} min={1} max={15} step={0.5} unit="s"
            hint="Max seconds to wait for turn completion before forcing it through."
            onReset={() => onTurnChange('turnStopTimeout', 5.0)}
            onChange={v => onTurnChange('turnStopTimeout', v)}
          />
          <NullableSliderRow
            label="Idle Timeout" value={userIdleTimeout} defaultValue={10} min={0} max={30} step={1} unit="s"
            nullLabel="Disabled"
            hint="Seconds of silence before agent proactively speaks. Off = disabled."
            onChange={v => onTurnChange('userIdleTimeout', v)}
          />
        </Section>

        {/* ── TTS Voice Character ──────────────────────────────────────── */}
        <Section id="ttsChar" icon={<Volume2Icon className="w-3.5 h-3.5" />} label="TTS Voice Character" open={openSections.ttsChar} onToggle={() => toggle('ttsChar')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">ElevenLabs voice personality settings. Applied per-call.</p>
          <NullableSliderRow
            label="Stability" value={ttsStability} defaultValue={0.5} min={0} max={1} step={0.05}
            nullLabel="ElevenLabs default"
            hint="Higher = consistent/monotone. Lower = expressive. Sweet spot: 0.4–0.7."
            onChange={v => onTtsCharChange('stability', v)}
          />
          <NullableSliderRow
            label="Similarity Boost" value={ttsSimilarityBoost} defaultValue={0.75} min={0} max={1} step={0.05}
            nullLabel="ElevenLabs default"
            hint="How closely output matches cloned voice. Sweet spot: 0.6–0.85."
            onChange={v => onTtsCharChange('similarityBoost', v)}
          />
          <NullableSliderRow
            label="Style" value={ttsStyle} defaultValue={0} min={0} max={1} step={0.05}
            nullLabel="ElevenLabs default"
            hint="Style exaggeration. 0 = off (recommended). May increase latency."
            onChange={v => onTtsCharChange('style', v)}
          />
          <SliderRow
            label="Speed" value={ttsSpeed} min={0.7} max={1.2} step={0.05} unit="×"
            hint="0.7 = 30% slower, 1.0 = normal, 1.2 = 20% faster."
            onReset={() => onTtsCharChange('speed', 1.0)}
            onChange={v => onTtsCharChange('speed', v)}
          />
        </Section>

        {/* ── Transfer Number ──────────────────────────────────────────── */}
        <Section id="transfer" icon={<PhoneIcon className="w-3.5 h-3.5" />} label="Transfer Number" open={openSections.transfer} onToggle={() => toggle('transfer')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Default number to transfer calls to when transfer_call tool fires.
          </p>
          <Input
            value={transferNumber}
            onChange={e => onTransferNumberChange(e.target.value)}
            placeholder="+91XXXXXXXXXX"
            className="h-8 text-sm border-gray-200 dark:border-gray-700"
          />
        </Section>

        {/* ── Tools ────────────────────────────────────────────────────── */}
        <Collapsible open={openSections.tools} onOpenChange={() => toggle('tools')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <WrenchIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tools & Actions</span>
            </div>
            <div className="flex items-center gap-2">
              {toolsLoading && <RefreshCwIcon className="w-3 h-3 text-gray-400 animate-spin" />}
              <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.tools ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-5 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure actions your assistant can perform during conversations.
            </p>

            {/* Built-in tools — dynamic from backend */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Built-in Tools</Label>
              {backendTools.length === 0 && !toolsLoading && (
                <p className="text-xs text-gray-400 italic">No tools available</p>
              )}
              {backendTools.map(tool => {
                const enabled = builtinTools.includes(tool.name)
                const hasConfig = Object.keys(tool.config_schema).length > 0
                return (
                  <div key={tool.name}>
                    <div className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        {TOOL_ICONS[tool.name] ?? <WrenchIcon className="w-3 h-3 text-gray-400" />}
                        <div>
                          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{tool.name}</span>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{tool.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleBuiltin(tool.name)}
                        className="scale-75"
                      />
                    </div>

                    {/* Config for enabled tools with config schema */}
                    {enabled && hasConfig && (
                      <ToolConfigEditor
                        tool={tool}
                        config={(toolConfigs[tool.name] as Record<string, unknown>) ?? {}}
                        onChange={config => updateToolConfig(tool.name, config)}
                      />
                    )}

                    {/* Prompt hint for enabled tools */}
                    {enabled && tool.prompt_hint && (
                      <div className="ml-5 mt-1 mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-400">
                        <p className="font-medium mb-0.5">Prompt hint</p>
                        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{tool.prompt_hint}</pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-700" />

            {/* Custom HTTP tools */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Custom HTTP Tools
                  {customTools.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs px-1 py-0 h-4">{customTools.length}</Badge>
                  )}
                </Label>
                <Button size="sm" variant="outline" onClick={openAddDialog} className="h-6 text-xs px-2">
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              </div>

              {customTools.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 dark:bg-gray-900 rounded border border-dashed border-gray-300 dark:border-gray-700">
                  No custom tools configured
                </div>
              )}

              {customTools.map((tool, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CodeIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate block">{tool.name || 'unnamed'}</span>
                      <span className="text-xs text-gray-400 truncate block">{tool.url}</span>
                    </div>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 flex-shrink-0">{tool.method}</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(i)} className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700">
                      <EditIcon className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onCustomToolsChange(customTools.filter((_, j) => j !== i))} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

      </div>

      {/* Custom Tool Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingIndex !== null ? 'Edit' : 'Add'} Custom HTTP Tool</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">Tool Name</Label>
              <Input value={editingTool.name} onChange={e => setEditingTool(p => ({ ...p, name: e.target.value }))} placeholder="check_slot" className="h-7 text-xs font-mono" />
              <p className="text-xs text-gray-500">snake_case name — the LLM calls it by this name</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={editingTool.description} onChange={e => setEditingTool(p => ({ ...p, description: e.target.value }))} placeholder="Check available appointment slots." className="text-xs min-h-[60px] resize-none" rows={2} />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">URL</Label>
                <Input value={editingTool.url} onChange={e => setEditingTool(p => ({ ...p, url: e.target.value }))} placeholder="https://your-api.com/slots" className="h-7 text-xs" />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={editingTool.method} onValueChange={v => setEditingTool(p => ({ ...p, method: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GET', 'POST', 'PUT', 'DELETE'].map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parameters (JSON)</Label>
              <Textarea value={parametersJson} onChange={e => setParametersJson(e.target.value)} placeholder={`{\n  "doctor_id": { "type": "string", "description": "Doctor ID", "required": true }\n}`} className="text-xs font-mono min-h-[100px] resize-none" rows={4} />
              <p className="text-xs text-gray-500">GET → query string. POST → JSON body.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headers (JSON)</Label>
              <Textarea value={headersJson} onChange={e => setHeadersJson(e.target.value)} placeholder={`{ "Authorization": "Bearer YOUR_TOKEN" }`} className="text-xs font-mono min-h-[60px] resize-none" rows={2} />
            </div>
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-7 text-xs">Cancel</Button>
            <Button onClick={handleSave} className="flex-1 h-7 text-xs">{editingIndex !== null ? 'Update' : 'Add'} Tool</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}