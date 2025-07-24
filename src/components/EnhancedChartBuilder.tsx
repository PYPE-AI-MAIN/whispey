// Simplified chart hook - COUNT ONLY
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
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

// COUNT ONLY hook
export const useCountChartData = (
  config: ChartConfig,
  agentId: string,
  dateFrom: string,
  dateTo: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
) => {
  const [data, setData] = useState<Array<{ date: string; value: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!config.field) return

    const fetchChartData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Single query to get all matching records
        let query = supabase
          .from('pype_voice_call_logs')
          .select('created_at')
          .eq('agent_id', agentId)
          .gte('created_at', `${dateFrom}T00:00:00`)
          .lte('created_at', `${dateTo}T23:59:59`)

        // Add filter based on source
        if (config.source === 'table' && config.filterValue) {
          query = query.eq(config.field, config.filterValue)
        } else if (config.source === 'metadata' && config.filterValue) {
          query = query.eq(`metadata->>${config.field}`, config.filterValue)
        } else if (config.source === 'transcription_metrics' && config.filterValue) {
          query = query.eq(`transcription_metrics->>${config.field}`, config.filterValue)
        } else if (config.source === 'metadata') {
          // Count where field exists in metadata
          query = query.not(`metadata->>${config.field}`, 'is', null)
        } else if (config.source === 'transcription_metrics') {
          // Count where field exists in transcription_metrics
          query = query.not(`transcription_metrics->>${config.field}`, 'is', null)
        }

        const { data: records, error } = await query

        if (error) throw error
        if (!records) {
          setData([])
          return
        }

        // Group by time period and count
        const grouped = records.reduce((acc, record) => {
          const date = new Date(record.created_at)
          const dateKey = getDateKey(date, groupBy)

          if (!acc[dateKey]) {
            acc[dateKey] = 0
          }
          acc[dateKey]++
          return acc
        }, {} as { [key: string]: number })

        // Convert to chart data format
        const chartData = Object.entries(grouped)
          .map(([dateKey, count]) => ({
            date: dateKey,
            value: count
          }))
          .sort((a, b) => a.date.localeCompare(b.date))

        setData(chartData)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chart data')
        console.error('Chart data fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [config, agentId, dateFrom, dateTo, groupBy])

  return { data, loading, error }
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

// Simplified field discovery - same as before but cleaner
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
        sampleRecords?.forEach(record => {
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

// Simplified Chart Builder Component - COUNT ONLY
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

  console.log(dateFrom,dateTo)
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

  const ChartComponent = ({ config }: { config: ChartConfig }) => {
    const { data, loading, error } = useCountChartData(config, agentId, dateFrom, dateTo, groupBy)

    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="h-64 flex items-center justify-center text-red-500 text-sm">
          Error: {error}
        </div>
      )
    }

    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          No data available
        </div>
      )
    }

    return (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {config.chartType === 'line' ? (
            <LineChart data={data}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={config.color}
                strokeWidth={3}
                dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: config.color }}
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip />
              <Bar 
                dataKey="value" 
                fill={config.color}
                radius={[4, 4, 0, 0]}
              />
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
            <Card key={chart.id} className="border-0 bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{chart.title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCharts(prev => prev.filter(c => c.id !== chart.id))}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ChartComponent config={chart} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chart Builder Modal - SIMPLIFIED FOR COUNT ONLY */}
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
                  Leave empty to count all records with this field
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
                    <SelectItem value="bar">Bar Chart</SelectItem>
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