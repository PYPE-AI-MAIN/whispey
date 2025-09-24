import React from 'react'
import { Search, Eye, Grid3X3, List, HelpCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/hooks/use-mobile'

interface AgentToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string
  onStatusFilterChange: (filter: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onCreateAgent: () => void
  onShowHelp?: () => void
}

const AgentToolbar: React.FC<AgentToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onCreateAgent,
  onShowHelp
}) => {
  const { isMobile } = useMobile(768)

  if (isMobile) {
    return (
      <div className="space-y-3 mb-4">
        {/* Top Row: Search + Create Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="search"
              placeholder="Search agents"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none transition-all text-gray-900 dark:text-gray-100"
            />
          </div>
          <Button 
            onClick={onCreateAgent}
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-2.5 text-sm font-medium flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Bottom Row: Filters + Help */}
        <div className="flex items-center justify-between">
          {/* Status Filter */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => onStatusFilterChange('all')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onStatusFilterChange('active')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'active' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => onStatusFilterChange('inactive')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'inactive' 
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Inactive
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Help Link */}
            {onShowHelp && (
              <button
                onClick={onShowHelp}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </button>
            )}

            {/* View Toggle - Hide on mobile since we force list view */}
            {/* <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div> */}
          </div>
        </div>
      </div>
    )
  }

  // Desktop version (original)
  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left: Search + Help */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="search"
            placeholder="Search monitoring setups"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none transition-all text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Need Help Link */}
        {onShowHelp && (
          <button
            onClick={onShowHelp}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Need help?
          </button>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Status Filter */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'all' 
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onStatusFilterChange('active')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'active' 
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => onStatusFilterChange('inactive')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'inactive' 
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Inactive
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <Button 
          onClick={onCreateAgent}
          className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Start Observing
        </Button>
      </div>
    </div>
  )
}

export default AgentToolbar