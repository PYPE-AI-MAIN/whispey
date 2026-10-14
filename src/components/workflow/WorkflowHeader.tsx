'use client'

import React from 'react'
import { AlertTriangle, ArrowLeft, History, PanelLeft, Webhook, BookOpen, Braces, ChevronDown, ClipboardPaste, Copy, Globe, Loader2, MoreHorizontal, PhoneIcon, Rocket, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { LintIssue } from '@/lib/workflow/linter'
import { useWorkflowStore } from '@/stores/workflowStore'
import { explainIssue } from '@/lib/workflow/plainIssues'

type HeaderProps = Readonly<{
  name: string
  onBack: () => void
  paletteOpen: boolean
  onTogglePalette: () => void
  serverIssues: LintIssue[]
  issuesOpen: boolean
  onIssuesOpenChange: (open: boolean) => void
  isDirty: boolean
  chatOpen: boolean
  onToggleChat: () => void
  onOpenAgent: () => void
  onOpenVariables: () => void
  onOpenRules: () => void
  rulesCount: number
  onOpenKnowledge: () => void
  onOpenHistory: () => void
  onOpenWebhook: () => void
  canTest: boolean
  onTest: () => void
  onValidate: () => void
  validating: boolean
  onPaste: () => void
  onCopy: () => void
  onDeploy: () => void
  deploying: boolean
  deployTitle?: string
}>

function FixStartButton({ id }: Readonly<{ id: string }>) {
  const setStart = useWorkflowStore((s) => s.setStart)
  const name = useWorkflowStore((s) => s.workflow?.nodes.find((n) => n.id === id)?.name || id)
  return (
    <button
      type="button"
      onClick={() => setStart(id)}
      className="mx-2 mb-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
    >
      Start with &ldquo;{name}&rdquo; instead
    </button>
  )
}

/** Problems with the flow, one click away from the step they are about. */
function Issues({ open, onOpenChange, serverIssues }: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; serverIssues: LintIssue[] }>) {
  const all = useWorkflowStore((s) => s.lintIssues)
  // Stall and dead-end warnings are about how the call recovers; the system handles that, so people building a flow do not see them.
  const quiet = (i: LintIssue) => i.severity === 'error' || !/can stall|can dead-end|catch-all|no Fallback edge/i.test(i.message)
  const issues = [...all, ...serverIssues.filter((x) => !all.some((a) => a.message === x.message && a.nodeId === x.nodeId))].filter(quiet)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const nodes = useWorkflowStore((s) => s.workflow?.nodes)
  if (!issues.length) return null
  const errors = issues.filter((i) => i.severity === 'error').length
  const label = errors ? `${errors} to fix` : `${issues.length} to check`
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
            errors ? 'border-red-300 bg-destructive/10 text-destructive dark:border-red-900  dark:text-red-300' : 'border-border bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60vh] w-96 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-xs text-muted-foreground">Click one to jump to the step.</p>
        <ul className="space-y-0.5">
          {issues.map((i) => (
            <li key={`${i.nodeId ?? i.edgeId ?? 'flow'}-${i.message}`}>
              <button
                type="button"
                disabled={!i.nodeId}
                onClick={() => i.nodeId && setSelectedNode(i.nodeId)}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className={i.severity === 'error' ? 'font-semibold text-destructive' : 'font-semibold text-warning'}>
                  {i.severity === 'error' ? 'Fix: ' : 'Check: '}
                </span>
                {explainIssue(i, { nodes: nodes ?? [] })}
              </button>
              {i.fixStartTo && <FixStartButton id={i.fixStartTo} />}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function WorkflowHeader(p: HeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-card px-4 py-2.5">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={p.onBack} aria-label="Back to the agent">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button variant={p.paletteOpen ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={p.onTogglePalette} aria-label="Steps list" title="List of steps, and all step types">
        <PanelLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-sm font-semibold text-foreground">{p.name}</h1>
      {p.isDirty && <Badge variant="secondary" className="text-[11px]">Unsaved</Badge>}

      <div className="flex-1" />

      <Issues open={p.issuesOpen} onOpenChange={p.onIssuesOpenChange} serverIssues={p.serverIssues} />

      <Button
        variant={p.chatOpen ? 'default' : 'outline'}
        size="sm"
        onClick={p.onToggleChat}
        className={p.chatOpen ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
        title="Describe what you want and Pi builds or edits the flow"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask Pi
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Setup <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={p.onOpenAgent}>
            <Settings2 className="mr-2 h-4 w-4" />
            <span>Voice, model and language</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onOpenVariables}>
            <Braces className="mr-2 h-4 w-4" />
            <span>Variables (name, phone, ...)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onOpenRules}>
            <Globe className="mr-2 h-4 w-4" />
            <span>Rules for any step{p.rulesCount ? ` (${p.rulesCount})` : ''}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onOpenKnowledge}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Knowledge base (documents)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onOpenWebhook}>
            <Webhook className="mr-2 h-4 w-4" />
            <span>Webhook (send calls to your system)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onOpenHistory}>
            <History className="mr-2 h-4 w-4" />
            <span>Version history</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={p.onTest}
        disabled={!p.canTest}
        title={p.canTest ? 'Talk to the agent' : 'Deploy first, then you can test it'}
      >
        <PhoneIcon className="mr-1.5 h-3.5 w-3.5" /> Test call
      </Button>

      <Button size="sm" onClick={p.onDeploy} disabled={p.deploying || !p.isDirty} title={p.deployTitle}>
        {p.deploying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
        Deploy
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={p.onValidate} disabled={p.validating}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Check for problems
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={p.onCopy}>
            <Copy className="mr-2 h-4 w-4" /> Copy flow as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={p.onPaste}>
            <ClipboardPaste className="mr-2 h-4 w-4" /> Paste flow from JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
