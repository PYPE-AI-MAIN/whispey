'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  CalendarDays, 
  Loader2,
  RefreshCw,
  AlertTriangle,
  Trash2
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'

interface SessionManagementProps {
  projectId: string
}

const SessionManagement: React.FC<SessionManagementProps> = ({ projectId }) => {
  const { isMobile } = useMobile(768)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  // Fetch top error sessions
  const { data: topSessions, isLoading, refetch } = useQuery({
    queryKey: ['top-sessions', projectId, dateStr, selectedAgents],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: 'all',
        date: dateStr,
        limit: '20'
      })
      if (selectedAgents.length > 0) {
        params.append('agentIds', selectedAgents.join(','))
      }

      const response = await fetch(`/api/admin/top-sessions?${params}`)
      if (!response.ok) throw new Error('Failed to fetch top sessions')
      return response.json()
    },
    enabled: true
  })

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Delete all errors for session ${sessionId.substring(0, 8)}...?`)) return

    try {
      const response = await fetch(`/api/admin/delete-session`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) throw new Error('Failed to delete session')
      refetch()
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    }
  }

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
            onClick={() => refetch()}
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
        <Card>
          <CardHeader>
            <CardTitle>Top Error Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {topSessions?.topSessions && topSessions.topSessions.length > 0 ? (
              <div className="space-y-3">
                {topSessions.topSessions.map((session: any, index: number) => (
                  <div
                    key={session.sessionId}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            {session.sessionId.substring(0, 16)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>Errors: <strong className="text-red-600">{session.errorCount}</strong></span>
                          <span>Components: {session.components?.length || 0}</span>
                          <span>Types: {session.errorTypes?.length || 0}</span>
                        </div>
                        {session.components && session.components.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {session.components.map((comp: string) => (
                              <Badge key={comp} variant="secondary" className="text-xs">{comp}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(session.sessionId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No error sessions found</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SessionManagement

