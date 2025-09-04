// Enhanced chart hook - COUNT with multi-line support
import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Plus, X, Loader2, TrendingUp } from 'lucide-react'

interface ChartConfig {
  id: string
  title: string
  field: string
  source: 'table' | 'metadata' | 'transcription_metrics'
  chartType: 'line' | 'bar'
  filterValue?: string
  color: string
  groupBy: 'day' | 'week' | 'month'
}


interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

interface DatabaseRecord {
  created_at: string
  [key: string]: any
  metadata?: { [key: string]: any }
  transcription_metrics?: { [key: string]: any }
}

interface ProcessedRecord {
  created_at: string
  fieldValue: string
}

// Chart Context
interface ChartContextType {
  charts: ChartConfig[]
  setCharts: React.Dispatch<React.SetStateAction<ChartConfig[]>>
  newChart: Partial<ChartConfig>
  setNewChart: React.Dispatch<React.SetStateAction<Partial<ChartConfig>>>
  addChart: () => void
  removeChart: (id: string) => void
  updateChartGroupBy: (id: string, groupBy: 'day' | 'week' | 'month') => void
}

const ChartContext = createContext<ChartContextType | undefined>(undefined)

export const useChartContext = () => {
  const context = useContext(ChartContext)
  if (!context) {
    throw new Error('useChartContext must be used within a ChartProvider')
  }
  return context
}

// Chart Provider Component
interface ChartProviderProps {
  children: React.ReactNode
}

export const ChartProvider: React.FC<ChartProviderProps> = ({ children }) => {
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [newChart, setNewChart] = useState<Partial<ChartConfig>>({
    chartType: 'line',
    color: '#3b82f6',
    groupBy: 'day'
  })

  const addChart = () => {
    if (!newChart.field || !newChart.source) return

    const chart: ChartConfig = {
      id: Date.now().toString(),
      title: newChart.title || `${newChart.field} Count${newChart.filterValue ? ` (${newChart.filterValue})` : ''}`,
      field: newChart.field,
      source: newChart.source as 'table' | 'metadata' | 'transcription_metrics',
      chartType: newChart.chartType as 'line' | 'bar',
      filterValue: newChart.filterValue,
      color: newChart.color || '#3b82f6',
      groupBy: newChart.groupBy as 'day' | 'week' | 'month' || 'day'
    }

    setCharts(prev => [...prev, chart])
    setNewChart({ chartType: 'line', color: '#3b82f6', groupBy: 'day' })
  }

  const removeChart = (id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id))
  }

  const updateChartGroupBy = (id: string, groupBy: 'day' | 'week' | 'month') => {
    setCharts(prev => prev.map(chart => 
      chart.id === id ? { ...chart, groupBy } : chart
    ))
  }

  return (
    <ChartContext.Provider value={{
      charts,
      setCharts,
      newChart,
      setNewChart,
      addChart,
      removeChart,
      updateChartGroupBy
    }}>
      {children}
    </ChartContext.Provider>
  )
}


