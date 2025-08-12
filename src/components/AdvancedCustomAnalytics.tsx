'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Plus, 
  Trash2, 
  Save, 
  Calculator,
  TrendingUp,
  BarChart3,
  PieChart,
  Filter,
  Download,
  Eye,
  Settings,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts'

interface CustomFilter {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'not_equals' | 'in_range'
  value: string | number
  secondValue?: string | number // For range operations
  logicalOperator: 'AND' | 'OR'
}

interface CustomAnalyticConfig {
  id: string
  name: string
  description: string
  type: 'total' | 'chart' | 'summary'
  field: string
  aggregation: 'count' | 'sum' | 'average' | 'min' | 'max' | 'distinct_count'
  filters: CustomFilter[]
  groupBy?: string
  chartType?: 'line' | 'bar' | 'pie' | 'area'
  dateRange?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom'
  color?: string
  icon?: string
}

interface AdvancedCustomAnalyticsProps {
  agentId: string
  projectId: string
  metadataFields: string[]
  transcriptionFields: string[]
  onSave: (config: CustomAnalyticConfig) => void
}

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
]

const FIELD_ICONS = {
  calls: '📞',
  duration: '⏱️',
  cost: '💰',
  satisfaction: '⭐',
  conversion: '🎯',
  response_time: '⚡',
  success_rate: '✅',
  revenue: '💵',
  leads: '🔥',
  appointments: '📅'
}

