'use client'

import React from 'react'
import { Sparkles, ArrowRight, MessageSquare, BookOpen, GitBranch, Layout } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/lib/workflow/templates'

const ICONS: Record<string, React.ElementType> = {
  blank: Layout,
  'appointment-booking': MessageSquare,
  'faq-bot': BookOpen,
  'lead-qualification': GitBranch,
}

export function TemplatePicker({ onPick }: { onPick: (template: WorkflowTemplate) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 overflow-y-auto">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Start your conversation flow</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Pick a starting point — every template is fully editable on the canvas afterward.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {WORKFLOW_TEMPLATES.map((t) => {
            const Icon = ICONS[t.id] || Layout
            return (
              <Card key={t.id} className="hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <CardHeader>
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-1">
                    <Icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
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
