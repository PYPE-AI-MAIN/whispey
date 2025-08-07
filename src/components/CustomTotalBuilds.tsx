'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Trash2, 
  Save, 
  Calculator,
  ChevronDown,
  X,
  Phone,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle
} from 'lucide-react'

// Types (assuming these are imported from elsewhere)
interface CustomFilter {
  id: string
  column: string
  operation: string
  value: string
  jsonField?: string
  logicalOperator: 'AND' | 'OR'
}

interface CustomTotalConfig {
  id: string
  name: string
  description: string
  aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT_DISTINCT'
  column: string
  jsonField?: string
  filters: CustomFilter[]
  filterLogic: 'AND' | 'OR'
  icon: string
  color: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface CustomTotalsBuilderProps {
  agentId: string
  projectId: string
  userEmail: string
  availableColumns: Array<{
    key: string
    label: string
    type: 'text' | 'number' | 'date' | 'jsonb'
  }>
  onSave: (config: CustomTotalConfig) => Promise<void>
  dynamicMetadataFields?: string[]
  dynamicTranscriptionFields?: string[]
}

const AGGREGATION_OPTIONS = [
  { value: 'COUNT', label: 'Count Records', description: 'Count total number of records' },
  { value: 'SUM', label: 'Sum Values', description: 'Add up all numeric values' },
  { value: 'AVG', label: 'Average', description: 'Calculate average of numeric values' },
  { value: 'MIN', label: 'Minimum', description: 'Find smallest value' },
  { value: 'MAX', label: 'Maximum', description: 'Find largest value' },
  { value: 'COUNT_DISTINCT', label: 'Count Unique', description: 'Count unique values' }
]

const FILTER_OPERATIONS = {
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

const ICON_OPTIONS = [
  { value: 'phone', icon: Phone, label: 'Phone' },
  { value: 'clock', icon: Clock, label: 'Clock' },
  { value: 'dollar-sign', icon: DollarSign, label: 'Dollar' },
  { value: 'trending-up', icon: TrendingUp, label: 'Trending' },
  { value: 'calculator', icon: Calculator, label: 'Calculator' }
]

const COLOR_OPTIONS = [
  { value: 'blue', class: 'bg-blue-100 text-blue-600', label: 'Blue' },
  { value: 'green', class: 'bg-green-100 text-green-600', label: 'Green' },
  { value: 'purple', class: 'bg-purple-100 text-purple-600', label: 'Purple' },
  { value: 'orange', class: 'bg-orange-100 text-orange-600', label: 'Orange' },
  { value: 'red', class: 'bg-red-100 text-red-600', label: 'Red' }
]

const CustomTotalsBuilder: React.FC<CustomTotalsBuilderProps> = ({
  agentId,
  projectId,
  userEmail,
  availableColumns,
  onSave,
  dynamicMetadataFields = [],
  dynamicTranscriptionFields = []
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Partial<CustomTotalConfig>>({
    name: '',
    description: '',
    aggregation: 'COUNT',
    column: '',
    jsonField: '',
    filters: [],
    filterLogic: 'AND',
    icon: 'calculator',
    color: 'blue'
  })
  const [newFilter, setNewFilter] = useState<Partial<CustomFilter>>({
    column: '',
    operation: '',
    value: '',
    jsonField: '',
    logicalOperator: 'AND'
  })


  // Get available JSON fields based on column selection
  const getAvailableJsonFields = (column: string) => {
    if (column === 'metadata') return dynamicMetadataFields
    if (column === 'transcription_metrics') return dynamicTranscriptionFields
    return []
  }

  const isJsonbColumn = (column: string) => {
    return column === 'metadata' || column === 'transcription_metrics'
  }

  const getColumnType = (column: string) => {
    const col = availableColumns.find(c => c.key === column)
    return col?.type || 'text'
  }

  const addFilter = () => {
    
    // Validation logic
    if (!newFilter.column) {
      alert('Please select a column')
      return
    }
    
    if (!newFilter.operation) {
      alert('Please select an operation')
      return
    }
    
    // For JSONB columns, require field selection
    if (isJsonbColumn(newFilter.column) && !newFilter.jsonField) {
      alert('Please select a JSON field')
      return
    }
    
    // For operations other than 'json_exists', require a value
    if (newFilter.operation !== 'json_exists' && !newFilter.value) {
      alert('Please enter a value')
      return
    }

    const filter: CustomFilter = {
      id: Date.now().toString(),
      column: newFilter.column!,
      operation: newFilter.operation!,
      value: newFilter.value || '',
      jsonField: newFilter.jsonField,
      logicalOperator: newFilter.logicalOperator || 'AND'
    }

    
    setConfig(prev => {
      const newConfig = {
        ...prev,
        filters: [...(prev.filters || []), filter]
      }
      return newConfig
    })
    
    // Reset form
    setNewFilter({
      column: '',
      operation: '',
      value: '',
      jsonField: '',
      logicalOperator: 'AND'
    })
  }

  const removeFilter = (filterId: string) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters?.filter(f => f.id !== filterId) || []
    }))
  }

  const handleSave = async () => {
    if (!config.name || !config.column || !config.aggregation) {
      alert('Please fill in all required fields')
      return
    }
    // Validate JSONB column has field selected
    if (isJsonbColumn(config.column) && !config.jsonField) {
      alert('Please select a field for the JSONB column')
      return
    }

    const fullConfig: CustomTotalConfig = {
      id: Date.now().toString(),
      name: config.name!,
      description: config.description || '',
      aggregation: config.aggregation as any,
      column: config.column!,
      jsonField: config.jsonField || undefined,
      filters: config.filters || [],
      filterLogic: config.filterLogic || 'AND',
      icon: config.icon || 'calculator',
      color: config.color || 'blue',
      createdBy: userEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      await onSave(fullConfig)
      setIsOpen(false)
      setConfig({
        name: '',
        description: '',
        aggregation: 'COUNT',
        column: '',
        jsonField: '',
        filters: [],
        filterLogic: 'AND',
        icon: 'calculator',
        color: 'blue'
      })
    } catch (error) {
      console.error('Failed to save custom total:', error)
      alert('Failed to save custom total')
    }
  }

  const getAvailableOperations = () => {
    if (!newFilter.column) return []
    const columnType = getColumnType(newFilter.column)
    return FILTER_OPERATIONS[columnType] || []
  }

  const selectedIcon = ICON_OPTIONS.find(opt => opt.value === config.icon)
  const selectedColor = COLOR_OPTIONS.find(opt => opt.value === config.color)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
    <DialogTrigger asChild>
      <div className="p-5 h-full flex flex-col justify-center items-center text-center cursor-pointer">
        <div className="flex items-start justify-center mb-4 w-full">
          <div className="p-2 bg-gray-100 rounded-lg border border-gray-200 group-hover:bg-gray-200 transition-colors">
            <Plus className="w-5 h-5 text-gray-600" />
          </div>
        </div>
        <div className="space-y-6">
          <p className="text-lg font-light text-gray-700 tracking-tight">Add Custom</p>
          <p className="text-xs text-gray-400 font-medium">Create metric</p>
        </div>
      </div>
    </DialogTrigger>
      <DialogContent className="min-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Create Custom Total
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 min-h-0">
          <div className="space-y-6 py-4">
            {/* Basic Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Successful Calls This Month"
                      value={config.name}
                      onChange={(e) => setConfig(prev => ({...prev, name: e.target.value}))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Optional description"
                      value={config.description}
                      onChange={(e) => setConfig(prev => ({...prev, description: e.target.value}))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Aggregation *</Label>
                    <Select value={config.aggregation} onValueChange={(value) => setConfig(prev => ({...prev, aggregation: value as any}))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGGREGATION_OPTIONS.map((agg) => (
                          <SelectItem key={agg.value} value={agg.value}>
                            <div>
                              <div className="font-medium">{agg.label}</div>
                              <div className="text-xs text-muted-foreground">{agg.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Column *</Label>
                    <Select value={config.column} onValueChange={(value) => setConfig(prev => ({...prev, column: value, jsonField: ''}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableColumns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            <div>
                              <div className="font-medium">{col.label}</div>
                              <div className="text-xs text-muted-foreground">{col.type === 'jsonb' ? 'Dynamic JSON field' : col.type}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {config.column && isJsonbColumn(config.column) && (
                    <div>
                      <Label>JSON Field *</Label>
                      <Select value={config.jsonField || ''} onValueChange={(value) => setConfig(prev => ({...prev, jsonField: value}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          {getAvailableJsonFields(config.column).length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground">
                              <AlertCircle className="h-4 w-4 inline mr-2" />
                              No fields found. Make sure you have data with {config.column} fields.
                            </div>
                          ) : (
                            getAvailableJsonFields(config.column).map((field) => (
                              <SelectItem key={field} value={field}>{field}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {config.column === 'metadata' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fields from metadata JSON: {dynamicMetadataFields.slice(0, 3).join(', ')}{dynamicMetadataFields.length > 3 && '...'}
                        </p>
                      )}
                      {config.column === 'transcription_metrics' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fields from transcription_metrics JSON: {dynamicTranscriptionFields.slice(0, 3).join(', ')}{dynamicTranscriptionFields.length > 3 && '...'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {/* Appearance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Icon</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <div className="flex items-center gap-2">
                            {selectedIcon && <selectedIcon.icon className="h-4 w-4" />}
                            <span>{selectedIcon?.label || 'Select Icon'}</span>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {ICON_OPTIONS.map((icon) => (
                          <DropdownMenuItem
                            key={icon.value}
                            onClick={() => setConfig(prev => ({...prev, icon: icon.value}))}
                          >
                            <icon.icon className="h-4 w-4 mr-2" />
                            {icon.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div>
                    <Label>Color</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <div className="flex items-center gap-2">
                            {selectedColor && (
                              <div className={`w-4 h-4 rounded ${selectedColor.class}`} />
                            )}
                            <span>{selectedColor?.label || 'Select Color'}</span>
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {COLOR_OPTIONS.map((color) => (
                          <DropdownMenuItem
                            key={color.value}
                            onClick={() => setConfig(prev => ({...prev, color: color.value}))}
                          >
                            <div className={`w-4 h-4 rounded mr-2 ${color.class}`} />
                            {color.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filter Logic */}
                <div>
                  <Label>Filter Logic</Label>
                  <Select value={config.filterLogic} onValueChange={(value) => setConfig(prev => ({...prev, filterLogic: value as 'AND' | 'OR'}))}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND (All conditions must match)</SelectItem>
                      <SelectItem value="OR">OR (Any condition can match)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Add Filter Form */}
                <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Column</Label>
                      <Select value={newFilter.column || ''} onValueChange={(value) => setNewFilter(prev => ({...prev, column: value, operation: '', jsonField: ''}))}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Column" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.map((col) => (
                            <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newFilter.column && isJsonbColumn(newFilter.column) && (
                      <div>
                        <Label className="text-xs">Field</Label>
                        <Select value={newFilter.jsonField || ''} onValueChange={(value) => setNewFilter(prev => ({...prev, jsonField: value}))}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Field" />
                          </SelectTrigger>
                          <SelectContent className="max-h-32">
                            {getAvailableJsonFields(newFilter.column).map((field) => (
                              <SelectItem key={field} value={field}>{field}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Operation</Label>
                      <Select value={newFilter.operation || ''} onValueChange={(value) => setNewFilter(prev => ({...prev, operation: value}))}
                        disabled={!newFilter.column}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Operation" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableOperations().map((op) => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newFilter.operation !== 'json_exists' && (
                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input
                          placeholder="Value"
                          value={newFilter.value || ''}
                          onChange={(e) => setNewFilter(prev => ({...prev, value: e.target.value}))}
                          className="h-9"
                        />
                      </div>
                    )}
                  </div>
                  <Button onClick={addFilter} size="sm" className="w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                </div>

                {/* Active Filters - FIXED SECTION */}
                {config.filters && config.filters.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Active Filters ({config.filterLogic})</Label>
                      <Badge variant="outline">{config.filters.length} filter{config.filters.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-muted/10">
                      {config.filters.map((filter, index) => {
                        const column = availableColumns.find(c => c.key === filter.column)
                        const operation = FILTER_OPERATIONS[getColumnType(filter.column)]?.find(op => op.value === filter.operation)
                        
                        return (
                          <div key={filter.id} className="flex items-center gap-2 flex-wrap">
                            {index > 0 && (
                              <Badge variant="outline" className="text-xs px-2 py-1">
                                {config.filterLogic}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 bg-background border rounded-lg px-3 py-2 flex-1 min-w-0">
                              <span className="font-medium text-sm">
                                {column?.label || filter.column}
                              </span>
                              {filter.jsonField && (
                                <>
                                  <span className="text-muted-foreground">.</span>
                                  <span className="text-primary font-medium text-sm">
                                    {filter.jsonField}
                                  </span>
                                </>
                              )}
                              <span className="text-muted-foreground text-sm mx-1">
                                {operation?.label || filter.operation}
                              </span>
                              {filter.operation !== 'json_exists' && filter.value && (
                                <span className="text-sm bg-muted px-2 py-1 rounded truncate">
                                  "{filter.value}"
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFilter(filter.id)}
                                className="h-6 w-6 p-0 ml-auto hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        {/* Actions footer */}
        <div className="px-6 py-4 border-t bg-background">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save Custom Total
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CustomTotalsBuilder