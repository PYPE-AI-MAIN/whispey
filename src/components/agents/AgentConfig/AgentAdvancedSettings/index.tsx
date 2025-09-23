'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, SettingsIcon, MicIcon, UserIcon, WrenchIcon, MessageSquareIcon, BugIcon } from 'lucide-react'
import InterruptionSettings from './ConfigParents/InterruptionSettings'
import VoiceActivitySettings from './ConfigParents/VoiceActivitySettings'
import SessionBehaviourSettings from './ConfigParents/SessionBehaviourSettings'
import ToolsActionsSettings from './ConfigParents/ToolsActionsSettingsProps'
import FillerWordsSettings from './ConfigParents/FillerWordSettings'
import BugReportSettings from './ConfigParents/BugReportSettings'

interface AgentAdvancedSettingsProps {
    advancedSettings: {
      interruption: {
        allowInterruptions: boolean
        minInterruptionDuration: number
        minInterruptionWords: number
      }
      vad: {
        vadProvider: string
        minSilenceDuration: number
      }
      session: {
        preemptiveGeneration: 'enabled' | 'disabled'
        turn_detection: 'multilingual' | 'english' | 'disabled'
      }
      tools: {
        tools: Array<{
          id: string
          type: 'end_call' | 'handoff' | 'custom_function'
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
    }
    onFieldChange: (field: string, value: any) => void
  }

function AgentAdvancedSettings({ advancedSettings, onFieldChange }: AgentAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    interruption: false,
    vad: false,
    session: false,
    tools: false,
    fillers: false,
    bugs: false
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
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transforms ${openSections.session ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-2 ml-5 space-y-2">
            <SessionBehaviourSettings
              preemptiveGeneration={advancedSettings.session.preemptiveGeneration}
              turn_detection={advancedSettings.session.turn_detection}
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
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

        {/* Fillers Words & Natural Speech */}
        <Collapsible open={openSections.fillers} onOpenChange={() => toggleSection('fillers')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fillers Words & Natural Speech</span>
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

      </div>
    </div>
  )
}

export default AgentAdvancedSettings