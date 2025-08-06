'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useUser } from "@clerk/nextjs"
import CustomTotalsBuilder from './CustomTotalBuilds'
import { CustomTotalsService } from '@/services/customTotalService'
import { CustomTotalConfig, CustomTotalResult } from '../types/customTotals'
import { useDynamicFields } from '../hooks/useDynamicFields'

import { 
  Phone, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Loader2,
  AlertCircle,
  Users,
  CalendarDays,
  Calculator,
  DollarSign,
  MoreHorizontal
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts'
import { useOverviewQuery } from '../hooks/useOverviewQuery'
import AgentCustomLogsView from './calls/AgentCustomLogsView'
import { getUserProjectRole } from '@/services/getUserRole'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2 } from 'lucide-react'
import { EnhancedChartBuilder } from './EnhancedChartBuilder'

// ... (utility functions remain the same)
const subDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const formatDateISO = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const formatDateDisplay = (date: Date) => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

interface OverviewProps {
  project: any
  agent: any
}

interface DateRange {
  from: Date | undefined
  to?: Date | undefined
}

// Icon mapping for custom totals
const ICON_COMPONENTS = {
  phone: Phone,
  clock: Clock,
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  calculator: Calculator,
  users: Users
}

// Color mapping for custom totals
const COLOR_CLASSES = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  emerald: 'bg-emerald-100 text-emerald-600'
}

