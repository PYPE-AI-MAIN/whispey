'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  AlertCircle, 
  Filter,
  X,
  Clock,
  User,
  MessageSquare
} from 'lucide-react'
import { format } from 'date-fns'
import { useMobile } from '@/hooks/use-mobile'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ErrorLogsDisplayProps {
  errors: any[]
  isLoading: boolean
  componentFilter: string | null
  onComponentFilterChange: (component: string | null) => void
  selectedAgents: string[]
  agents: Array<{ id: string; name: string }>
}

const ErrorLogsDisplay: React.FC<ErrorLogsDisplayProps> = ({
  errors = [],
  isLoading,
  componentFilter,
  onComponentFilterChange,
  selectedAgents,
  agents
}) => {
  const { isMobile } = useMobile(768)

  const agentMap = useMemo(() => {
    return agents.reduce((acc, agent) => {
      acc[agent.id] = agent.name
      return acc
    }, {} as Record<string, string>)
  }, [agents])

  const availableComponents = useMemo(() => {
    const components = new Set<string>()
    errors.forEach(error => {
      if (error.Component) components.add(error.Component)
    })
    return Array.from(components).sort()
  }, [errors])

  const filteredErrors = useMemo(() => {
    if (!componentFilter) return errors
    return errors.filter(error => error.Component === componentFilter)
  }, [errors, componentFilter])

  const getErrorTypeColor = (errorType: string) => {
    if (errorType?.includes('400')) return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    if (errorType?.includes('408')) return 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
    if (errorType?.includes('480')) return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
    if (errorType?.includes('500')) return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return format(date, 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return timestamp
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Error Logs & Customer Calls</CardTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {componentFilter || 'All Components'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onComponentFilterChange(null)}>
                  All Components
                </DropdownMenuItem>
                {availableComponents.map(component => (
                  <DropdownMenuItem
                    key={component}
                    onClick={() => onComponentFilterChange(component)}
                  >
                    {component}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {componentFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onComponentFilterChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredErrors.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Errors Found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {componentFilter 
                ? `No errors found for component "${componentFilter}"`
                : 'No errors found for the selected agents and time range'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[700px] overflow-y-auto">
            {filteredErrors.map((error, index) => {
              const isConnectionError = (error.ErrorType || error.errorType || '').toLowerCase().includes('connection') ||
                                      (error.ErrorType || error.errorType || '').toLowerCase().includes('timeout')
              
              return (
                <div
                  key={index}
                  className={`p-5 rounded-lg border-2 transition-all ${
                    isConnectionError
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        className={`${getErrorTypeColor(error.ErrorType || error.errorType || '')} font-semibold`}
                      >
                        {error.ErrorType || error.errorType || 'Unknown'}
                      </Badge>
                      {error.Component && (
                        <Badge variant="outline" className="text-xs font-medium uppercase">
                          {error.Component}
                        </Badge>
                      )}
                      {error.SipStatus && (
                        <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                          SIP {error.SipStatus}
                        </Badge>
                      )}
                      {error.HttpStatus && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                          HTTP {error.HttpStatus}
                        </Badge>
                      )}
                    </div>
                    {error.Timestamp && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(error.Timestamp)}
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {(error.ErrorMessage || error.Message) && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {error.ErrorMessage || error.Message}
                      </p>
                    </div>
                  )}

                  {/* Provider Error Details */}
                  {(error.ProviderErrorMessage || error.Details) && (
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-words">
                        {error.ProviderErrorMessage || (typeof error.Details === 'string' 
                          ? error.Details 
                          : JSON.stringify(error.Details, null, 2))}
                      </p>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    {error.AgentId && agentMap[error.AgentId] && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium">{agentMap[error.AgentId]}</span>
                      </div>
                    )}
                    {error.CustomerNumber && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium">Customer: {error.CustomerNumber}</span>
                      </div>
                    )}
                    {error.SessionId && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span className="font-mono">Session: {error.SessionId.substring(0, 12)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ErrorLogsDisplay