export const useCountChartData = (
  config: ChartConfig,
  agentId: string,
  dateFrom: string,
  dateTo: string
) => {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uniqueValues, setUniqueValues] = useState<string[]>([])

  useEffect(() => {
    if (!config.field) return

    const fetchChartData = async () => {
      try {
        setLoading(true)
        setError(null)

        let query: any

        if (config.filterValue) {
          // SINGLE LINE: Filter for specific value, only need created_at
          query = supabase
            .from('pype_voice_call_logs')
            .select('created_at')  // ✅ FIXED: Added .select()
            .eq('agent_id', agentId)
            .gte('created_at', `${dateFrom}T00:00:00`)
            .lte('created_at', `${dateTo}T23:59:59`)
          
          if (config.source === 'table') {
            query = query.eq(config.field, config.filterValue)
          } else if (config.source === 'metadata') {
            // Use text extraction for safe comparisons (avoids invalid JSON token errors)
            query = query.eq(`metadata->>${config.field}`, config.filterValue)
          } else if (config.source === 'transcription_metrics') {
            // Use text extraction for safe comparisons
            query = query.eq(`transcription_metrics->>${config.field}`, config.filterValue)
          }
        } else {
          // MULTI-LINE: Need the actual field data to group by values
          if (config.source === 'table') {
            query = supabase
              .from('pype_voice_call_logs')
              .select(`created_at, ${config.field}`)  // ✅ FIXED: Added .select()
              .eq('agent_id', agentId)
              .gte('created_at', `${dateFrom}T00:00:00`)
              .lte('created_at', `${dateTo}T23:59:59`)
          } else if (config.source === 'metadata') {
            query = supabase
              .from('pype_voice_call_logs')
              .select('created_at, metadata')  // ✅ FIXED: Added .select()
              .eq('agent_id', agentId)
              .gte('created_at', `${dateFrom}T00:00:00`)
              .lte('created_at', `${dateTo}T23:59:59`)
              .not(`metadata->${config.field}`, 'is', null)
          } else if (config.source === 'transcription_metrics') {
            query = supabase
              .from('pype_voice_call_logs')
              .select('created_at, transcription_metrics')  // ✅ FIXED: Added .select()
              .eq('agent_id', agentId)
              .gte('created_at', `${dateFrom}T00:00:00`)
              .lte('created_at', `${dateTo}T23:59:59`)
              .not(`transcription_metrics->${config.field}`, 'is', null)
          }
        }

        const { data: records, error }: { data: DatabaseRecord[] | null, error: any } = await query

        if (error) {
          console.error('❌ Query error:', error)
          throw error
        }
        
        if (!records || records.length === 0) {
          setData([])
          setUniqueValues([])
          return
        }


        if (config.filterValue) {
          // SINGLE LINE LOGIC: Just count by date
          const grouped = records.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, config.groupBy)

            if (!acc[dateKey]) {
              acc[dateKey] = 0
            }
            acc[dateKey]++
            return acc
          }, {} as { [key: string]: number })

          const chartData: ChartDataPoint[] = Object.entries(grouped)
            .map(([dateKey, count]) => ({
              date: dateKey,
              value: count
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

          setData(chartData)
          setUniqueValues([])
        } else {
          // MULTI-LINE LOGIC: Extract field values and group by both date AND value
          const processedRecords: ProcessedRecord[] = records.map(record => {
            let fieldValue: any
            
            if (config.source === 'table') {
              fieldValue = record[config.field]
            } else if (config.source === 'metadata') {
              fieldValue = record.metadata?.[config.field]
            } else if (config.source === 'transcription_metrics') {
              fieldValue = record.transcription_metrics?.[config.field]
            }

            // Convert to string, handling booleans properly
            let fieldString: string
            if (fieldValue === null || fieldValue === undefined) {
              fieldString = 'null'
            } else if (typeof fieldValue === 'boolean') {
              fieldString = fieldValue.toString() // true -> "true", false -> "false"
            } else {
              fieldString = String(fieldValue)
            }

            return {
              created_at: record.created_at,
              fieldValue: fieldString
            }
          }).filter((record: ProcessedRecord) => record.fieldValue !== 'null') // Remove null values


          // Get unique values and their counts
          const valueCounts = processedRecords.reduce((acc, record) => {
            acc[record.fieldValue] = (acc[record.fieldValue] || 0) + 1
            return acc
          }, {} as { [key: string]: number })

          // Sort by count (descending) and take top 10
          const topValues = Object.entries(valueCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([value]) => value)

          const uniqueVals: string[] = topValues
          setUniqueValues(uniqueVals)

          if (uniqueVals.length === 0) {
            setData([])
            return
          }

          // Group by date AND field value (with "Others" for remaining values)
          const grouped = processedRecords.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, config.groupBy)
            // Group less common values as "Others"
            const fieldValue = uniqueVals.includes(record.fieldValue) ? record.fieldValue : 'Others'

            if (!acc[dateKey]) {
              acc[dateKey] = {}
            }
            if (!acc[dateKey][fieldValue]) {
              acc[dateKey][fieldValue] = 0
            }
            acc[dateKey][fieldValue]++
            return acc
          }, {} as { [date: string]: { [value: string]: number } })

          // Add "Others" to uniqueVals if there are more than 10 total unique values
          const allUniqueVals = Object.keys(valueCounts)
          const finalUniqueVals = allUniqueVals.length > 10 ? [...uniqueVals, 'Others'] : uniqueVals
          setUniqueValues(finalUniqueVals)


          // Convert to chart format
          const chartData: ChartDataPoint[] = Object.entries(grouped)
            .map(([dateKey, valueCounts]) => {
              const dataPoint: ChartDataPoint = { date: dateKey }
              
              // Add count for each unique value (0 if missing)
              finalUniqueVals.forEach(value => {
                dataPoint[value] = valueCounts[value] || 0
              })
              
              return dataPoint
            })
            .sort((a, b) => a.date.localeCompare(b.date))


          setData(chartData)
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chart data')
        console.error('❌ Chart data fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [config, agentId, dateFrom, dateTo])

  return { data, loading, error, uniqueValues }
}

// Helper function to get date key based on groupBy
const getDateKey = (date: Date, groupBy: 'day' | 'week' | 'month'): string => {
  switch (groupBy) {
    case 'week':
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      return weekStart.toISOString().split('T')[0]
    
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    default: // day
      return date.toISOString().split('T')[0]
  }
}

// Simplified field discovery - same as before
export const useQuickFieldDiscovery = (agentId: string, dateFrom: string, dateTo: string) => {
  const [fields, setFields] = useState<{
    metadata: string[]
    transcription_metrics: string[]
  }>({ metadata: [], transcription_metrics: [] })
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const discoverFields = async () => {
      try {
        setLoading(true)

        // Get transcription fields from agent configuration
        const { data: agentData } = await supabase
          .from('pype_voice_agents')
          .select('field_extractor_keys')
          .eq('id', agentId)
          .single()


        // Get metadata fields from sample data
        const { data: sampleRecords } = await supabase
          .from('pype_voice_call_logs')
          .select('metadata')
          .eq('agent_id', agentId)
          .gte('created_at', `${dateFrom}T00:00:00`)
          .lte('created_at', `${dateTo}T23:59:59`)
          .not('metadata', 'is', null)
          .limit(20)

        // Extract metadata field names
        const metadataKeys = new Set<string>()
        sampleRecords?.forEach((record:any) => {
          if (record.metadata && typeof record.metadata === 'object') {
            Object.keys(record.metadata).forEach(key => {
              if (key && record.metadata[key] != null) {
                metadataKeys.add(key)
              }
            })
          }
        })

        setFields({
          metadata: Array.from(metadataKeys),
          transcription_metrics: agentData?.field_extractor_keys || []
        })
      } catch (error) {
        console.error('Field discovery error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (true) {
      discoverFields()
    }
  }, [agentId, dateFrom, dateTo])

  return { fields, loading }
}

// Enhanced Chart Builder Component
interface EnhancedChartBuilderProps {
  agentId: string
  dateFrom: string
  dateTo: string
  metadataFields: string[]
  transcriptionFields: string[]
  fieldsLoading: boolean
}

const EnhancedChartBuilderContent: React.FC<EnhancedChartBuilderProps> = ({ 
  agentId, 
  dateFrom, 
  dateTo, 
  metadataFields, 
  transcriptionFields, 
  fieldsLoading 
}) => {
  const { charts, removeChart, updateChartGroupBy, newChart, setNewChart, addChart } = useChartContext()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const fields = {
    metadata: metadataFields,
    transcription_metrics: transcriptionFields
  }

  const tableFields = [
    'call_ended_reason',
    'transcript_type',
    'environment'
  ]

  const handleAddChart = () => {
    addChart()
    setCreateDialogOpen(false)
  }

  if (fieldsLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-0 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Discovering available fields...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Enhanced Chart Component with professional styling
  const ChartComponent = ({ config }: { config: ChartConfig }) => {
    const { data, loading, error, uniqueValues } = useCountChartData(config, agentId, dateFrom, dateTo)

    if (loading) {
      return (
        <div className="h-80 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="h-80 flex items-center justify-center text-red-500 text-sm">
          Error: {error}
        </div>
      )
    }

    if (!data || data.length === 0) {
      return (
        <div className="h-80 flex items-center justify-center text-gray-500 text-sm">
          No data available
        </div>
      )
    }

    // Professional color palette
    const colors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ]

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
            <p className="font-medium text-gray-900 mb-2">{label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700">
                    {entry.dataKey === 'value' ? config.field : entry.dataKey}
                  </span>
                </div>
                <span className="text-sm font-semibold">{entry.value}</span>
              </div>
            ))}
          </div>
        )
      }
      return null
    }

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {config.chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => {
                  if (config.groupBy === 'day') {
                    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  return value
                }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              {config.filterValue ? (
                // Single line for filtered data
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={config.color}
                  strokeWidth={3}
                  dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: config.color }}
                />
              ) : (
                // Multiple lines for each unique value
                uniqueValues.map((value, index) => {
                  const color = value === 'Others' ? '#9ca3af' : colors[index % colors.length]
                  return (
                    <Line
                      key={value}
                      type="monotone"
                      dataKey={value}
                      stroke={color}
                      strokeWidth={3}
                      dot={{ fill: color, strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: color }}
                    />
                  )
                })
              )}
              {!config.filterValue && uniqueValues.length > 1 && (
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
              )}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => {
                  if (config.groupBy === 'day') {
                    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }
                  return value
                }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              {config.filterValue ? (
                // Single bar series for filtered data
                <Bar 
                  dataKey="value" 
                  fill={config.color}
                  radius={[6, 6, 0, 0]}
                />
              ) : (
                // Stacked bars for each unique value
                uniqueValues.map((value, index) => {
                  const color = value === 'Others' ? '#9ca3af' : colors[index % colors.length]
                  return (
                    <Bar
                      key={value}
                      dataKey={value}
                      stackId="stack"
                      fill={color}
                      radius={index === uniqueValues.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  )
                })
              )}
              {!config.filterValue && uniqueValues.length > 1 && (
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  if (fieldsLoading) {
    return (
      <div className="space-y-6">
        <Card className="border-0 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Discovering available fields...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Charts Grid */}
      {charts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map(chart => (
            <Card key={chart.id} className="border border-gray-300 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-semibold">{chart.title}</CardTitle>
                  {!chart.filterValue && (
                    <p className="text-xs text-gray-500 mt-1">
                      Showing top 10 most frequent values
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={chart.groupBy} 
                    onValueChange={(value: 'day' | 'week' | 'month') => updateChartGroupBy(chart.id, value)}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChart(chart.id)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartComponent config={chart} />
              </CardContent>
            </Card>
          ))}
          <Card className="border border-dashed border-gray-300 bg-white hover:shadow-md transition-shadow flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-sm text-gray-600">Create your custom chart</div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Create
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Count Chart</DialogTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Build a chart that counts calls grouped by a field and time. Use a filter value to focus on a specific value, or leave it empty to compare the most frequent values.
                    </p>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[calc(90vh-100px)] overflow-y-auto">
                    <div>
                      <Label>Data Source</Label>
                      <Select
                        value={newChart.source as any}
                        onValueChange={(value) => setNewChart(prev => ({ 
                          ...prev, 
                          source: value as 'table' | 'metadata' | 'transcription_metrics', 
                          field: undefined 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select data source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="table">Table Fields ({tableFields.length})</SelectItem>
                          <SelectItem value="metadata">Metadata ({fields.metadata.length} fields)</SelectItem>
                          <SelectItem value="transcription_metrics">Transcription ({fields.transcription_metrics.length} fields)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose where the field lives: core table columns, metadata, or transcription metrics.
                      </p>
                    </div>
                    {newChart.source && (
                      <div>
                        <Label>Field</Label>
                        <Select
                          value={newChart.field as any}
                          onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {(newChart.source === 'table' ? tableFields : fields[newChart.source as keyof typeof fields]).map((field: any) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          Pick the field whose values you want to count over time.
                        </p>
                      </div>
                    )}
                    <div>
                      <Label>Filter Value (Optional)</Label>
                      <Input
                        placeholder="e.g., 'Yes', 'completed', 'Successful'"
                        value={newChart.filterValue || ''}
                        onChange={(e) => setNewChart(prev => ({ ...prev, filterValue: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to show multiple lines for all values
                      </p>
                    </div>
                    <div>
                      <Label>Chart Type</Label>
                      <Select
                        value={newChart.chartType as any}
                        onValueChange={(value) => setNewChart(prev => ({ 
                          ...prev, 
                          chartType: value as 'line' | 'bar' 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line">Line Chart</SelectItem>
                          <SelectItem value="bar">Bar Chart (Stacked)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Line is ideal for trends; stacked bars compare value distributions per date.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button onClick={handleAddChart} disabled={!newChart.field || !newChart.source}>
                        Add Chart
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your custom chart
          </p>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Create
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Count Chart</DialogTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Build a chart that counts calls grouped by a field and time. Use a filter value to focus on a specific value, or leave it empty to compare the most frequent values.
                </p>
              </DialogHeader>
              <div className="space-y-4 max-h-[calc(90vh-100px)] overflow-y-auto">
                <div>
                  <Label>Data Source</Label>
                  <Select
                    value={newChart.source as any}
                    onValueChange={(value) => setNewChart(prev => ({ 
                      ...prev, 
                      source: value as 'table' | 'metadata' | 'transcription_metrics', 
                      field: undefined 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table Fields ({tableFields.length})</SelectItem>
                      <SelectItem value="metadata">Metadata ({fields.metadata.length} fields)</SelectItem>
                      <SelectItem value="transcription_metrics">Transcription ({fields.transcription_metrics.length} fields)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose where the field lives: core table columns, metadata, or transcription metrics.
                  </p>
                </div>
                {newChart.source && (
                  <div>
                    <Label>Field</Label>
                    <Select
                      value={newChart.field as any}
                      onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {(newChart.source === 'table' ? tableFields : fields[newChart.source as keyof typeof fields]).map((field: any) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Pick the field whose values you want to count over time.
                    </p>
                  </div>
                )}
                <div>
                  <Label>Filter Value (Optional)</Label>
                  <Input
                    placeholder="e.g., 'Yes', 'completed', 'Successful'"
                    value={newChart.filterValue || ''}
                    onChange={(e) => setNewChart(prev => ({ ...prev, filterValue: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to show multiple lines for all values
                  </p>
                </div>
                <div>
                  <Label>Chart Type</Label>
                  <Select
                    value={newChart.chartType as any}
                    onValueChange={(value) => setNewChart(prev => ({ 
                      ...prev, 
                      chartType: value as 'line' | 'bar' 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="bar">Bar Chart (Stacked)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Line is ideal for trends; stacked bars compare value distributions per date.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button onClick={handleAddChart} disabled={!newChart.field || !newChart.source}>
                    Add Chart
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

// Main export component (now used within ChartProvider in parent)
export const EnhancedChartBuilder: React.FC<EnhancedChartBuilderProps> = (props) => {
  return <EnhancedChartBuilderContent {...props} />
}