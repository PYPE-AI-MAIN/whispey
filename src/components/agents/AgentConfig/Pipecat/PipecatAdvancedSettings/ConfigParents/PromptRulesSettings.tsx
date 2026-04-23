// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/PromptRulesSettings.tsx
'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PromptRulesSettingsProps {
  responseRules: string
  onResponseRulesChange: (v: string) => void
  callClosureRules: string
  onCallClosureRulesChange: (v: string) => void
  transferGatingRules: string
  onTransferGatingRulesChange: (v: string) => void
  dynamicContextTemplate: string
  onDynamicContextTemplateChange: (v: string) => void
}

function BlockField({
  label, value, placeholder, hint, tooltip, onChange,
}: {
  label: string
  value: string
  placeholder: string
  hint?: string
  tooltip?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-600 dark:text-gray-400">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xs font-mono min-h-[90px] resize-y border-gray-200 dark:border-gray-700"
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

export default function PromptRulesSettings(props: PromptRulesSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          These blocks are appended to the system prompt by the bot. Leave empty to use the
          sensible Pipecat defaults.
        </p>

        <BlockField
          label="Response Rules"
          value={props.responseRules}
          onChange={props.onResponseRulesChange}
          placeholder="RESPONSE RULES (apply every turn):&#10;- ..."
          hint="How the agent should respond turn-by-turn (greeting handling, tone, etc.)."
          tooltip="Overrides the built-in RESPONSE RULES block. Leave empty to use the default."
        />

        <BlockField
          label="Transfer Gating Rules"
          value={props.transferGatingRules}
          onChange={props.onTransferGatingRulesChange}
          placeholder="TRANSFER_CALL GATE (apply BEFORE any transfer):&#10;- ..."
          hint="Conditions under which transfer_call may be invoked."
          tooltip="Overrides the TRANSFER_CALL GATE block. Empty = default (require explicit yes)."
        />

        <BlockField
          label="Call Closure Rules"
          value={props.callClosureRules}
          onChange={props.onCallClosureRulesChange}
          placeholder="CALL CLOSURE RULES:&#10;- ..."
          hint="When and how the agent should end the call (end_call vs transfer_call)."
          tooltip="Overrides CALL CLOSURE RULES. Empty = default (end_call after 'no')."
        />

        <BlockField
          label="Dynamic Context Template"
          value={props.dynamicContextTemplate}
          onChange={props.onDynamicContextTemplateChange}
          placeholder={'CURRENT CONTEXT:\n- Current Time: {{current_time}}\n- Caller: {{caller_number}}'}
          hint="If set, replaces the entire CURRENT CONTEXT + rules block. Supports {{current_time}}, {{current_date}}, {{caller_number}}, {{provider}}, {{call_type}}, plus any metadata key."
          tooltip="Power-user override. When set, all three rule blocks above are ignored — provide the complete context + rules yourself."
        />
      </div>
    </TooltipProvider>
  )
}
