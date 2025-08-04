'use client'
import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from 'recharts'
import { EnhancedChartBuilder } from './EnhancedChartBuilder'

import { 
  Phone, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Loader2,
  AlertCircle,
  Users,
  CalendarDays
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useOverviewQuery } from '../../hooks/useOverviewQuery'
import AgentCustomLogsView from './AgentCustomLogsView'


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

const Overview: React.FC<OverviewProps> = ({ project, agent }) => {
  const [quickFilter, setQuickFilter] = useState('7d')
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

  // CHANGE 2: Replace the old useSupabaseQuery with the optimized hook
  const { data: analytics, loading, error } = useOverviewQuery({
    agentId: agent.id,
    dateFrom: apiDateRange.from,
    dateTo: apiDateRange.to
  })


  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
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

  return (
    <div className="p-6 flex-1  overflow-scroll max-w-[1400px] mx-auto space-y-8">
      {/* Date Filters */}
      <div className="flex flex-col sm:flex-row items-right  gap-4">
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

      {analytics ? (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            <Card className="border-0 bg-gray-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">{analytics.averageLatency.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">overall Latency</p>
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
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Daily Calls */}
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
                      <Tooltip />
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

            {/* Daily Latency */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Average Latency</h3>
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
                      <Tooltip />
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
            </Card>
            

            {/* Daily Minutes */}
            <Card className="border-0 bg-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Minutes</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {/* CHANGE 5: Use analytics.dailyData instead of analytics.chartData */}
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
                      <Tooltip />
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
          </div>

     

          <AgentCustomLogsView
            agentId={agent.id}
            dateRange={apiDateRange} // { from: '2024-07-01', to: '2024-07-31' }
          />

          <EnhancedChartBuilder 
                      agentId={agent.id}
                      dateFrom={apiDateRange.from}
                      dateTo={apiDateRange.to}
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