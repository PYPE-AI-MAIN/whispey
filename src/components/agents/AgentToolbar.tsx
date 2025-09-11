import React from 'react'
import { Search, Eye, Grid3X3, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AgentToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string
  onStatusFilterChange: (filter: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onCreateAgent: () => void
}

const AgentToolbar: React.FC<AgentToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onCreateAgent
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      {/* Left: Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search monitoring setups"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
        />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-4">
        {/* Status Filter */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'all' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onStatusFilterChange('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'active' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => onStatusFilterChange('inactive')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              statusFilter === 'inactive' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Inactive
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-white shadow-sm text-gray-900' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-white shadow-sm text-gray-900' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>
        
        <Button 
          onClick={onCreateAgent}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm font-medium"
        >
          <Eye className="w-4 h-4 mr-2" />
          Start Observing
        </Button>
      </div>
    </div>
  )
}

export default AgentToolbar