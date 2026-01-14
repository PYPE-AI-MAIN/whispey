'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

// Unified filter operation type that can be either a filter or a distinct operation
export type FilterOperation = 
  | {
      id: string
      type: 'filter'
      column: string
      operation: string
      value: string
      jsonField?: string  // For JSONB field names
      order: number  // Execution order
    }
  | {
      id: string
      type: 'distinct'
      column: string
      jsonField?: string  // For JSONB field names
      sortOrder?: 'asc' | 'desc'  // Sort order for distinct
      order: number  // Execution order
    }

// Legacy types for backward compatibility
export interface FilterRule {
  id: string
  column: string
  operation: string
  value: string
  jsonField?: string
  order: number
}

export interface DistinctConfig {
  column: string
  jsonField?: string
  order: 'asc' | 'desc'
}

interface CallFilterProps {
  onFiltersChange: (operations: FilterOperation[]) => void
  onClear: () => void
  availableMetadataFields?: string[]
  availableTranscriptionFields?: string[]
  initialFilters?: FilterOperation[]
  distinctConfig?: DistinctConfig  // Keep for backward compatibility
  onDistinctConfigChange?: (config: DistinctConfig | undefined) => void  // Keep for backward compatibility
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
  availableTranscriptionFields = [],
  initialFilters = [],
  distinctConfig,
  onDistinctConfigChange
}) => {
  const [operations, setOperations] = useState<FilterOperation[]>(initialFilters)
  const [isOpen, setIsOpen] = useState(false)
  
  // New operation form state
  const [operationType, setOperationType] = useState<'filter' | 'distinct'>('filter')
  const [newFilter, setNewFilter] = useState({
    column: '',
    operation: '',
    value: '',
    jsonField: ''
  })
  const [newDistinct, setNewDistinct] = useState({
    column: '',
    jsonField: '',
    sortOrder: 'asc' as 'asc' | 'desc'
  })
  const [selectedDate, setSelectedDate] = useState<Date>()

  // Migrate legacy data to operations on mount
  useEffect(() => {
    let migratedOperations: FilterOperation[] = []
    
    // Migrate legacy FilterRule[] to FilterOperation[]
    initialFilters.forEach((op: any) => {
      // If it's already a FilterOperation, use it
      if (op.type === 'filter' || op.type === 'distinct') {
        migratedOperations.push(op)
      } 
      // If it's a legacy FilterRule (has 'operation' field but no 'type'), convert it
      else if (op.operation) {
        migratedOperations.push({
          id: op.id || `filter-${Date.now()}-${Math.random()}`,
          type: 'filter',
          column: op.column,
          operation: op.operation,
          value: op.value,
          jsonField: op.jsonField,
          order: op.order ?? 0
        })
      }
    })
    
    // If we have legacy distinctConfig, convert it to a distinct operation
    if (distinctConfig && !migratedOperations.some(op => op.type === 'distinct')) {
      const maxOrder = migratedOperations.length > 0 
        ? Math.max(...migratedOperations.map(op => op.order)) 
        : -1
      
      const distinctOperation: FilterOperation = {
        id: `distinct-${Date.now()}`,
        type: 'distinct',
        column: distinctConfig.column,
        jsonField: distinctConfig.jsonField,
        sortOrder: distinctConfig.order,
        order: maxOrder + 1
      }
      migratedOperations.push(distinctOperation)
    }
    
    // Ensure all operations have order
    const operationsWithOrder = migratedOperations.map((op, index) => ({
      ...op,
      order: op.order !== undefined ? op.order : index
    }))
    
    // Sort by order
    const sortedOperations = [...operationsWithOrder].sort((a, b) => a.order - b.order)
    setOperations(sortedOperations)
  }, [initialFilters, distinctConfig])

  // Reset local state when popover closes without saving
  const handleCancel = () => {
    setOperations(initialFilters)
    setOperationType('filter')
    setNewFilter({ column: '', operation: '', value: '', jsonField: '' })
    setNewDistinct({ column: '', jsonField: '', sortOrder: 'asc' })
    setSelectedDate(undefined)
    setIsOpen(false)
  }

  const getDistinctJsonFields = (column: string) => {
    if (column === 'metadata') {
      return availableMetadataFields
    }
    if (column === 'transcription_metrics') {
      return availableTranscriptionFields
    }
    return []
  }

  const isJsonbColumn = (column: string) => {
    return column === 'metadata' || column === 'transcription_metrics'
  }

  const getAvailableJsonFields = () => {
    const column = operationType === 'filter' ? newFilter.column : newDistinct.column
    return getDistinctJsonFields(column)
  }

  const isValidFilter = () => {
    const hasBasicFields = newFilter.column && newFilter.operation
    const hasValue = newFilter.operation !== 'json_exists' ? newFilter.value : true
    const hasJsonField = isJsonbColumn(newFilter.column) ? newFilter.jsonField : true
    
    return hasBasicFields && hasValue && hasJsonField
  }

  const isValidDistinct = () => {
    return !!newDistinct.column && (!isJsonbColumn(newDistinct.column) || !!newDistinct.jsonField)
  }

  const addOperation = () => {
    if (operationType === 'filter' && isValidFilter()) {
      const maxOrder = operations.length > 0 
        ? Math.max(...operations.map(op => op.order)) 
        : -1
      
      const filterOperation: FilterOperation = {
        id: `filter-${Date.now()}`,
        type: 'filter',
        column: newFilter.column,
        operation: newFilter.operation,
        value: newFilter.value,
        order: maxOrder + 1,
        ...(newFilter.jsonField && { jsonField: newFilter.jsonField })
      }
      
      setOperations([...operations, filterOperation])
      setNewFilter({ column: '', operation: '', value: '', jsonField: '' })
      setSelectedDate(undefined)
    } else if (operationType === 'distinct' && isValidDistinct()) {
      const maxOrder = operations.length > 0 
        ? Math.max(...operations.map(op => op.order)) 
        : -1
      
      const distinctOperation: FilterOperation = {
        id: `distinct-${Date.now()}`,
        type: 'distinct',
        column: newDistinct.column,
        sortOrder: newDistinct.sortOrder,
        order: maxOrder + 1,
        ...(newDistinct.jsonField && { jsonField: newDistinct.jsonField })
      }
      
      setOperations([...operations, distinctOperation])
      setNewDistinct({ column: '', jsonField: '', sortOrder: 'asc' })
    }
  }

  const removeOperation = (operationId: string) => {
    const updatedOperations = operations.filter(op => op.id !== operationId)
    // Reorder remaining operations
    const reorderedOperations = updatedOperations.map((op, index) => ({
      ...op,
      order: index
    }))
    setOperations(reorderedOperations)
  }

  const moveOperation = (operationId: string, direction: 'up' | 'down') => {
    const sortedOperations = [...operations].sort((a, b) => a.order - b.order)
    const currentIndex = sortedOperations.findIndex(op => op.id === operationId)
    
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === sortedOperations.length - 1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetOperation = sortedOperations[newIndex]
    const currentOperation = sortedOperations[currentIndex]
    
    // Swap orders
    const newOrder = targetOperation.order
    targetOperation.order = currentOperation.order
    currentOperation.order = newOrder
    
    setOperations([...sortedOperations])
  }

  const clearAllOperations = () => {
    setOperations([])
    setNewFilter({ column: '', operation: '', value: '', jsonField: '' })
    setNewDistinct({ column: '', jsonField: '', sortOrder: 'asc' })
    setSelectedDate(undefined)
    setOperationType('filter')
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

  const getOperationDisplayText = (operation: FilterOperation) => {
    if (operation.type === 'filter') {
      const columnLabel = getColumnLabel(operation.column)
      const operationLabel = getOperationLabel(operation.operation)
      const jsonFieldText = operation.jsonField ? `.${operation.jsonField}` : ''
      const valueText = operation.operation !== 'json_exists' ? ` "${operation.value}"` : ''
      
      return `${columnLabel}${jsonFieldText} ${operationLabel}${valueText}`
    } else {
      // Distinct operation
      const columnLabel = getColumnLabel(operation.column)
      const jsonFieldText = operation.jsonField ? `.${operation.jsonField}` : ''
      const sortText = operation.sortOrder === 'desc' ? ' (Desc)' : ' (Asc)'
      
      return `Show Unique: ${columnLabel}${jsonFieldText}${sortText}`
    }
  }

  const isDateField = newFilter.column === 'call_started_at'
  const needsValue = newFilter.operation !== 'json_exists'
  const currentColumn = operationType === 'filter' ? newFilter.column : newDistinct.column
  const isCurrentJsonbColumn = isJsonbColumn(currentColumn)

  return (
    <div className="w-fit">
      {/* Compact Filter Button */}
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={operations.length > 0 ? "default" : "outline"}
              size="sm"
              className="gap-2 h-8 hover:shadow-md transition-all"
            >
              <Filter className="h-3 w-3" />
              Filter
              {operations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 w-4 rounded-full p-0 text-xs">
                  {operations.length}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-[700px] p-4 max-h-[80vh] overflow-y-auto" align="start">
            <div className="space-y-4">
              {/* Active Operations List */}
              {operations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    Active Operations ({operations.length})
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...operations].sort((a, b) => a.order - b.order).map((operation, index) => {
                      const sortedOperations = [...operations].sort((a, b) => a.order - b.order)
                      const currentIndex = sortedOperations.findIndex(op => op.id === operation.id)
                      const isFirst = currentIndex === 0
                      const isLast = currentIndex === sortedOperations.length - 1
                      
                      return (
                        <div
                          key={operation.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => moveOperation(operation.id, 'up')}
                              disabled={isFirst}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => moveOperation(operation.id, 'down')}
                              disabled={isLast}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 text-xs">
                            <span className="font-medium text-gray-500 dark:text-gray-400">
                              {currentIndex + 1}.
                            </span>{' '}
                            <span className={operation.type === 'distinct' ? 'text-blue-600 dark:text-blue-400' : ''}>
                              {getOperationDisplayText(operation)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={() => removeOperation(operation.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Operation Type Selector */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-foreground">
                  {operations.length > 0 ? 'Add Another Operation' : 'Add Operation'}
                </div>
                
                {/* Operation Type Selection */}
                <div className="flex gap-2">
                  <Button
                    variant={operationType === 'filter' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setOperationType('filter')}
                  >
                    Filter
                  </Button>
                  <Button
                    variant={operationType === 'distinct' ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setOperationType('distinct')}
                  >
                    Show Unique
                  </Button>
                </div>

                {/* Filter Form */}
                {operationType === 'filter' && (
                  <div className="grid gap-2 grid-cols-4">
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
                    {isJsonbColumn(newFilter.column) && (
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
                          disabled={!newFilter.column || (isJsonbColumn(newFilter.column) && !newFilter.jsonField)}
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
                                addOperation()
                              }
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Add Button */}
                    <Button
                      onClick={addOperation}
                      disabled={!isValidFilter()}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      Add
                    </Button>
                  </div>
                )}

                {/* Distinct Form */}
                {operationType === 'distinct' && (
                  <div className="grid gap-2 grid-cols-4">
                    {/* Column */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-0">
                          <span className="truncate">
                            {newDistinct.column ? getColumnLabel(newDistinct.column) : 'Column'}
                          </span>
                          <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        {COLUMNS.map((column) => (
                          <DropdownMenuItem
                            key={column.value}
                            onClick={() => {
                              setNewDistinct({ 
                                column: column.value,
                                jsonField: '',
                                sortOrder: newDistinct.sortOrder
                              })
                            }}
                            className="text-xs"
                          >
                            {column.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* JSON Field (only for JSONB columns) */}
                    {isJsonbColumn(newDistinct.column) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-xs justify-between min-w-0"
                            disabled={!newDistinct.column}
                          >
                            <span className="truncate">
                              {newDistinct.jsonField || 'Field'}
                            </span>
                            <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 max-h-48 overflow-y-auto">
                          {getAvailableJsonFields().map((field) => (
                            <DropdownMenuItem
                              key={field}
                              onClick={() => setNewDistinct({ ...newDistinct, jsonField: field })}
                              className="text-xs"
                            >
                              {field}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Sort Order */}
                    <div className="flex gap-1">
                      <Button
                        variant={newDistinct.sortOrder === 'asc' ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => setNewDistinct({ ...newDistinct, sortOrder: 'asc' })}
                        disabled={!newDistinct.column || (isJsonbColumn(newDistinct.column) && !newDistinct.jsonField)}
                      >
                        ↑ Asc
                      </Button>
                      <Button
                        variant={newDistinct.sortOrder === 'desc' ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs px-3"
                        onClick={() => setNewDistinct({ ...newDistinct, sortOrder: 'desc' })}
                        disabled={!newDistinct.column || (isJsonbColumn(newDistinct.column) && !newDistinct.jsonField)}
                      >
                        ↓ Desc
                      </Button>
                    </div>

                    {/* Add Button */}
                    <Button
                      onClick={addOperation}
                      disabled={!isValidDistinct()}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const sortedOperations = [...operations].sort((a, b) => a.order - b.order)
                    onFiltersChange(sortedOperations)
                    setIsOpen(false)
                  }}
                  className="h-8 text-xs"
                  disabled={operations.length === 0}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {operations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllOperations}
            className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Operations Summary (outside popup) */}
      {operations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {[...operations].sort((a, b) => a.order - b.order).map((operation, index) => (
            <Badge
              key={operation.id}
              variant="secondary"
              className={`gap-1 py-1 px-2 text-xs ${operation.type === 'distinct' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : ''}`}
            >
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {index + 1}.
              </span>
              <span>{getOperationDisplayText(operation)}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default CallFilter
