// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/index.tsx
'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ChevronDownIcon, MicIcon, BrainIcon, TimerIcon,
  WrenchIcon, DatabaseIcon, Music2Icon, Webhook,
  PhoneCallIcon, MessageSquareIcon,
} from 'lucide-react'
import VadSettings from './ConfigParents/VadSettings'
import SmartTurnSettings from './ConfigParents/SmartTurnSettings'
import TurnManagementSettings from './ConfigParents/TurnManagementSettings'
import ToolsActionsSettings from './ConfigParents/ToolsActionsSettings'
import KnowledgeBaseSettings from './ConfigParents/KnowledgeBaseSettings'
import AmbientSoundSettings from './ConfigParents/AmbientSoundSettings'
import KeyboardSoundSettings from './ConfigParents/KeyboardSoundSettings'
import CallBehaviorSettings from './ConfigParents/CallBehaviorSettings'
import PromptRulesSettings from './ConfigParents/PromptRulesSettings'
import WebhookSettings from '@/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/WebhookSettings'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, { type: string; description: string; required: boolean }>
  headers: Record<string, string>
  filler_config?: {
    enabled: boolean
    threshold: number
    interval: number
    mode: 'random' | 'sequential'
    messages: string[]
  }
}

interface PipecatAdvancedSettingsProps {
  // VAD
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
  onVadChange: (field: string, value: number) => void
  minAudioDuration: number
  onMinAudioDurationChange: (v: number) => void
  // Transfer
  transferNumber: string
  onTransferNumberChange: (value: string) => void
  acefoneToken: string
  onAcefoneTokenChange: (value: string) => void
  // Tools
  builtinTools: string[]
  onBuiltinToolsChange: (tools: string[]) => void
  toolConfigs: Record<string, Record<string, unknown>>
  onToolConfigsChange: (configs: Record<string, Record<string, unknown>>) => void
  customTools: CustomTool[]
  onCustomToolsChange: (tools: CustomTool[]) => void
  // Smart Turn
  smartTurnEnabled: boolean
  onSmartTurnEnabledChange: (v: boolean) => void
  smartTurnStopSecs: number
  smartTurnPreSpeechMs: number
  smartTurnMaxDurSecs: number
  onSmartTurnChange: (field: string, value: number) => void
  // Turn Management
  turnStopTimeout: number
  userIdleTimeout: number | null
  idleNudges: string[]
  onTurnChange: (field: string, value: number | null) => void
  onIdleNudgesChange: (v: string[]) => void
  // Call behavior
  allowInterruptions: boolean
  onAllowInterruptionsChange: (v: boolean) => void
  minInterruptionDurationMs: number
  onMinInterruptionDurationMsChange: (v: number) => void
  noiseCancellation: string
  onNoiseCancellationChange: (v: string) => void
  enableMetrics: boolean
  onEnableMetricsChange: (v: boolean) => void
  answerDelaySecs: number | null
  onAnswerDelaySecsChange: (v: number | null) => void
  maxCallDurationSecs: number | null
  onMaxCallDurationSecsChange: (v: number | null) => void
  // Prompt rule blocks (per-agent overrides)
  responseRules: string
  onResponseRulesChange: (v: string) => void
  callClosureRules: string
  onCallClosureRulesChange: (v: string) => void
  transferGatingRules: string
  onTransferGatingRulesChange: (v: string) => void
  dynamicContextTemplate: string
  onDynamicContextTemplateChange: (v: string) => void
  // RAG
  ragEnabled: boolean
  onRagEnabledChange: (v: boolean) => void
  ragNResults: number
  onRagNResultsChange: (v: number) => void
  ragFillerEnabled: boolean
  onRagFillerEnabledChange: (v: boolean) => void
  ragFillerPhrases: string[]
  onRagFillerPhrasesChange: (v: string[]) => void
  // Ambient Sound
  ambientSoundEnabled: boolean
  ambientSoundVolume: number
  onAmbientSoundEnabledChange: (v: boolean) => void
  onAmbientSoundVolumeChange: (v: number) => void
  // Keyboard Sound
  keyboardSoundEnabled: boolean
  keyboardSoundVolume: number
  keyboardSoundProbability: number
  keyboardSoundOnToolCalls: boolean
  onKeyboardSoundEnabledChange: (v: boolean) => void
  onKeyboardSoundVolumeChange: (v: number) => void
  onKeyboardSoundProbabilityChange: (v: number) => void
  onKeyboardSoundOnToolCallsChange: (v: boolean) => void
  projectId?: string
  agentId?: string
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, label, open, onToggle, children }: {
  icon: React.ReactNode; label: string; open: boolean; onToggle: () => void; children: React.ReactNode
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
        <CollapsibleContent className="mt-2 ml-5 space-y-2">{children}</CollapsibleContent>
      </Collapsible>
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-3" />
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PipecatAdvancedSettings({
  vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume, onVadChange,
  minAudioDuration, onMinAudioDurationChange,
  transferNumber, onTransferNumberChange,
  acefoneToken, onAcefoneTokenChange,
  builtinTools, onBuiltinToolsChange,
  toolConfigs, onToolConfigsChange,
  customTools, onCustomToolsChange,
  smartTurnEnabled, onSmartTurnEnabledChange,
  smartTurnStopSecs, smartTurnPreSpeechMs, smartTurnMaxDurSecs, onSmartTurnChange,
  turnStopTimeout, userIdleTimeout, idleNudges, onTurnChange, onIdleNudgesChange,
  allowInterruptions, onAllowInterruptionsChange,
  minInterruptionDurationMs, onMinInterruptionDurationMsChange,
  noiseCancellation, onNoiseCancellationChange,
  enableMetrics, onEnableMetricsChange,
  answerDelaySecs, onAnswerDelaySecsChange,
  maxCallDurationSecs, onMaxCallDurationSecsChange,
  responseRules, onResponseRulesChange,
  callClosureRules, onCallClosureRulesChange,
  transferGatingRules, onTransferGatingRulesChange,
  dynamicContextTemplate, onDynamicContextTemplateChange,
  ragEnabled, onRagEnabledChange,
  ragNResults, onRagNResultsChange,
  ragFillerEnabled, onRagFillerEnabledChange,
  ragFillerPhrases, onRagFillerPhrasesChange,
  ambientSoundEnabled, ambientSoundVolume, onAmbientSoundEnabledChange, onAmbientSoundVolumeChange,
  keyboardSoundEnabled, keyboardSoundVolume, keyboardSoundProbability, keyboardSoundOnToolCalls,
  onKeyboardSoundEnabledChange, onKeyboardSoundVolumeChange, onKeyboardSoundProbabilityChange, onKeyboardSoundOnToolCallsChange,
  projectId, agentId,
}: PipecatAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vad: false,
    smartTurn: false,
    turn: false,
    callBehavior: false,
    promptRules: false,
    tools: false,
    rag: false,
    ambient: false,
    webhook: false,
  })

  const toggle = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

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
            minAudioDuration={minAudioDuration}
            onMinAudioDurationChange={onMinAudioDurationChange}
          />
        </Section>

        {/* Smart Turn */}
        <Section icon={<BrainIcon className="w-3.5 h-3.5" />} label="Smart Turn Detection" open={openSections.smartTurn} onToggle={() => toggle('smartTurn')}>
          <SmartTurnSettings
            smartTurnEnabled={smartTurnEnabled}
            onSmartTurnEnabledChange={onSmartTurnEnabledChange}
            smartTurnStopSecs={smartTurnStopSecs}
            smartTurnPreSpeechMs={smartTurnPreSpeechMs}
            smartTurnMaxDurSecs={smartTurnMaxDurSecs}
            onSmartTurnChange={onSmartTurnChange}
          />
        </Section>

        {/* Turn Management */}
        <Section icon={<TimerIcon className="w-3.5 h-3.5" />} label="Turn Management" open={openSections.turn} onToggle={() => toggle('turn')}>
          <TurnManagementSettings
            turnStopTimeout={turnStopTimeout}
            userIdleTimeout={userIdleTimeout}
            idleNudges={idleNudges}
            onTurnChange={onTurnChange}
            onIdleNudgesChange={onIdleNudgesChange}
          />
        </Section>

        {/* Call Behavior (noise cancellation, metrics, interruptions, delays, max duration) */}
        <Section
          icon={<PhoneCallIcon className="w-3.5 h-3.5" />}
          label="Call Behavior"
          open={openSections.callBehavior}
          onToggle={() => toggle('callBehavior')}
        >
          <CallBehaviorSettings
            noiseCancellation={noiseCancellation}
            onNoiseCancellationChange={onNoiseCancellationChange}
            enableMetrics={enableMetrics}
            onEnableMetricsChange={onEnableMetricsChange}
            allowInterruptions={allowInterruptions}
            onAllowInterruptionsChange={onAllowInterruptionsChange}
            minInterruptionDurationMs={minInterruptionDurationMs}
            onMinInterruptionDurationMsChange={onMinInterruptionDurationMsChange}
            answerDelaySecs={answerDelaySecs}
            onAnswerDelaySecsChange={onAnswerDelaySecsChange}
            maxCallDurationSecs={maxCallDurationSecs}
            onMaxCallDurationSecsChange={onMaxCallDurationSecsChange}
          />
        </Section>

        {/* Prompt Rules (per-agent overrides of injected RESPONSE / TRANSFER / CLOSURE blocks) */}
        <Section
          icon={<MessageSquareIcon className="w-3.5 h-3.5" />}
          label="Prompt Rule Overrides"
          open={openSections.promptRules}
          onToggle={() => toggle('promptRules')}
        >
          <PromptRulesSettings
            responseRules={responseRules}
            onResponseRulesChange={onResponseRulesChange}
            callClosureRules={callClosureRules}
            onCallClosureRulesChange={onCallClosureRulesChange}
            transferGatingRules={transferGatingRules}
            onTransferGatingRulesChange={onTransferGatingRulesChange}
            dynamicContextTemplate={dynamicContextTemplate}
            onDynamicContextTemplateChange={onDynamicContextTemplateChange}
          />
        </Section>

        {/* Call Behavior (noise cancellation, metrics, interruptions, delays, max duration) */}
        <Section
          icon={<PhoneCallIcon className="w-3.5 h-3.5" />}
          label="Call Behavior"
          open={openSections.callBehavior}
          onToggle={() => toggle('callBehavior')}
        >
          <CallBehaviorSettings
            noiseCancellation={noiseCancellation}
            onNoiseCancellationChange={onNoiseCancellationChange}
            enableMetrics={enableMetrics}
            onEnableMetricsChange={onEnableMetricsChange}
            allowInterruptions={allowInterruptions}
            onAllowInterruptionsChange={onAllowInterruptionsChange}
            minInterruptionDurationMs={minInterruptionDurationMs}
            onMinInterruptionDurationMsChange={onMinInterruptionDurationMsChange}
            answerDelaySecs={answerDelaySecs}
            onAnswerDelaySecsChange={onAnswerDelaySecsChange}
            maxCallDurationSecs={maxCallDurationSecs}
            onMaxCallDurationSecsChange={onMaxCallDurationSecsChange}
          />
        </Section>

        {/* Prompt Rules (per-agent overrides of injected RESPONSE / TRANSFER / CLOSURE blocks) */}
        <Section
          icon={<MessageSquareIcon className="w-3.5 h-3.5" />}
          label="Prompt Rule Overrides"
          open={openSections.promptRules}
          onToggle={() => toggle('promptRules')}
        >
          <PromptRulesSettings
            responseRules={responseRules}
            onResponseRulesChange={onResponseRulesChange}
            callClosureRules={callClosureRules}
            onCallClosureRulesChange={onCallClosureRulesChange}
            transferGatingRules={transferGatingRules}
            onTransferGatingRulesChange={onTransferGatingRulesChange}
            dynamicContextTemplate={dynamicContextTemplate}
            onDynamicContextTemplateChange={onDynamicContextTemplateChange}
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
            acefoneToken={acefoneToken}
            onAcefoneTokenChange={onAcefoneTokenChange}
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
            ragNResults={ragNResults}
            onRagNResultsChange={onRagNResultsChange}
            ragFillerEnabled={ragFillerEnabled}
            onRagFillerEnabledChange={onRagFillerEnabledChange}
            ragFillerPhrases={ragFillerPhrases}
            onRagFillerPhrasesChange={onRagFillerPhrasesChange}
          />
        </Section>

        {/* Background Sounds */}
        <Section icon={<Music2Icon className="w-3.5 h-3.5" />} label="Background Sounds" open={openSections.ambient} onToggle={() => toggle('ambient')}>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Ambient</p>
          <AmbientSoundSettings ambientSoundEnabled={ambientSoundEnabled} ambientSoundVolume={ambientSoundVolume} onAmbientSoundEnabledChange={onAmbientSoundEnabledChange} onAmbientSoundVolumeChange={onAmbientSoundVolumeChange} />
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-4" />
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Keyboard Typing</p>
          <KeyboardSoundSettings keyboardSoundEnabled={keyboardSoundEnabled} keyboardSoundVolume={keyboardSoundVolume} keyboardSoundProbability={keyboardSoundProbability} keyboardSoundOnToolCalls={keyboardSoundOnToolCalls} onKeyboardSoundEnabledChange={onKeyboardSoundEnabledChange} onKeyboardSoundVolumeChange={onKeyboardSoundVolumeChange} onKeyboardSoundProbabilityChange={onKeyboardSoundProbabilityChange} onKeyboardSoundOnToolCallsChange={onKeyboardSoundOnToolCallsChange} />
        </Section>

        {/* Webhook */}
        <Section icon={<Webhook className="w-3.5 h-3.5" />} label="Webhook Configuration" open={openSections.webhook} onToggle={() => toggle('webhook')}>
          <WebhookSettings triggerOnCallLog={false} webhookUrl="" httpMethod="POST" headers={{}} isActive={false} onFieldChange={() => {}} agentId={agentId} projectId={projectId} />
        </Section>

      </div>
    </div>
  )
}