'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CalendarDays, 
  Loader2,
  RefreshCw,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface AnalyticsDashboardProps {
  projectId: string
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ projectId }) => {
  const { isMobile } = useMobile(768)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Fetch hourly breakdown
  const { data: hourlyData, isLoading: hourlyLoading } = useQuery({
    queryKey: ['hourly-breakdown', projectId, dateStr, selectedAgents],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: 'all',
        date: dateStr
      })
      if (selectedAgents.length > 0) {
        params.append('agentIds', selectedAgents.join(','))
      }

      const response = await fetch(`/api/admin/hourly-breakdown?${params}`)
      if (!response.ok) throw new Error('Failed to fetch hourly breakdown')
      return response.json()
    },
    enabled: true
  })

  // Fetch component counts
  const { data: componentCounts, isLoading: componentLoading } = useQuery({
    queryKey: ['component-counts', projectId, dateStr, selectedAgents],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: 'all',
        date: dateStr
      })
      if (selectedAgents.length > 0) {
        params.append('agentIds', selectedAgents.join(','))
      }

      const response = await fetch(`/api/admin/component-counts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch component counts')
      return response.json()
    },
    enabled: true
  })

  // Fetch error type counts
  const { data: errorTypeCounts, isLoading: typeLoading } = useQuery({
    queryKey: ['error-type-counts', projectId, dateStr, selectedAgents],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: 'all',
        date: dateStr
      })
      if (selectedAgents.length > 0) {
        params.append('agentIds', selectedAgents.join(','))
      }

      const response = await fetch(`/api/admin/error-type-counts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch error type counts')
      return response.json()
    },
    enabled: true
  })

  const hourlyChartData = useMemo(() => {
    if (!hourlyData?.hourlyBreakdown) return []
    
    return Object.entries(hourlyData.hourlyBreakdown).map(([hour, data]: [string, any]) => ({
      hour: `${hour}:00`,
      total: data.total,
      stt: data.byComponent?.stt || 0,
      llm: data.byComponent?.llm || 0,
      tts: data.byComponent?.tts || 0,
      sip: data.byComponent?.sip || 0,
      server: data.byComponent?.server || 0
    }))
  }, [hourlyData])

  const isLoading = hourlyLoading || componentLoading || typeLoading

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {format(selectedDate, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Hourly Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Hourly Error Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="stt" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="llm" stroke="#10b981" />
                  <Line type="monotone" dataKey="tts" stroke="#f59e0b" />
                  <Line type="monotone" dataKey="sip" stroke="#8b5cf6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Component Distribution */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Errors by Component</CardTitle>
              </CardHeader>
              <CardContent>
                {componentCounts?.componentCounts ? (
                  <div className="space-y-3">
                    {Object.entries(componentCounts.componentCounts).map(([component, count]: [string, any]) => (
                      <div key={component} className="flex items-center justify-between">
                        <Badge variant="outline" className="uppercase">{component}</Badge>
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No component data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Error Types</CardTitle>
              </CardHeader>
              <CardContent>
                {errorTypeCounts?.errorTypeCounts ? (
                  <div className="space-y-2">
                    {Object.entries(errorTypeCounts.errorTypeCounts)
                      .slice(0, 10)
                      .map(([type, count]: [string, any]) => (
                        <div key={type} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{type}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No error type data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default AnalyticsDashboard

