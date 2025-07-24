'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Filter,
  X,
  ChevronDown,
  Calendar as CalendarIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export interface FilterRule {
  id: string
  column: string
  operation: string
  value: string
  jsonField?: string  // Add this for JSONB field names
}

interface CallFilterProps {
  onFiltersChange: (filters: FilterRule[]) => void
  onClear: () => void
  availableMetadataFields?: string[]
  availableTranscriptionFields?: string[]
}

const COLUMNS = [
  { value: 'customer_number', label: 'Customer Number', type: 'text' },
  { value: 'duration_seconds', label: 'Duration (seconds)', type: 'number' },
  { value: 'avg_latency', label: 'Avg Latency (ms)', type: 'number' },
  { value: 'call_started_at', label: 'Date', type: 'date' },
  { value: 'call_ended_reason', label: 'Status', type: 'text' },
  { value: 'metadata', label: 'Metadata', type: 'jsonb' },
  { value: 'transcription_metrics', label: 'Transcription', type: 'jsonb' }
]

const OPERATIONS = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts with' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' }
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' }
  ],
  jsonb: [
    { value: 'json_equals', label: 'Equals' },
    { value: 'json_contains', label: 'Contains' },
    { value: 'json_exists', label: 'Field Exists' },
    { value: 'json_greater_than', label: 'Greater than' },
    { value: 'json_less_than', label: 'Less than' }
  ]
}

