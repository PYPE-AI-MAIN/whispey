// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/index.tsx
'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChevronDownIcon, MicIcon, BrainIcon, TimerIcon,
  Volume2Icon, WrenchIcon, DatabaseIcon, Music2Icon,
} from 'lucide-react'
import VadSettings from './ConfigParents/VadSettings'
import SmartTurnSettings from './ConfigParents/SmartTurnSettings'
import TurnManagementSettings from './ConfigParents/TurnManagementSettings'
import TtsVoiceCharSettings from './ConfigParents/TtsVoiceCharSettings'
import ToolsActionsSettings from './ConfigParents/ToolsActionsSettings'
import KnowledgeBaseSettings from './ConfigParents/KnowledgeBaseSettings'
import AmbientSoundSettings from './ConfigParents/AmbientSoundSettings'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, { type: string; description: string; required: boolean }>
  headers: Record<string, string>
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
  // Ambient Sound
  ambientSoundEnabled: boolean
  ambientSoundVolume: number
  onAmbientSoundEnabledChange: (v: boolean) => void
  onAmbientSoundVolumeChange: (v: number) => void
  projectId?: string
}

// ── Section wrapper — mirrors LiveKit AgentAdvancedSettings pattern ────────────

function Section({
  icon, label, open, onToggle, children,
}: {
  icon: React.ReactNode
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <Collapsible open={open} onOpenChange={onToggle}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{icon}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          </div>
          <ChevronDownIcon
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 ml-5 space-y-2">
          {children}
        </CollapsibleContent>
      </Collapsible>
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

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
  ambientSoundEnabled, ambientSoundVolume, onAmbientSoundEnabledChange, onAmbientSoundVolumeChange,
}: PipecatAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vad: false,
    smartTurn: false,
    turn: false,
    ttsChar: false,
    tools: false,
    rag: false,
    ambient: false,
  })

  const toggle = (s: string) =>
    setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-full overflow-y-auto">
      <div className="p-4 space-y-3">

        <Section
          icon={<MicIcon className="w-3.5 h-3.5" />}
          label="Voice Activity Detection (VAD)"
          open={openSections.vad}
          onToggle={() => toggle('vad')}
        >
          <VadSettings
            vadConfidence={vadConfidence}
            vadStartSecs={vadStartSecs}
            vadStopSecs={vadStopSecs}
            vadMinVolume={vadMinVolume}
            onVadChange={onVadChange}
          />
        </Section>

        <Section
          icon={<BrainIcon className="w-3.5 h-3.5" />}
          label="Smart Turn Detection"
          open={openSections.smartTurn}
          onToggle={() => toggle('smartTurn')}
        >
          <SmartTurnSettings
            smartTurnStopSecs={smartTurnStopSecs}
            smartTurnPreSpeechMs={smartTurnPreSpeechMs}
            smartTurnMaxDurSecs={smartTurnMaxDurSecs}
            onSmartTurnChange={onSmartTurnChange}
          />
        </Section>

        <Section
          icon={<TimerIcon className="w-3.5 h-3.5" />}
          label="Turn Management"
          open={openSections.turn}
          onToggle={() => toggle('turn')}
        >
          <TurnManagementSettings
            turnStopTimeout={turnStopTimeout}
            userIdleTimeout={userIdleTimeout}
            onTurnChange={onTurnChange}
          />
        </Section>

        <Section
          icon={<Volume2Icon className="w-3.5 h-3.5" />}
          label="TTS Voice Character"
          open={openSections.ttsChar}
          onToggle={() => toggle('ttsChar')}
        >
          <TtsVoiceCharSettings
            ttsStability={ttsStability}
            ttsSimilarityBoost={ttsSimilarityBoost}
            ttsStyle={ttsStyle}
            ttsSpeed={ttsSpeed}
            onTtsCharChange={onTtsCharChange}
          />
        </Section>

        <Section
          icon={<WrenchIcon className="w-3.5 h-3.5" />}
          label="Tools & Actions"
          open={openSections.tools}
          onToggle={() => toggle('tools')}
        >
          <ToolsActionsSettings
            builtinTools={builtinTools}
            onBuiltinToolsChange={onBuiltinToolsChange}
            toolConfigs={toolConfigs}
            onToolConfigsChange={onToolConfigsChange}
            customTools={customTools}
            onCustomToolsChange={onCustomToolsChange}
            transferNumber={transferNumber}
            onTransferNumberChange={onTransferNumberChange}
          />
        </Section>

        <Section
          icon={<DatabaseIcon className="w-3.5 h-3.5" />}
          label="Knowledge Base (RAG)"
          open={openSections.rag}
          onToggle={() => toggle('rag')}
        >
          <KnowledgeBaseSettings
            ragEnabled={ragEnabled}
            onRagEnabledChange={onRagEnabledChange}
          />
        </Section>

        <Section
          icon={<Music2Icon className="w-3.5 h-3.5" />}
          label="Ambient Background Sound"
          open={openSections.ambient}
          onToggle={() => toggle('ambient')}
        >
          <AmbientSoundSettings
            ambientSoundEnabled={ambientSoundEnabled}
            ambientSoundVolume={ambientSoundVolume}
            onAmbientSoundEnabledChange={onAmbientSoundEnabledChange}
            onAmbientSoundVolumeChange={onAmbientSoundVolumeChange}
          />
        </Section>

      </div>
    </div>
  )
}