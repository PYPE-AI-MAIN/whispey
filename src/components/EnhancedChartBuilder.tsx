// Enhanced chart hook - COUNT with multi-line support
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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


export const useCountChartData = (
  config: ChartConfig,
  agentId: string,
  dateFrom: string,
  dateTo: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
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
            query = query.eq(`metadata->${config.field}`, config.filterValue)
          } else if (config.source === 'transcription_metrics') {
            query = query.eq(`transcription_metrics->${config.field}`, config.filterValue)
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

        console.log('🔍 Query setup:', {
          hasFilter: !!config.filterValue,
          source: config.source,
          field: config.field
        })

        const { data: records, error }: { data: DatabaseRecord[] | null, error: any } = await query

        if (error) {
          console.error('❌ Query error:', error)
          throw error
        }
        
        if (!records || records.length === 0) {
          console.log('⚠️ No records returned')
          setData([])
          setUniqueValues([])
          return
        }

        console.log('✅ Records found:', records.length)

        if (config.filterValue) {
          // SINGLE LINE LOGIC: Just count by date
          const grouped = records.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, groupBy)

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

          console.log('📈 Single line chart data:', chartData)
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

          console.log('📊 Processed records sample:', processedRecords.slice(0, 5))

          // Get unique values
          const uniqueVals: string[] = [...new Set(processedRecords.map(r => r.fieldValue))].sort()
          console.log('🎯 Unique values found:', uniqueVals)
          setUniqueValues(uniqueVals)

          if (uniqueVals.length === 0) {
            console.log('⚠️ No unique values found')
            setData([])
            return
          }

          // Group by date AND field value
          const grouped = processedRecords.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, groupBy)
            const fieldValue = record.fieldValue

            if (!acc[dateKey]) {
              acc[dateKey] = {}
            }
            if (!acc[dateKey][fieldValue]) {
              acc[dateKey][fieldValue] = 0
            }
            acc[dateKey][fieldValue]++
            return acc
          }, {} as { [date: string]: { [value: string]: number } })

          console.log('📊 Grouped by date and value:', Object.keys(grouped).length, 'dates')

          // Convert to chart format
          const chartData: ChartDataPoint[] = Object.entries(grouped)
            .map(([dateKey, valueCounts]) => {
              const dataPoint: ChartDataPoint = { date: dateKey }
              
              // Add count for each unique value (0 if missing)
              uniqueVals.forEach(value => {
                dataPoint[value] = valueCounts[value] || 0
              })
              
              return dataPoint
            })
            .sort((a, b) => a.date.localeCompare(b.date))

          console.log('📈 Final chart data sample:', chartData.slice(0, 2))
          console.log('🎨 Lines will be created for:', uniqueVals)
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
  }, [config, agentId, dateFrom, dateTo, groupBy])

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

    if (agentId && dateFrom && dateTo) {
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
}

export const EnhancedChartBuilder: React.FC<EnhancedChartBuilderProps> = ({ agentId, dateFrom, dateTo }) => {
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [showBuilder, setShowBuilder] = useState(false)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [newChart, setNewChart] = useState<Partial<ChartConfig>>({
    chartType: 'line',
    color: '#3b82f6'
  })

  const { fields, loading: fieldsLoading } = useQuickFieldDiscovery(agentId, dateFrom, dateTo)

  // Predefined table fields for quick access
  const tableFields = [
    'call_ended_reason',
    'transcript_type',
    'environment'
  ]

  const addChart = () => {
    if (!newChart.field || !newChart.source) return

    const chart: ChartConfig = {
      id: Date.now().toString(),
      title: newChart.title || `${newChart.field} Count${newChart.filterValue ? ` (${newChart.filterValue})` : ''}`,
      field: newChart.field,
      source: newChart.source as any,
      chartType: newChart.chartType as any,
      filterValue: newChart.filterValue,
      color: newChart.color || '#3b82f6'
    }

    setCharts(prev => [...prev, chart])
    setNewChart({ chartType: 'line', color: '#3b82f6' })
    setShowBuilder(false)
  }

  // Enhanced Chart Component with professional styling
  const ChartComponent = ({ config }: { config: ChartConfig }) => {
    const { data, loading, error, uniqueValues } = useCountChartData(config, agentId, dateFrom, dateTo, groupBy)

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
                  if (groupBy === 'day') {
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
                uniqueValues.map((value, index) => (
                  <Line
                    key={value}
                    type="monotone"
                    dataKey={value}
                    stroke={colors[index % colors.length]}
                    strokeWidth={3}
                    dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: colors[index % colors.length] }}
                  />
                ))
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
                  if (groupBy === 'day') {
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
                uniqueValues.map((value, index) => (
                  <Bar
                    key={value}
                    dataKey={value}
                    stackId="stack"
                    fill={colors[index % colors.length]}
                    radius={index === uniqueValues.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  />
                ))
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
      {/* Header with Group By Control */}
      <Card className="border-0 bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Count Analytics</h3>
                <p className="text-sm text-gray-600">
                  {fields.metadata.length} metadata fields • {fields.transcription_metrics.length} transcription fields
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Chart
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map(chart => (
            <Card key={chart.id} className="border-0 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">{chart.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCharts(prev => prev.filter(c => c.id !== chart.id))}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <ChartComponent config={chart} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart Builder Modal - Same as before */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Add Count Chart</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowBuilder(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Source Selection */}
              <div>
                <Label>Data Source</Label>
                <Select
                  value={newChart.source}
                  onValueChange={(value) => setNewChart(prev => ({ ...prev, source: value as any, field: undefined }))}
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
              </div>

              {/* Field Selection */}
              {newChart.source && (
                <div>
                  <Label>Field</Label>
                  <Select
                    value={newChart.field}
                    onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {(newChart.source === 'table' ? tableFields : fields[newChart.source as keyof typeof fields]).map(field => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Filter Value */}
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

              {/* Chart Type */}
              <div>
                <Label>Chart Type</Label>
                <Select
                  value={newChart.chartType}
                  onValueChange={(value) => setNewChart(prev => ({ ...prev, chartType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="bar">Bar Chart (Stacked)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowBuilder(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={addChart}
                  disabled={!newChart.field || !newChart.source}
                >
                  Add Chart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}