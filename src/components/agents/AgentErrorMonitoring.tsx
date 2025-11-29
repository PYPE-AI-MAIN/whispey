'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subHours } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircle, 
  Loader2,
  Phone,
  Mic,
  MessageSquare,
  Volume2,
  Server,
  Terminal
} from 'lucide-react'

interface AgentErrorMonitoringProps {
  agentId: string
  agentName: string
}

const AgentErrorMonitoring: React.FC<AgentErrorMonitoringProps> = ({ agentId, agentName }) => {
  // Fetch errors for this specific agent (last 24 hours)
  const { data: recentErrors, isLoading: errorsLoading } = useQuery({
    queryKey: ['agent-errors', agentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        projectId: 'all',
        hoursBack: '24',
        limit: '500'
      })

      params.append('agentIds', agentId)

      const response = await fetch(`/api/admin/all-errors?${params}`)
      if (!response.ok) throw new Error('Failed to fetch errors')
      const data = await response.json()
      return data
    },
    enabled: !!agentId,
    refetchInterval: 120000 // Refresh every 2 minutes
  })

  // Calculate aggregations
  const errorStats = useMemo(() => {
    if (!recentErrors?.errors || recentErrors.errors.length === 0) {
      return { 
        total: 0,
        sipErrors: 0,
        sttErrors: 0,
        llmErrors: 0,
        ttsErrors: 0,
        serverErrors: 0,
        bySipStatus: {},
        byHttpStatus: {},
        recentLogs: []
      }
    }

    let sipErrors = 0
    let sttErrors = 0
    let llmErrors = 0
    let ttsErrors = 0
    let serverErrors = 0
    const bySipStatus: Record<string, number> = {}
    const byHttpStatus: Record<string, number> = {}

    recentErrors.errors.forEach((error: any) => {
      const component = (error.Component || '').toLowerCase()
      if (component === 'sip') sipErrors++
      else if (component === 'stt') sttErrors++
      else if (component === 'llm') llmErrors++
      else if (component === 'tts') ttsErrors++
      else if (component === 'server') serverErrors++

      if (error.SipStatus) {
        const key = `SIP ${error.SipStatus}`
        bySipStatus[key] = (bySipStatus[key] || 0) + 1
      }

      if (error.HttpStatus) {
        const key = `HTTP ${error.HttpStatus}`
        byHttpStatus[key] = (byHttpStatus[key] || 0) + 1
      }
    })

    // Get recent logs (last 10)
    const recentLogs = recentErrors.errors.slice(0, 10).map((error: any) => ({
      timestamp: error.Timestamp,
      component: error.Component,
      errorType: error.ErrorType,
      message: error.ErrorMessage || error.Message,
      sipStatus: error.SipStatus,
      httpStatus: error.HttpStatus
    }))

    return {
      total: recentErrors.errors.length,
      sipErrors,
      sttErrors,
      llmErrors,
      ttsErrors,
      serverErrors,
      bySipStatus,
      byHttpStatus,
      recentLogs
    }
  }, [recentErrors])

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase()
    if (s.includes('408') || s.includes('500') || s.includes('503')) return 'text-red-600 dark:text-red-400'
    if (s.includes('480') || s.includes('404')) return 'text-orange-600 dark:text-orange-400'
    if (s.includes('400') || s.includes('401') || s.includes('403')) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm:ss')
    } catch {
      return timestamp
    }
  }

  if (errorsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading error data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">
              {errorStats.total}
            </div>
            <p className="text-xs text-gray-500 mt-1">Last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              SIP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{errorStats.sipErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mic className="h-3 w-3" />
              STT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{errorStats.sttErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              LLM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{errorStats.llmErrors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              TTS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{errorStats.ttsErrors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* SIP Status Codes */}
        {Object.keys(errorStats.bySipStatus).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SIP Status Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(errorStats.bySipStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${getStatusColor(status)}`}>{status}</span>
                      <Badge variant="outline" className="font-mono">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* HTTP Status Codes */}
        {Object.keys(errorStats.byHttpStatus).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">HTTP Status Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(errorStats.byHttpStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${getStatusColor(status)}`}>{status}</span>
                      <Badge variant="outline" className="font-mono">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Terminal Logs */}
      {errorStats.recentLogs.length > 0 && (
        <Card className="bg-gray-950 dark:bg-gray-950 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-100 flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Recent Error Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 font-mono text-xs max-h-[300px] overflow-y-auto">
              {errorStats.recentLogs.map((log: any, index: number) => (
                <div key={index} className="text-gray-300 hover:bg-gray-900 px-2 py-1 rounded">
                  <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>
                  {' '}
                  <span className="text-blue-400">{log.component}</span>
                  {' '}
                  <span className="text-red-400">{log.errorType}</span>
                  {log.sipStatus && <span className="text-orange-400"> SIP:{log.sipStatus}</span>}
                  {log.httpStatus && <span className="text-purple-400"> HTTP:{log.httpStatus}</span>}
                  {log.message && (
                    <>
                      {' - '}
                      <span className="text-gray-400">{log.message.substring(0, 80)}{log.message.length > 80 ? '...' : ''}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {errorStats.total === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No errors in the last 24 hours</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default AgentErrorMonitoring


