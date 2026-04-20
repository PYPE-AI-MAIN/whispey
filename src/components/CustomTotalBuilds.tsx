'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CustomTotalConfig, DistinctConfig, CustomFilter } from '@/types/customTotals'
import { cn } from '@/lib/utils'

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
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

const AGGREGATION_OPTIONS = [
  { value: 'COUNT', label: 'Count records', description: 'Total matching records' },
  { value: 'SUM', label: 'Sum', description: 'Add numeric values' },
  { value: 'AVG', label: 'Average', description: 'Average of numeric values' },
  { value: 'MIN', label: 'Minimum', description: 'Smallest value' },
  { value: 'MAX', label: 'Maximum', description: 'Largest value' },
  { value: 'COUNT_DISTINCT', label: 'Count unique', description: 'Unique value count' }
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

const CUSTOM_SUMMARY_PRIMARY_BTN =
  'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400'

const DEFAULT_CONFIG: Partial<CustomTotalConfig> = {
  name: '',
  description: '',
  aggregation: 'COUNT',
  column: '',
  jsonField: '',
  distinct: undefined,
  filters: [],
  filterLogic: 'AND',
  icon: 'calculator',
  color: 'blue'
}

const DEFAULT_NEW_FILTER: Partial<CustomFilter> = {
  column: '',
  operation: '',
  value: '',
  jsonField: '',
  logicalOperator: 'AND'
}

const NUMERIC_AGGREGATIONS = new Set(['SUM', 'AVG', 'MIN', 'MAX'])

const CustomTotalsBuilder: React.FC<CustomTotalsBuilderProps> = ({
  agentId,
  projectId,
  userEmail,
  availableColumns,
  onSave,
  dynamicMetadataFields = [],
  dynamicTranscriptionFields = [],
  open,
  onOpenChange,
  hideTrigger = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<Partial<CustomTotalConfig>>(DEFAULT_CONFIG)
  const [enableDistinct, setEnableDistinct] = useState(false)
  const [distinctConfig, setDistinctConfig] = useState<{ column: string; jsonField: string }>({
    column: '',
    jsonField: ''
  })
  const [newFilter, setNewFilter] = useState<Partial<CustomFilter>>(DEFAULT_NEW_FILTER)
  const [activeTab, setActiveTab] = useState<'setup' | 'filters' | 'style'>('setup')

  const resetBuilderState = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setEnableDistinct(false)
    setDistinctConfig({ column: '', jsonField: '' })
    setNewFilter(DEFAULT_NEW_FILTER)
    setActiveTab('setup')
  }, [])


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

  const getAvailableAggregations = () => {
    if (!config.column) return AGGREGATION_OPTIONS
    const columnType = getColumnType(config.column)
    if (columnType === 'number' || columnType === 'jsonb') return AGGREGATION_OPTIONS
    return AGGREGATION_OPTIONS.filter((option) => !NUMERIC_AGGREGATIONS.has(option.value))
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
    setNewFilter(DEFAULT_NEW_FILTER)
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
    const selectedColumnType = getColumnType(config.column)
    if (selectedColumnType !== 'number' && selectedColumnType !== 'jsonb' && NUMERIC_AGGREGATIONS.has(config.aggregation)) {
      alert('SUM, AVG, MIN, and MAX are only allowed for number columns (or numeric JSON fields).')
      return
    }
    // Validate JSONB column has field selected
    if (isJsonbColumn(config.column) && !config.jsonField) {
      alert('Please select a field for the JSONB column')
      return
    }
    
    // Validate distinct config if enabled
    if (enableDistinct && config.aggregation === 'COUNT') {
      if (!distinctConfig.column) {
        alert('Please select a column for distinct count')
        return
      }
      if (isJsonbColumn(distinctConfig.column) && !distinctConfig.jsonField) {
        alert('Please select a JSON field for distinct count')
        return
      }
    }

    // Build distinct config if enabled and valid
    let distinctConfigToSave: DistinctConfig | undefined = undefined
    if (enableDistinct && config.aggregation === 'COUNT' && distinctConfig.column) {
      // For JSONB columns, jsonField is required
      if (isJsonbColumn(distinctConfig.column)) {
        if (distinctConfig.jsonField) {
          distinctConfigToSave = {
            column: distinctConfig.column,
            jsonField: distinctConfig.jsonField
          }
        }
      } else {
        // For non-JSONB columns, jsonField is not needed
        distinctConfigToSave = {
          column: distinctConfig.column
        }
      }
    }

    const fullConfig: CustomTotalConfig = {
      id: Date.now().toString(),
      name: config.name!,
      description: config.description || '',
      aggregation: config.aggregation as any,
      column: config.column!,
      jsonField: config.jsonField || undefined,
      distinct: distinctConfigToSave,
      filters: config.filters || [],
      filterLogic: config.filterLogic || 'AND',
      icon: config.icon || 'calculator',
      color: config.color || 'blue',
      createdBy: userEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Debug: Log what's being saved
    console.log('🔍 [CustomTotalsBuilder] Saving config with distinct:', {
      name: fullConfig.name,
      aggregation: fullConfig.aggregation,
      enableDistinct,
      distinctConfig,
      distinctConfigToSave,
      distinctInConfig: fullConfig.distinct,
      distinctStringified: JSON.stringify(fullConfig.distinct)
    })

    try {
      await onSave(fullConfig)
      setDialogOpen(false)
      resetBuilderState()
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
  const metricConfigured = Boolean(config.name && config.column && config.aggregation)
  const jsonFieldRequired = Boolean(config.column && isJsonbColumn(config.column))
  const jsonFieldConfigured = !jsonFieldRequired || Boolean(config.jsonField)
  const setupComplete = metricConfigured && jsonFieldConfigured
  const isControlledOpen = open !== undefined && onOpenChange !== undefined
  const dialogOpen = isControlledOpen ? open : isOpen

  const setDialogOpen = (nextOpen: boolean) => {
    if (isControlledOpen) {
      onOpenChange(nextOpen)
      return
    }
    setIsOpen(nextOpen)
  }

  // Reset state when dialog closes
  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      resetBuilderState()
    }
  }

  useEffect(() => {
    if (!dialogOpen) {
      resetBuilderState()
    }
  }, [dialogOpen, resetBuilderState])

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
    {!hideTrigger && (
      <DialogTrigger asChild>
        <div className="group h-full w-full cursor-pointer rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-6 transition-all hover:border-violet-500/70 hover:bg-slate-900">
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/40 bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
              <Plus className="h-10 w-10 text-violet-300" />
            </div>
            <p className="text-2xl font-medium tracking-tight text-slate-100">Add</p>
            <p className="mt-2 text-sm text-slate-400">Create chart summary</p>
          </div>
        </div>
      </DialogTrigger>
    )}
      <DialogContent
        className={cn(
          'h-[84vh] w-full max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-xl sm:max-w-4xl',
          '[&_label]:mb-1.5 [&_label]:block [&_label]:text-slate-200 [&_input]:border-slate-600 [&_input]:bg-slate-950 [&_input]:text-slate-100 [&_input]:placeholder:text-slate-400',
          '[&_textarea]:border-slate-600 [&_textarea]:bg-slate-950 [&_textarea]:text-slate-100 [&_textarea]:placeholder:text-slate-400',
          '[&_[data-slot=select-trigger]]:border-slate-600 [&_[data-slot=select-trigger]]:bg-slate-950 [&_[data-slot=select-trigger]]:text-slate-100',
          '[&_[data-slot=select-trigger][data-placeholder]]:text-slate-400'
        )}
      >
        <DialogHeader className="border-b border-slate-700 bg-slate-800 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-100">
            <Calculator className="h-5 w-5" />
            Create Custom Total
          </DialogTitle>
          <p className="text-sm text-slate-400">
            Build one metric with clear rules and optional filters.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={setupComplete ? 'default' : 'outline'} className="rounded-md">
              1. Setup {setupComplete ? 'complete' : 'required'}
            </Badge>
            <Badge variant={config.filters && config.filters.length > 0 ? 'default' : 'outline'} className="rounded-md">
              2. Filters {config.filters && config.filters.length > 0 ? `(${config.filters.length})` : '(optional)'}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              3. Style (optional)
            </Badge>
          </div>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 px-6">
          <div className="space-y-5 py-5">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'setup' | 'filters' | 'style')} className="gap-4">
              <TabsList className="h-10 w-full rounded-lg bg-slate-800 p-1">
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="filters">
                  Filters {config.filters && config.filters.length > 0 ? `(${config.filters.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="space-y-5">
                <Card className="border-slate-700 bg-slate-800 text-slate-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Metric Setup</CardTitle>
                    <p className="text-sm text-slate-400">
                      Start with required fields, then optionally enable unique count.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Metric name *</Label>
                        <Input
                          id="name"
                          placeholder="e.g. Successful calls this month"
                          value={config.name}
                          onChange={(e) => setConfig(prev => ({...prev, name: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          placeholder="Short context for teammates"
                          value={config.description}
                          onChange={(e) => setConfig(prev => ({...prev, description: e.target.value}))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Calculation type *</Label>
                        <Select value={config.aggregation} onValueChange={(value) => setConfig(prev => ({...prev, aggregation: value as any}))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableAggregations().map((agg) => (
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
                      <div className="space-y-2">
                        <Label>Data column *</Label>
                        <Select
                          value={config.column}
                          onValueChange={(value) =>
                            setConfig((prev) => {
                              const nextColumn = value
                              const nextType =
                                availableColumns.find((col) => col.key === nextColumn)?.type || 'text'
                              const nextAggregation =
                                prev.aggregation && NUMERIC_AGGREGATIONS.has(prev.aggregation)
                                  ? (nextType === 'number' || nextType === 'jsonb' ? prev.aggregation : 'COUNT')
                                  : prev.aggregation

                              return { ...prev, column: nextColumn, jsonField: '', aggregation: nextAggregation }
                            })
                          }
                        >
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
                        <div className="space-y-2">
                          <Label>Field inside JSON *</Label>
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
                  </CardContent>
                </Card>

                {config.aggregation === 'COUNT' && (
                  <Card className="border-slate-700 bg-slate-800 text-slate-100">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Unique Count (Optional)</CardTitle>
                      <p className="text-sm text-slate-400">
                        Enable only when you need distinct values, like unique callers.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enableDistinct"
                          checked={enableDistinct}
                          onChange={(e) => {
                            setEnableDistinct(e.target.checked)
                            if (!e.target.checked) {
                              setDistinctConfig({ column: '', jsonField: '' })
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="enableDistinct" className="cursor-pointer">
                          Count unique values instead of all records
                        </Label>
                      </div>

                      {enableDistinct && (
                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Column to count uniquely *</Label>
                            <Select
                              value={distinctConfig.column}
                              onValueChange={(value) => setDistinctConfig(prev => ({...prev, column: value, jsonField: ''}))}
                            >
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
                          {distinctConfig.column && isJsonbColumn(distinctConfig.column) && (
                            <div className="space-y-2">
                              <Label>Unique field inside JSON *</Label>
                              <Select
                                value={distinctConfig.jsonField || ''}
                                onValueChange={(value) => setDistinctConfig(prev => ({...prev, jsonField: value}))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select field" />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {getAvailableJsonFields(distinctConfig.column).length === 0 ? (
                                    <div className="px-2 py-3 text-sm text-muted-foreground">
                                      <AlertCircle className="h-4 w-4 inline mr-2" />
                                      No fields found. Make sure you have data with {distinctConfig.column} fields.
                                    </div>
                                  ) : (
                                    getAvailableJsonFields(distinctConfig.column).map((field) => (
                                      <SelectItem key={field} value={field}>{field}</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <p className="text-xs text-slate-400">
                              This counts unique values of <strong>{distinctConfig.column}{distinctConfig.jsonField ? '.' + distinctConfig.jsonField : ''}</strong>
                              {config.column && ` where filters apply to ${config.column}${config.jsonField ? '.' + config.jsonField : ''}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="filters">
                <Card className="border-slate-700 bg-slate-800 text-slate-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Filters (Optional)</CardTitle>
                    <p className="text-sm text-slate-400">Narrow the data used in this metric.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div>
                      <Label>Filter Logic</Label>
                      <Select value={config.filterLogic} onValueChange={(value) => setConfig(prev => ({...prev, filterLogic: value as 'AND' | 'OR'}))}>
                        <SelectTrigger className="w-full md:w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND (all conditions must match)</SelectItem>
                          <SelectItem value="OR">OR (any condition can match)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-2">
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
                          <div className="space-y-2">
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
                        <div className="space-y-2">
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
                          <div className="space-y-2">
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
                      <Button
                        onClick={addFilter}
                        size="sm"
                        className={cn('w-full md:w-auto', CUSTOM_SUMMARY_PRIMARY_BTN)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add condition
                      </Button>
                    </div>

                    {config.filters && config.filters.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Current conditions ({config.filterLogic})</Label>
                          <Badge variant="outline">{config.filters.length} filter{config.filters.length !== 1 ? 's' : ''}</Badge>
                        </div>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/50 p-3">
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
                                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
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
              </TabsContent>

              <TabsContent value="style">
                <Card className="border-slate-700 bg-slate-800 text-slate-100">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Style (Optional)</CardTitle>
                    <p className="text-sm text-slate-400">Choose how this metric appears in the summary card.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
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
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        {/* Actions footer */}
        <div className="border-t border-slate-700 bg-slate-800 px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleDialogChange(false)}
              className="rounded-lg border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} className={cn('gap-2 rounded-lg', CUSTOM_SUMMARY_PRIMARY_BTN)}>
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