const AVAILABLE_COLUMNS = [
  { key: 'customer_number', label: 'Customer Number', type: 'text' as const },
  { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number' as const },
  { key: 'avg_latency', label: 'Avg Latency', type: 'number' as const },
  { key: 'call_started_at', label: 'Call Date', type: 'date' as const },
  { key: 'call_ended_reason', label: 'Call Status', type: 'text' as const },
  { key: 'total_llm_cost', label: 'LLM Cost', type: 'number' as const },
  { key: 'total_tts_cost', label: 'TTS Cost', type: 'number' as const },
  { key: 'total_stt_cost', label: 'STT Cost', type: 'number' as const },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' as const },
  { key: 'transcription_metrics', label: 'Transcription Metrics', type: 'jsonb' as const }
]

const Overview: React.FC<OverviewProps> = ({ project, agent }) => {
  const [quickFilter, setQuickFilter] = useState('7d')
  const [role, setRole] = useState<string | null>(null)
  const [customTotals, setCustomTotals] = useState<CustomTotalConfig[]>([])
  const [customTotalResults, setCustomTotalResults] = useState<CustomTotalResult[]>([])
  const [loadingCustomTotals, setLoadingCustomTotals] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true) // Add loading state for role

  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress

  // FIXED: Extract dynamic fields from actual call data
  const { 
    metadataFields, 
    transcriptionFields, 
    loading: fieldsLoading,
    error: fieldsError 
  } = useDynamicFields(agent.id)

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [isCustomRange, setIsCustomRange] = useState(false)

  // Quick filter options
  const quickFilters = [
    { id: '1d', label: '1 Day', days: 1 },
    { id: '7d', label: '7 Days', days: 7 },
    { id: '30d', label: '30 Days', days: 30 }
  ]

  // Calculate date range for API
  const apiDateRange = useMemo(() => {
    if (isCustomRange && dateRange.from && dateRange.to) {
      return {
        from: formatDateISO(dateRange.from),
        to: formatDateISO(dateRange.to)
      }
    }
    
    const days = quickFilters.find(f => f.id === quickFilter)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    return {
      from: formatDateISO(startDate),
      to: formatDateISO(endDate)
    }
  }, [quickFilter, dateRange, isCustomRange])

  // Load user role and custom totals
  useEffect(() => {
    if (userEmail) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail, project.id)
          setRole(userRole)
        } catch (error) {
          console.error('Failed to load user role:', error)
          setRole('user') // Default to most restrictive role on error
        } finally {
          setRoleLoading(false)
        }
      }
      getUserRole()
    } else {
      setRoleLoading(false)
      setRole('user') // Default when no user email
    }
  }, [userEmail, project.id])

  // Load custom totals from database
  const loadCustomTotals = async () => {
    try {
      const configs = await CustomTotalsService.getCustomTotals(project.id, agent.id)
      setCustomTotals(configs)
    } catch (error) {
      console.error('Failed to load custom totals:', error)
    }
  }

  useEffect(() => {
    if (role !== null && !roleLoading) {
      loadCustomTotals()
    }
  }, [role, roleLoading])

  // Calculate custom total values when date range or configs change
  useEffect(() => {
    if (customTotals.length > 0) {
      calculateCustomTotals()
    }
  }, [customTotals, apiDateRange, role])

  const calculateCustomTotals = async () => {
    if (customTotals.length === 0) return
    
    setLoadingCustomTotals(true)
    try {
      const results = await Promise.all(
        customTotals.map(config =>
          CustomTotalsService.calculateCustomTotal(
            config, 
            agent.id, 
            apiDateRange.from, 
            apiDateRange.to
          )
        )
      )

      setCustomTotalResults(results)
    } catch (error) {
      console.error('Failed to calculate custom totals:', error)
    } finally {
      setLoadingCustomTotals(false)
    }
  }

  // Handle saving new custom total
  const handleSaveCustomTotal = async (config: CustomTotalConfig) => {

    try {
      const result = await CustomTotalsService.saveCustomTotal(config, project.id, agent.id)
      if (result.success) {
        await loadCustomTotals() // Reload the list
      } else {
        alert(`Failed to save: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save custom total:', error)
      alert('Failed to save custom total')
    }
  }

  // Handle deleting custom total
  const handleDeleteCustomTotal = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this custom total?')) return

    try {
      const result = await CustomTotalsService.deleteCustomTotal(configId)
      if (result.success) {
        await loadCustomTotals() // Reload the list
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete custom total:', error)
      alert('Failed to delete custom total')
    }
  }

  // Handle quick filter selection
  const handleQuickFilter = (filterId: string) => {
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
  }

  // Handle custom date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range)
      setIsCustomRange(true)
      setQuickFilter('')
    }
  }

  const { data: analytics, loading, error } = useOverviewQuery({
    agentId: agent.id,
    dateFrom: apiDateRange.from,
    dateTo: apiDateRange.to
  })


  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading user permissions...</p>
        </div>
      </div>
    )
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Unable to load data</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const formatCustomTotalValue = (result: CustomTotalResult, config: CustomTotalConfig) => {
    if (result.error) return 'Error'
    
    const value = typeof result.value === 'number' ? result.value : parseFloat(result.value as string) || 0
    
    // Format based on aggregation type
    switch (config.aggregation) {
      case 'AVG':
        return value.toFixed(2)
      case 'SUM':
        if (config.column.includes('cost')) {
          return `₹${value.toFixed(2)}`
        }
        return value.toLocaleString()
      case 'COUNT':
      case 'COUNT_DISTINCT':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }


  return (
    <div className="p-6 flex-1 overflow-scroll mx-auto space-y-8">
      {/* Date Filters and Custom Total Builder */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-left gap-4">
          {/* Quick Filters */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {quickFilters.map((filter) => (
              <Button
                key={filter.id}
                variant={quickFilter === filter.id && !isCustomRange ? "default" : "ghost"}
                size="sm"
                onClick={() => handleQuickFilter(filter.id)}
                className="px-4 py-2"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={isCustomRange ? "default" : "outline"}
                className="w-[300px] justify-start text-left font-normal"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {formatDateDisplay(dateRange.from)} - {formatDateDisplay(dateRange.to)}
                    </>
                  ) : (
                    formatDateDisplay(dateRange.from)
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* FIXED: Custom Total Builder with dynamic fields */}
        {userEmail && !fieldsLoading && (
          <CustomTotalsBuilder
            agentId={agent.id}
            projectId={project.id}
            userEmail={userEmail}
            availableColumns={AVAILABLE_COLUMNS}
            dynamicMetadataFields={metadataFields}
            dynamicTranscriptionFields={transcriptionFields}
            onSave={handleSaveCustomTotal}
          />
        )}

        {/* Show loading or error for dynamic fields */}
        {fieldsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading fields...
          </div>
        )}

        {fieldsError && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            {fieldsError}
          </div>
        )}
      </div>

      {/* Debug info for dynamic fields (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm">
              <strong>Debug - Dynamic Fields:</strong>
              <div>Metadata: {metadataFields.join(', ') || 'None'}</div>
              <div>Transcription: {transcriptionFields.join(', ') || 'None'}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics ? (
        <>
          {/* Key Metrics Cards - Default + Custom */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Default Metrics */}
            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.totalCalls}</p>
                    <p className="text-sm text-gray-600">Total Calls</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.successfulCalls}</p>
                    <p className="text-sm text-gray-600">Answered</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {Math.ceil(parseFloat(((analytics.successfulCalls / analytics.totalCalls) * 100).toFixed(2)))
                      }%
                    </p>
                    <p className="text-sm text-gray-600">Pickup Rate</p>  
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.totalMinutes}</p>
                    <p className="text-sm text-gray-600">Total Minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role-based Default Metrics */}
            {role !== "user" && (
              <>
                <Card className="border-0 bg-gray-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-gray-900">
                          ₹{analytics.totalCost?.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">Total Cost</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-gray-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-gray-900">
                          {analytics.averageLatency.toFixed(2)}s
                        </p>
                        <p className="text-sm text-gray-600">Avg Latency</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Custom Totals */}
            {customTotalResults.map((result) => {
              const config = customTotals.find(c => c.id === result.configId)
              if (!config) return null

              const IconComponent = ICON_COMPONENTS[config.icon as keyof typeof ICON_COMPONENTS] || Calculator
              const colorClass = COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue

              return (
                <Card key={config.id} className="border-0 bg-gray-50/50 relative group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 ${colorClass} rounded-xl flex items-center justify-center`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-2xl font-semibold text-gray-900 truncate">
                            {loadingCustomTotals ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              formatCustomTotalValue(result, config)
                            )}
                          </p>
                          <p className="text-sm text-gray-600 truncate" title={config.name}>
                            {config.name}
                          </p>
                          {result.error && (
                            <p className="text-xs text-red-500">
                              {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDeleteCustomTotal(config.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Filter Summary */}
                    {config.filters.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {config.filters.length} filter{config.filters.length > 1 ? 's' : ''} ({config.filterLogic})
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Rest of your charts and components remain the same */}
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Calls Chart */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Calls</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.dailyData}>
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
                       <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      labelStyle={{ color: '#374151' }}
                    />
                      <Line 
                        type="monotone" 
                        dataKey="calls" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Daily Minutes Chart */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Minutes</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.dailyData}>
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
                      <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      labelStyle={{ color: '#374151' }}
                    />
                      <Bar 
                        dataKey="minutes" 
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

           {role !== "user" && <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Average Latency in Seconds</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.dailyData}>
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
                      <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      labelStyle={{ color: '#374151' }}
                    />
                      <Line 
                        type="monotone" 
                        dataKey="avg_latency" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>}
          </div>

          <AgentCustomLogsView
            agentId={agent.id}
            dateRange={apiDateRange}
          />

          <EnhancedChartBuilder
            agentId={agent.id}
            transcriptionFields={transcriptionFields}
            metadataFields={metadataFields}
            dateFrom={apiDateRange.from}
            dateTo={apiDateRange.to}
            fieldsLoading={fieldsLoading}
          />
          {/* Additional Stats */}
          <Card className="border-0 bg-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{analytics.uniqueCustomers}</p>
                  <p className="text-sm text-gray-600">Unique Customers</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {analytics.totalCalls > 0 ? Math.round(analytics.totalMinutes / analytics.totalCalls) : 0}
                  </p>
                  <p className="text-sm text-gray-600">Avg Duration (min)</p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-xl font-semibold text-gray-900">{analytics.totalCalls - analytics.successfulCalls}</p>
                  <p className="text-sm text-gray-600">Failed Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
        </>
      ) : (
        <Card className="border-0 bg-white">
          <CardContent className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No data available</h3>
            <p className="text-gray-600">
              No calls found for the selected time period. Try selecting a different date range.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Overview