const CallFilter: React.FC<CallFilterProps> = ({ 
  onFiltersChange, 
  onClear, 
  availableMetadataFields = [],
  availableTranscriptionFields = []
}) => {
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newFilter, setNewFilter] = useState({
    column: '',
    operation: '',
    value: '',
    jsonField: ''
  })
  const [selectedDate, setSelectedDate] = useState<Date>()

  const getAvailableJsonFields = () => {
    if (newFilter.column === 'metadata') {
      return availableMetadataFields
    }
    if (newFilter.column === 'transcription_metrics') {
      return availableTranscriptionFields
    }
    return []
  }

  const isJsonbColumn = () => {
    return newFilter.column === 'metadata' || newFilter.column === 'transcription_metrics'
  }

  const isValidFilter = () => {
    const hasBasicFields = newFilter.column && newFilter.operation
    const hasValue = newFilter.operation !== 'json_exists' ? newFilter.value : true
    const hasJsonField = isJsonbColumn() ? newFilter.jsonField : true
    
    return hasBasicFields && hasValue && hasJsonField
  }

  const addFilter = () => {
    if (isValidFilter()) {
      const filter: FilterRule = {
        id: Date.now().toString(),
        column: newFilter.column,
        operation: newFilter.operation,
        value: newFilter.value,
        ...(newFilter.jsonField && { jsonField: newFilter.jsonField })
      }
      
      const updatedFilters = [...filters, filter]
      setFilters(updatedFilters)
      onFiltersChange(updatedFilters)
      
      // Reset form
      setNewFilter({ column: '', operation: '', value: '', jsonField: '' })
      setSelectedDate(undefined)
    }
  }

  const removeFilter = (filterId: string) => {
    const updatedFilters = filters.filter(f => f.id !== filterId)
    setFilters(updatedFilters)
    onFiltersChange(updatedFilters)
  }

  const clearAllFilters = () => {
    setFilters([])
    setNewFilter({ column: '', operation: '', value: '', jsonField: '' })
    setSelectedDate(undefined)
    onClear()
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setNewFilter({ ...newFilter, value: format(date, 'yyyy-MM-dd') })
    }
  }

  const getColumnLabel = (value: string) => 
    COLUMNS.find(col => col.value === value)?.label || value

  const getOperationLabel = (value: string) => {
    for (const ops of Object.values(OPERATIONS)) {
      const op = ops.find(op => op.value === value)
      if (op) return op.label
    }
    return value
  }

  const getAvailableOperations = () => {
    const selectedColumn = COLUMNS.find(col => col.value === newFilter.column)
    if (!selectedColumn) return []
    return OPERATIONS[selectedColumn.type as keyof typeof OPERATIONS] || []
  }

  const isDateField = newFilter.column === 'call_started_at'
  const needsValue = newFilter.operation !== 'json_exists'
  const gridCols = isJsonbColumn() ? 'grid-cols-5' : 'grid-cols-4'

  const getFilterDisplayText = (filter: FilterRule) => {
    const columnLabel = getColumnLabel(filter.column)
    const operationLabel = getOperationLabel(filter.operation)
    const jsonFieldText = filter.jsonField ? `.${filter.jsonField}` : ''
    const valueText = filter.operation !== 'json_exists' ? ` "${filter.value}"` : ''
    
    return `${columnLabel}${jsonFieldText} ${operationLabel}${valueText}`
  }

  return (
    <div className="w-fit">
      {/* Compact Filter Button */}
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={filters.length > 0 ? "default" : "outline"}
              size="sm"
              className="gap-2 h-8 hover:shadow-md transition-all"
            >
              <Filter className="h-3 w-3" />
              Filter
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 text-xs">
                  {filters.length}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-[600px] p-3" align="start">
            <div className="space-y-3">
              {/* Compact Form */}
              <div className={`grid gap-2 ${gridCols}`}>
                {/* Column */}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-0">
                    <span className="truncate">
                      {newFilter.column ? getColumnLabel(newFilter.column) : 'Column'}
                    </span>
                    <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {COLUMNS.map((column) => (
                      <DropdownMenuItem
                        key={column.value}
                        onClick={() => {
                          setNewFilter({ 
                            column: column.value,
                            operation: '',
                            value: '',
                            jsonField: ''
                          })
                          setSelectedDate(undefined)
                        }}
                        className="text-xs"
                      >
                        {column.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* JSON Field (only for JSONB columns) */}
                {isJsonbColumn() && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs justify-between min-w-0"
                        disabled={!newFilter.column}
                      >
                        <span className="truncate">
                          {newFilter.jsonField || 'Field'}
                        </span>
                        <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40 max-h-48 overflow-y-auto">
                      {getAvailableJsonFields().map((field) => (
                        <DropdownMenuItem
                          key={field}
                          onClick={() => setNewFilter({ ...newFilter, jsonField: field })}
                          className="text-xs"
                        >
                          {field}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Operation */}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs justify-between min-w-0"
                      disabled={!newFilter.column || (isJsonbColumn() && !newFilter.jsonField)}
                    >
                      <span className="truncate">
                        {newFilter.operation ? getOperationLabel(newFilter.operation) : 'Operation'}
                      </span>
                      <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    {getAvailableOperations().map((operation) => (
                      <DropdownMenuItem
                        key={operation.value}
                        onClick={() => setNewFilter({ ...newFilter, operation: operation.value })}
                        className="text-xs"
                      >
                        {operation.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Value - Only show if operation needs a value */}
                {needsValue && (
                  <>
                    {isDateField ? (
                      <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs justify-between min-w-0"
                          disabled={!newFilter.operation}
                        >
                          <span className="truncate">
                            {selectedDate ? format(selectedDate, 'MMM dd') : 'Date'}
                          </span>
                          <CalendarIcon className="h-3 w-3 flex-shrink-0 ml-1" />
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDateSelect}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        placeholder="Value"
                        value={newFilter.value}
                        onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                        disabled={!newFilter.operation}
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addFilter()
                          }
                        }}
                      />
                    )}
                  </>
                )}

                {/* Add Button */}
                <Button
                  onClick={addFilter}
                  disabled={!isValidFilter()}
                  size="sm"
                  className="h-8 text-xs"
                >
                  Add
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {filters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {filters.map((filter) => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="gap-1 py-1 px-2 text-xs"
            >
              <span>{getFilterDisplayText(filter)}</span>
              <button
                onClick={() => removeFilter(filter.id)}
                className="hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-2 w-2" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default CallFilter