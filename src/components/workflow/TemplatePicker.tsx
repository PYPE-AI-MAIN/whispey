'use client'

import React, { useState } from 'react'
import { Sparkles, ArrowRight, ArrowUp, MessageSquare, GitBranch, Layout, Stethoscope } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/lib/workflow/templates'

const ICONS: Record<string, React.ElementType> = {
  blank: Layout,
  'appointment-booking': MessageSquare,
  'lead-qualification': GitBranch,
  'ortho-triage': Stethoscope,
}

const COLORS: Record<string, string> = {
  blank: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  'appointment-booking': 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
  'lead-qualification': 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
  'ortho-triage': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
}

export function TemplatePicker({
  onPick,
  onStartWithPrompt,
}: Readonly<{ onPick: (template: WorkflowTemplate) => void; onStartWithPrompt: (prompt: string) => void }>) {
  const [prompt, setPrompt] = useState('')

  const submit = () => {
    const text = prompt.trim()
    if (text) onStartWithPrompt(text)
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">What should this agent do?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Describe the call in plain language — AI Builder writes the flow, you can edit anything after.
          </p>
        </div>

        <div className="relative mb-8">
          <Textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="e.g. Call leads about our appointment slots, confirm their name and preferred time, and offer a callback if they're busy."
            className="min-h-[100px] pr-12 bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 shadow-sm"
          />
          <Button
            size="icon"
            className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-full"
            disabled={!prompt.trim()}
            onClick={submit}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">or start from a template</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORKFLOW_TEMPLATES.map((t) => {
            const Icon = ICONS[t.id] || Layout
            const color = COLORS[t.id] || COLORS.blank
            return (
              <Card key={t.id} className="bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer" onClick={() => onPick(t)}>
                <CardHeader>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-1 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm">{t.label}</CardTitle>
                  <CardDescription className="text-xs">{t.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => onPick(t)}>
                    Use this <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