const AdvancedCustomAnalytics: React.FC<AdvancedCustomAnalyticsProps> = ({
  agentId,
  projectId,
  metadataFields,
  transcriptionFields,
  onSave
}) => {
  const [configs, setConfigs] = useState<CustomAnalyticConfig[]>([])
  const [currentConfig, setCurrentConfig] = useState<Partial<CustomAnalyticConfig>>({
    type: 'total',
    aggregation: 'count',
    filters: [],
    dateRange: 'last_30_days',
    color: CHART_COLORS[0]
  })
  const [showBuilder, setShowBuilder] = useState(false)
  const [activeTab, setActiveTab] = useState('builder')
  const [previewData, setPreviewData] = useState<any>(null)

  // Available fields from all sources
  const allFields = [
    // Core fields
    { value: 'calls', label: 'Total Calls', source: 'core' },
    { value: 'duration_seconds', label: 'Duration (seconds)', source: 'core' },
    { value: 'total_cost', label: 'Total Cost', source: 'core' },
    { value: 'avg_latency', label: 'Average Latency', source: 'core' },
    { value: 'call_ended_reason', label: 'Call Status', source: 'core' },
    { value: 'customer_number', label: 'Customer Number', source: 'core' },
    { value: 'environment', label: 'Environment', source: 'core' },
    
    // Metadata fields
    ...metadataFields.map(field => ({
      value: field,
      label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      source: 'metadata'
    })),
    
    // Transcription fields
    ...transcriptionFields.map(field => ({
      value: field,
      label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      source: 'transcription'
    }))
  ]

  const addFilter = () => {
    const newFilter: CustomFilter = {
      id: Date.now().toString(),
      field: '',
      operator: 'equals',
      value: '',
      logicalOperator: 'AND'
    }
    setCurrentConfig(prev => ({
      ...prev,
      filters: [...(prev.filters || []), newFilter]
    }))
  }

  const updateFilter = (filterId: string, updates: Partial<CustomFilter>) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: prev.filters?.map(filter => 
        filter.id === filterId ? { ...filter, ...updates } : filter
      ) || []
    }))
  }

  const removeFilter = (filterId: string) => {
    setCurrentConfig(prev => ({
      ...prev,
      filters: prev.filters?.filter(filter => filter.id !== filterId) || []
    }))
  }

  const generatePreview = () => {
    // Generate mock preview data based on configuration
    const mockData = []
    const days = 30
    
    for (let i = days; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        value: Math.floor(Math.random() * 100) + 20,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
    }
    
    setPreviewData(mockData)
  }

  const saveConfig = () => {
    if (!currentConfig.name || !currentConfig.field) return

    const config: CustomAnalyticConfig = {
      id: Date.now().toString(),
      name: currentConfig.name!,
      description: currentConfig.description || '',
      type: currentConfig.type!,
      field: currentConfig.field!,
      aggregation: currentConfig.aggregation!,
      filters: currentConfig.filters || [],
      groupBy: currentConfig.groupBy,
      chartType: currentConfig.chartType,
      dateRange: currentConfig.dateRange,
      color: currentConfig.color,
      icon: currentConfig.icon
    }

    setConfigs(prev => [...prev, config])
    onSave(config)
    setCurrentConfig({
      type: 'total',
      aggregation: 'count',
      filters: [],
      dateRange: 'last_30_days',
      color: CHART_COLORS[Math.floor(Math.random() * CHART_COLORS.length)]
    })
    setShowBuilder(false)
  }

  const renderChart = (data: any[], type: string, color: string) => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill={color} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={data.slice(0, 5)} // Show top 5 for pie chart
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill={color}
              >
                {data.slice(0, 5).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        )
      default:
        return <div className="h-48 flex items-center justify-center text-gray-500">Chart Preview</div>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Custom Analytics</h2>
          <p className="text-sm text-gray-500">Create custom totals, charts, and summaries</p>
        </div>
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Analytics
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Advanced Analytics Builder</DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="builder" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Basic Configuration */}
                  <div className="space-y-4">
                    <div>
                      <Label>Analytics Type</Label>
                      <Select
                        value={currentConfig.type}
                        onValueChange={(value) => setCurrentConfig(prev => ({ ...prev, type: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total">📊 Custom Total</SelectItem>
                          <SelectItem value="chart">📈 Custom Chart</SelectItem>
                          <SelectItem value="summary">📋 Summary Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Name</Label>
                      <Input
                        placeholder="e.g., High Satisfaction Calls"
                        value={currentConfig.name || ''}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Describe what this analytics measures..."
                        value={currentConfig.description || ''}
                        onChange={(e) => setCurrentConfig(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Field Configuration */}
                  <div className="space-y-4">
                    <div>
                      <Label>Field to Analyze</Label>
                      <Select
                        value={currentConfig.field}
                        onValueChange={(value) => setCurrentConfig(prev => ({ ...prev, field: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allFields.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {field.source}
                                </Badge>
                                {field.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Aggregation</Label>
                      <Select
                        value={currentConfig.aggregation}
                        onValueChange={(value) => setCurrentConfig(prev => ({ ...prev, aggregation: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="count">📊 Count</SelectItem>
                          <SelectItem value="sum">➕ Sum</SelectItem>
                          <SelectItem value="average">📊 Average</SelectItem>
                          <SelectItem value="min">⬇️ Minimum</SelectItem>
                          <SelectItem value="max">⬆️ Maximum</SelectItem>
                          <SelectItem value="distinct_count">🔢 Distinct Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {currentConfig.type === 'chart' && (
                      <div>
                        <Label>Chart Type</Label>
                        <Select
                          value={currentConfig.chartType}
                          onValueChange={(value) => setCurrentConfig(prev => ({ ...prev, chartType: value as any }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="line">📈 Line Chart</SelectItem>
                            <SelectItem value="bar">📊 Bar Chart</SelectItem>
                            <SelectItem value="pie">🥧 Pie Chart</SelectItem>
                            <SelectItem value="area">📊 Area Chart</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Date Range</Label>
                      <Select
                        value={currentConfig.dateRange}
                        onValueChange={(value) => setCurrentConfig(prev => ({ ...prev, dateRange: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                          <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                          <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Color</Label>
                      <div className="flex gap-2 flex-wrap">
                        {CHART_COLORS.map(color => (
                          <button
                            key={color}
                            className={`w-8 h-8 rounded-full border-2 ${
                              currentConfig.color === color ? 'border-gray-900' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setCurrentConfig(prev => ({ ...prev, color }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Filters</h3>
                  <Button onClick={addFilter} size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Filter
                  </Button>
                </div>

                {currentConfig.filters?.map((filter, index) => (
                  <Card key={filter.id}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-5 gap-3 items-end">
                        {index > 0 && (
                          <div>
                            <Label>Logic</Label>
                            <Select
                              value={filter.logicalOperator}
                              onValueChange={(value) => updateFilter(filter.id, { logicalOperator: value as any })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <div className={index === 0 ? "col-span-2" : ""}>
                          <Label>Field</Label>
                          <Select
                            value={filter.field}
                            onValueChange={(value) => updateFilter(filter.id, { field: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allFields.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Operator</Label>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) => updateFilter(filter.id, { operator: value as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Not Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="greater_than">Greater Than</SelectItem>
                              <SelectItem value="less_than">Less Than</SelectItem>
                              <SelectItem value="in_range">In Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Value</Label>
                          <Input
                            placeholder="Filter value..."
                            value={filter.value.toString()}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                          />
                        </div>

                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFilter(filter.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No filters added yet</p>
                    <p className="text-sm">Click "Add Filter" to start filtering your data</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preview" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Preview</h3>
                  <Button onClick={generatePreview} size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Generate Preview
                  </Button>
                </div>

                {previewData ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {currentConfig.name || 'Untitled Analytics'}
                        {currentConfig.color && (
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: currentConfig.color }}
                          />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentConfig.type === 'chart' && currentConfig.chartType ? 
                        renderChart(previewData, currentConfig.chartType, currentConfig.color!) :
                        <div className="text-center py-8">
                          <div className="text-3xl font-bold text-gray-900 mb-2">
                            {previewData.reduce((sum: number, item: any) => sum + item.value, 0)}
                          </div>
                          <p className="text-gray-500">{currentConfig.aggregation} of {currentConfig.field}</p>
                        </div>
                      }
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Click "Generate Preview" to see your analytics</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowBuilder(false)}>
                Cancel
              </Button>
              <Button 
                onClick={saveConfig}
                disabled={!currentConfig.name || !currentConfig.field}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Analytics
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Saved Configurations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map(config => (
          <Card key={config.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {config.name}
                    {config.color && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                </div>
                <Badge variant="outline">
                  {config.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Field:</span>
                  <span className="font-medium">{config.field}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Aggregation:</span>
                  <span className="font-medium">{config.aggregation}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Filters:</span>
                  <span className="font-medium">{config.filters.length}</span>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="flex-1">
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {configs.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Custom Analytics Yet</h3>
            <p className="text-sm mb-4">Create your first custom total, chart, or summary to get started</p>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Create Your First Analytics
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdvancedCustomAnalytics
