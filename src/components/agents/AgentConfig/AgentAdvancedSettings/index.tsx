// src/components/agents/AgentConfig/AgentAdvancedSettings/index.tsx
'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, SettingsIcon, MicIcon, UserIcon, WrenchIcon, MessageSquareIcon, BugIcon, PhoneOff } from 'lucide-react'
import InterruptionSettings from './ConfigParents/InterruptionSettings'
import VoiceActivitySettings from './ConfigParents/VoiceActivitySettings'
import SessionBehaviourSettings from './ConfigParents/SessionBehaviourSettings'
import ToolsActionsSettings from './ConfigParents/ToolsActionsSettingsProps'
import FillerWordsSettings from './ConfigParents/FillerWordSettings'
import BugReportSettings from './ConfigParents/BugReportSettings'
import { Volume2, Webhook, ArrowRightLeft } from 'lucide-react'
import BackgroundAudioSettings from '../BackgroundAudioSettings.tsx'
import WebhookSettings from './ConfigParents/WebhookSettings'
import DropOffCallSettings from './ConfigParents/DropOffCallSettings'
import DynamicTTSSwitch from '../DynamicTTSSwitch'
import DynamicSTTSwitch from '../DynamicSTTSwitch'

interface AgentAdvancedSettingsProps {
    agentId?: string
    advancedSettings: {
      interruption: {
        allowInterruptions: boolean
        minInterruptionDuration: number
        minInterruptionWords: number
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
        user_away_timeout?: number
        user_away_timeout_message?: string
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
        generalFillers: string[]
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
      }
      webhook?: {
        triggerOnCallLog: boolean
        webhookUrl: string
        httpMethod: string
        headers: Record<string, string>
        isActive: boolean
      }
    }
    onFieldChange: (field: string, value: any) => void
    projectId?: string
    dynamicTTSList?: any[]
    onDynamicTTSChange?: (dynamicTTSList: any[]) => void
    dynamicSTTList?: any[]
    onDynamicSTTChange?: (dynamicSTTList: any[]) => void
  }

function AgentAdvancedSettings({ advancedSettings, onFieldChange, projectId, agentId, dynamicTTSList = [], onDynamicTTSChange, dynamicSTTList = [], onDynamicSTTChange }: AgentAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interruption: false,
    vad: false,
    session: false,
    tools: false,
    fillers: false,
    bugs: false,
    backgroundAudio: false,
    ttsSwitcher: false,
    sttSwitcher: false,
    webhook: false,
    dropoff: false,
    ttsSwitcher: false
  })
  
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
              user_away_timeout={advancedSettings.session.user_away_timeout}
              user_away_timeout_message={advancedSettings.session.user_away_timeout_message}
              onFieldChange={onFieldChange}
            />
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
              enableFillerWords={advancedSettings.fillers.enableFillerWords}
              generalFillers={advancedSettings.fillers.generalFillers}
              conversationFillers={advancedSettings.fillers.conversationFillers}
              conversationKeywords={advancedSettings.fillers.conversationKeywords}
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

        {/* STT Switcher Section */}
        <Collapsible
          open={openSections.sttSwitcher}
          onOpenChange={(open) => setOpenSections(prev => ({ ...prev, sttSwitcher: open }))}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 transition-colors">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">STT Switcher</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.sttSwitcher ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <DynamicSTTSwitch
              dynamicSTTList={dynamicSTTList}
              onDynamicSTTChange={onDynamicSTTChange}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

      </div>
    </div>
  )
}

export default AgentAdvancedSettings