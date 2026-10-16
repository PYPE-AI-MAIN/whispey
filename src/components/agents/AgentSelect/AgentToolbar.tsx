import React, { useState } from 'react'
import { Search, Eye, Grid3X3, List, HelpCircle, Plus, ArrowUpDown, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/hooks/use-mobile'
import PypeAgentUsage from './PypeAgentUsage'
import RequestAccessDialog from './RequestAccessDialog'
import { useParams } from 'next/navigation'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import { useFeatureAccess } from '@/app/providers/FeatureAccessProvider'

interface AgentToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string
  onStatusFilterChange: (filter: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onCreateAgent: () => void
  onConnectAgent: () => void
  onShowHelp?: () => void
  sortOrder: 'asc' | 'desc'
  onSortToggle: () => void
  agentCount?: number
}

const segment = 'flex min-w-0 items-center rounded-lg border border-border bg-muted/60 p-0.5'
const segBtn = (on: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`

function SearchBox({ value, onChange }: Readonly<{ value: string; onChange: (query: string) => void }>) {
  return (
    <div className="relative min-w-[220px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder="Search agents"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
      />
    </div>
  )
}

function StatusFilter({ value, onChange }: Readonly<{ value: string; onChange: (filter: string) => void }>) {
  return (
    <fieldset className={segment} aria-label="Filter by status">
      {(['all', 'active', 'inactive'] as const).map((f) => (
        <button key={f} onClick={() => onChange(f)} className={segBtn(value === f)}>
          {f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      ))}
    </fieldset>
  )
}

function SortAndView({
  sortOrder, onSortToggle, viewMode, onViewModeChange,
}: Readonly<Pick<AgentToolbarProps, 'sortOrder' | 'onSortToggle' | 'viewMode' | 'onViewModeChange'>>) {
  const newest = sortOrder === 'desc'
  return (
    <fieldset className={segment} aria-label="View and sort">
      <button
        onClick={onSortToggle}
        className={`flex items-center gap-1.5 ${segBtn(false)}`}
        title={`Sort by date ${newest ? '(newest first)' : '(oldest first)'}`}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {newest ? 'Newest' : 'Oldest'}
      </button>
      <button onClick={() => onViewModeChange('list')} className={segBtn(viewMode === 'list')} title="List view" aria-label="List view">
        <List className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => onViewModeChange('grid')} className={segBtn(viewMode === 'grid')} title="Grid view" aria-label="Grid view">
        <Grid3X3 className="h-3.5 w-3.5" />
      </button>
    </fieldset>
  )
}

function HelpButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      title="About agent types"
      aria-label="About agent types"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  )
}

function ConnectAgentButton({ onClick, compact }: Readonly<{ onClick: () => void; compact?: boolean }>) {
  return (
    <Button onClick={onClick} variant="outline" className="px-4 py-2.5 text-sm font-medium" title="Connect Agent">
      <Eye className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
      {!compact && 'Connect Agent'}
    </Button>
  )
}

type CreateState = { locked: boolean; limitReached: boolean; beta: boolean }

function createTitle({ locked, limitReached }: CreateState): string {
  if (limitReached) return 'Agent limit reached'
  return locked ? 'Beta feature - click to request access' : 'Create a new agent'
}

function CreateAgentButton({ state, onClick, compact }: Readonly<{ state: CreateState; onClick: () => void; compact?: boolean }>) {
  const Icon = state.locked ? Lock : Plus
  return (
    <Button
      onClick={onClick}
      disabled={state.limitReached}
      className={`px-4 py-2.5 text-sm font-medium ${state.locked ? 'cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted' : ''}`}
      title={createTitle(state)}
    >
      <Icon className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
      {!compact && 'Create Agent'}
      {!compact && state.beta && (
        <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Beta</span>
      )}
    </Button>
  )
}

const AgentToolbar: React.FC<AgentToolbarProps> = (props) => {
  const {
    searchQuery, onSearchChange, statusFilter, onStatusFilterChange, viewMode, onViewModeChange,
    onCreateAgent, onConnectAgent, onShowHelp, sortOrder, onSortToggle, agentCount,
  } = props
  const { projectid } = useParams()
  const { isMobile } = useMobile(768)
  const { permissions, canCreatePypeAgent } = useUserPermissions({ projectId: projectid as string })
  const { canCreatePypeAgent: canCreateFromWhitelist } = useFeatureAccess()
  const [showRequestDialog, setShowRequestDialog] = useState(false)

  const limitReached = Boolean(
    permissions?.agent && permissions.agent.usage.active_count >= permissions.agent.limits.max_agents
  )
  const createState: CreateState = { locked: !canCreatePypeAgent || limitReached, limitReached, beta: !canCreatePypeAgent }

  // A locked button asks for access (beta); a full quota just stays disabled.
  const handleCreateAgentClick = () => {
    if (createState.locked && !limitReached) setShowRequestDialog(true)
    else onCreateAgent()
  }

  const createButton = canCreateFromWhitelist && (
    <CreateAgentButton state={createState} onClick={handleCreateAgentClick} compact={isMobile} />
  )

  const layout = isMobile ? (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2">
        <SearchBox value={searchQuery} onChange={onSearchChange} />
        {createButton}
        <ConnectAgentButton onClick={onConnectAgent} compact />
      </div>
      <PypeAgentUsage projectId={projectid as string} />
      <div className="flex items-center justify-between">
        <SortAndView sortOrder={sortOrder} onSortToggle={onSortToggle} viewMode={viewMode} onViewModeChange={onViewModeChange} />
        {onShowHelp && <HelpButton onClick={onShowHelp} />}
      </div>
    </div>
  ) : (
    <div className="mb-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
          {agentCount !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">{agentCount} {agentCount === 1 ? 'agent' : 'agents'}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectAgentButton onClick={onConnectAgent} />
          {createButton}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={searchQuery} onChange={onSearchChange} />
        <StatusFilter value={statusFilter} onChange={onStatusFilterChange} />
        <SortAndView sortOrder={sortOrder} onSortToggle={onSortToggle} viewMode={viewMode} onViewModeChange={onViewModeChange} />
        <PypeAgentUsage projectId={projectid as string} />
        {onShowHelp && <HelpButton onClick={onShowHelp} />}
      </div>
    </div>
  )

  return (
    <>
      {layout}
      <RequestAccessDialog open={showRequestDialog} onOpenChange={setShowRequestDialog} projectid={projectid} isMobile={isMobile} />
    </>
  )
}

export default AgentToolbar
