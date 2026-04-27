// src/components/agents/AgentConfig/AgentAdvancedSettings/index.tsx
'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, SettingsIcon, MicIcon, UserIcon, WrenchIcon, MessageSquareIcon, BugIcon, PhoneOff, Zap, Copy, Check, PhoneCall } from 'lucide-react'
import InterruptionSettings from './ConfigParents/InterruptionSettings'
import VoiceActivitySettings from './ConfigParents/VoiceActivitySettings'
import SessionBehaviourSettings from './ConfigParents/SessionBehaviourSettings'
import ToolsActionsSettings from './ConfigParents/ToolsActionsSettingsProps'
import FillerWordsSettings from './ConfigParents/FillerWordSettings'
import BugReportSettings from './ConfigParents/BugReportSettings'
import { Volume2, Webhook, ArrowRightLeft, BookOpen } from 'lucide-react'
import BackgroundAudioSettings from '../BackgroundAudioSettings.tsx'
import WebhookSettings from './ConfigParents/WebhookSettings'
import DropOffCallSettings from './ConfigParents/DropOffCallSettings'
import CallbackSettings from '@/components/projects/CallbackSettings'
import DynamicTTSSwitch from '../DynamicTTSSwitch'
import KnowledgeBaseRAGSettings from './ConfigParents/KnowledgeBaseRAGSettings'
import ContextMemorySettings from './ConfigParents/ContextMemorySettings'

interface AgentAdvancedSettingsProps {
    agentId?: string
    advancedSettings: {
      interruption: {
        allowInterruptions: boolean
        minInterruptionDuration: number
        minInterruptionWords: number
        dropFillerWords?: boolean
        fillerDropList?: string[]
      }
      vad: {
        vadProvider: string
        minSilenceDuration: number
        minSpeechDuration?: number
        prefixPaddingDuration?: number
        maxBufferedSpeech?: number
        activationThreshold?: number
        sampleRate?: 8000 | 16000 | undefined
        forceCpu?: boolean
      }
      session: {
        preemptiveGeneration: 'enabled' | 'disabled'
        turn_detection: 'multilingual' | 'english' | 'smollm2turndetector' | 'llmturndetector' | 'smollm360m' | 'disabled'
        unlikely_threshold?: number
        min_endpointing_delay?: number
        max_endpointing_delay?: number
        endpointing_mode?: string | null
        interruption_mode?: string | null
        user_away_timeout?: number
        user_away_timeout_message?: string
        user_away_timeout_max_count?: number
        user_away_timeout_end_message?: string
      }
      tools: {
        tools: Array<{
          id: string
          type: 'end_call' | 'handoff' | 'custom_function' | 'transfer_call' | 'ivr_navigator' | 'nearby_location_finder' | 'update_vad_options'
          name: string
          config: any
        }>
      }
      fillers: {
        enableFillerWords: boolean
        language: 'auto' | 'en' | 'hi'
        questionKeywords: string[]
        questionFillers: string[]
        ambiguousKeywords: string[]
        ambiguousFillers: string[]
        generalFillers: string[]
        fillerCooldownSec: number
        latencyThreshold: number
        conversationFillers: string[]
        conversationKeywords: string[]
      }
      bugs: {
        enableBugReport: boolean
        bugStartCommands: string[]
        bugEndCommands: string[]
        initialResponse: string
        collectionPrompt: string
      }
      backgroundAudio?: {
        mode: 'disabled' | 'single' | 'dual'
        singleType: string
        singleVolume: number
        singleTiming: 'thinking' | 'always'
        ambientType: string
        ambientVolume: number
        thinkingType: string
        thinkingVolume: number
        thinkingProbability?: number
        toolCallTyping?: boolean
        toolCallVolume?: number
      }
      webhook?: {
        triggerOnCallLog: boolean
        webhookUrl: string
        httpMethod: string
        headers: Record<string, string>
        isActive: boolean
      }
      knowledgeBase?: {
        enabled: boolean
        topK: number
      }
      contextMemory?: {
        enabled: boolean
      }
    }
    onFieldChange: (field: string, value: any) => void
    projectId?: string
    dynamicTTSList?: any[]
    onDynamicTTSChange?: (dynamicTTSList: any[]) => void
  }

const EOD_PROMPT_SNIPPET =
  'When the conversation is fully resolved and you have said your goodbye, append <eod/> at the very end of your response.'

function AgentAdvancedSettings({ advancedSettings, onFieldChange, projectId, agentId, dynamicTTSList = [], onDynamicTTSChange }: AgentAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interruption: false,
    vad: false,
    session: false,
    eod: false,
    tools: false,
    fillers: false,
    bugs: false,
    backgroundAudio: false,
    webhook: false,
    dropoff: false,
    callbackScheduling: false,
    ttsSwitcher: false,
    knowledgeBase: false,
    contextMemory: false
  })
  const [eodCopied, setEodCopied] = useState(false)

  const handleEodCopy = async () => {
    try {
      await navigator.clipboard.writeText(EOD_PROMPT_SNIPPET)
      setEodCopied(true)
      setTimeout(() => setEodCopied(false), 2000)
    } catch {
      // clipboard not available in non-secure contexts — silently ignore
    }
  }
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        
        {/* Interruption Configuration */}
        <Collapsible open={openSections.interruption} onOpenChange={() => toggleSection('interruption')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Interruption Configuration</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.interruption ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <InterruptionSettings
              allowInterruptions={advancedSettings.interruption.allowInterruptions}
              minInterruptionDuration={advancedSettings.interruption.minInterruptionDuration}
              minInterruptionWords={advancedSettings.interruption.minInterruptionWords}
              dropFillerWords={advancedSettings.interruption.dropFillerWords ?? false}
              fillerDropList={advancedSettings.interruption.fillerDropList ?? []}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Voice Activity Detection (VAD) */}
        <Collapsible open={openSections.vad} onOpenChange={() => toggleSection('vad')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <MicIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Activity Detection (VAD)</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.vad ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <VoiceActivitySettings
              vadProvider={advancedSettings.vad.vadProvider}
              minSilenceDuration={advancedSettings.vad.minSilenceDuration}
              minSpeechDuration={advancedSettings.vad.minSpeechDuration}
              prefixPaddingDuration={advancedSettings.vad.prefixPaddingDuration}
              maxBufferedSpeech={advancedSettings.vad.maxBufferedSpeech}
              activationThreshold={advancedSettings.vad.activationThreshold}
              sampleRate={advancedSettings.vad.sampleRate}
              forceCpu={advancedSettings.vad.forceCpu}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Session Behaviour */}
        <Collapsible open={openSections.session} onOpenChange={() => toggleSection('session')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Session Behaviour</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.session ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <SessionBehaviourSettings
              preemptiveGeneration={advancedSettings.session.preemptiveGeneration}
              turn_detection={advancedSettings.session.turn_detection}
              unlikely_threshold={advancedSettings.session.unlikely_threshold}
              min_endpointing_delay={advancedSettings.session.min_endpointing_delay}
              max_endpointing_delay={advancedSettings.session.max_endpointing_delay}
              endpointing_mode={advancedSettings.session.endpointing_mode}
              interruption_mode={advancedSettings.session.interruption_mode}
              user_away_timeout={advancedSettings.session.user_away_timeout}
              user_away_timeout_message={advancedSettings.session.user_away_timeout_message}
              user_away_timeout_max_count={advancedSettings.session.user_away_timeout_max_count}
              user_away_timeout_end_message={advancedSettings.session.user_away_timeout_end_message}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* EOD Auto-Hangup */}
        <Collapsible open={openSections.eod} onOpenChange={() => toggleSection('eod')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">EOD Auto-Hangup</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.eod ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-3 space-y-2">

              {/* Description */}
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                The pipeline ends the call automatically when the LLM appends{' '}
                <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">
                  &lt;eod/&gt;
                </code>{' '}
                to its response. The tag is stripped before TTS — callers never hear it.
                After the agent finishes speaking a{' '}
                <strong className="text-blue-800 dark:text-blue-300">2-second silence window</strong>{' '}
                begins: if the caller speaks the hangup is cancelled; otherwise the call ends.
              </p>

              {/* Copyable prompt snippet */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                  Add this to your System Prompt to activate:
                </p>
                <div className="relative rounded bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700">
                  <pre className="text-xs font-mono text-blue-900 dark:text-blue-200 p-2 pr-8 whitespace-pre-wrap break-words leading-relaxed">
                    {EOD_PROMPT_SNIPPET}
                  </pre>
                  <button
                    onClick={handleEodCopy}
                    title="Copy to clipboard"
                    className="absolute top-1.5 right-1.5 p-1 rounded text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    {eodCopied
                      ? <Check className="w-3 h-3 text-green-500" />
                      : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Tools & Actions */}
        <Collapsible open={openSections.tools} onOpenChange={() => toggleSection('tools')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <WrenchIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tools & Actions</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.tools ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <ToolsActionsSettings
              tools={advancedSettings.tools.tools}
              onFieldChange={onFieldChange}
              projectId={projectId}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Fillers Words & Natural Speech */}
        <Collapsible open={openSections.fillers} onOpenChange={() => toggleSection('fillers')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fillers Words</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.fillers ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <FillerWordsSettings
              enableFillerWords={advancedSettings.fillers.enableFillerWords ?? true}
              questionKeywords={advancedSettings.fillers.questionKeywords ?? []}
              questionFillers={advancedSettings.fillers.questionFillers ?? []}
              ambiguousKeywords={advancedSettings.fillers.ambiguousKeywords ?? []}
              ambiguousFillers={advancedSettings.fillers.ambiguousFillers ?? []}
              generalFillers={advancedSettings.fillers.generalFillers ?? []}
              fillerCooldownSec={advancedSettings.fillers.fillerCooldownSec ?? 4.0}
              latencyThreshold={advancedSettings.fillers.latencyThreshold ?? 1.2}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Bug Report System */}
        <Collapsible open={openSections.bugs} onOpenChange={() => toggleSection('bugs')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <BugIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Bug Report System</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.bugs ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <BugReportSettings
              enableBugReport={advancedSettings.bugs.enableBugReport}
              bugStartCommands={advancedSettings.bugs.bugStartCommands}
              bugEndCommands={advancedSettings.bugs.bugEndCommands}
              initialResponse={advancedSettings.bugs.initialResponse}
              collectionPrompt={advancedSettings.bugs.collectionPrompt}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>
        
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Background Audio */}
        <Collapsible open={openSections.backgroundAudio} onOpenChange={() => toggleSection('backgroundAudio')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Background Audio</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.backgroundAudio ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <BackgroundAudioSettings
              mode={advancedSettings.backgroundAudio?.mode || 'disabled'}
              singleType={advancedSettings.backgroundAudio?.singleType || 'keyboard'}
              singleVolume={advancedSettings.backgroundAudio?.singleVolume || 0.5}
              singleTiming={advancedSettings.backgroundAudio?.singleTiming || 'thinking'}
              ambientType={advancedSettings.backgroundAudio?.ambientType || 'office'}
              ambientVolume={advancedSettings.backgroundAudio?.ambientVolume || 30}
              thinkingType={advancedSettings.backgroundAudio?.thinkingType || 'keyboard'}
              thinkingVolume={advancedSettings.backgroundAudio?.thinkingVolume || 0.5}
              thinkingProbability={advancedSettings.backgroundAudio?.thinkingProbability ?? 1.0}
              toolCallTyping={advancedSettings.backgroundAudio?.toolCallTyping ?? false}
              toolCallVolume={advancedSettings.backgroundAudio?.toolCallVolume ?? 0.8}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>


        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Webhook Configuration */}
        <Collapsible open={openSections.webhook} onOpenChange={() => toggleSection('webhook')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <Webhook className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Webhook Configuration</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.webhook ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <WebhookSettings
              triggerOnCallLog={advancedSettings.webhook?.triggerOnCallLog || false}
              webhookUrl={advancedSettings.webhook?.webhookUrl || ''}
              httpMethod={advancedSettings.webhook?.httpMethod || 'POST'}
              headers={advancedSettings.webhook?.headers || {}}
              isActive={advancedSettings.webhook?.isActive || false}
              onFieldChange={onFieldChange}
              agentId={agentId}
              projectId={projectId}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Drop-off Call Configuration */}
        <Collapsible open={openSections.dropoff} onOpenChange={() => toggleSection('dropoff')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <PhoneOff className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop-off Call Configuration</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.dropoff ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <DropOffCallSettings
              agentId={agentId || ''}
              projectId={projectId}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Callback Scheduling */}
        <Collapsible open={openSections.callbackScheduling} onOpenChange={() => toggleSection('callbackScheduling')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Callback Scheduling</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.callbackScheduling ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            {agentId && projectId ? (
              <CallbackSettings agentId={agentId} projectId={projectId} />
            ) : (
              <p className="text-xs text-gray-400">Agent / project not available</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* TTS Switcher */}
        <Collapsible open={openSections.ttsSwitcher} onOpenChange={() => toggleSection('ttsSwitcher')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">TTS Switcher</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.ttsSwitcher ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <DynamicTTSSwitch
              dynamicTTSList={dynamicTTSList}
              onDynamicTTSChange={onDynamicTTSChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Knowledge Base (RAG) */}
        <Collapsible open={openSections.knowledgeBase} onOpenChange={() => toggleSection('knowledgeBase')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RAG Settings</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.knowledgeBase ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <KnowledgeBaseRAGSettings
              enabled={advancedSettings.knowledgeBase?.enabled ?? false}
              topK={advancedSettings.knowledgeBase?.topK ?? 5}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Context Memory */}
        <Collapsible open={openSections.contextMemory} onOpenChange={() => toggleSection('contextMemory')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Context Memory</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.contextMemory ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <ContextMemorySettings
              enabled={advancedSettings.contextMemory?.enabled ?? false}
              onFieldChange={onFieldChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

      </div>
    </div>
  )
}

export default AgentAdvancedSettings