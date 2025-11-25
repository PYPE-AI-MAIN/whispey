'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Activity } from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'

interface ErrorAggregationProps {
  aggregation: {
    byType: Record<string, number>
    byComponent: Record<string, number>
    bySipStatus: Record<string, number>
    byHttpStatus: Record<string, number>
    total: number
  }
  isLoading: boolean
}

const ErrorAggregation: React.FC<ErrorAggregationProps> = ({
  aggregation,
  isLoading
}) => {
  const { isMobile } = useMobile(768)

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Sort entries by count (descending)
  const sortedByType = Object.entries(aggregation.byType).sort((a, b) => b[1] - a[1])
  const sortedBySipStatus = Object.entries(aggregation.bySipStatus).sort((a, b) => b[1] - a[1])
  const sortedByHttpStatus = Object.entries(aggregation.byHttpStatus).sort((a, b) => b[1] - a[1])
  const sortedByComponent = Object.entries(aggregation.byComponent).sort((a, b) => b[1] - a[1])

  const getStatusColor = (status: string) => {
    if (status.includes('408') || status.includes('500') || status.includes('503')) {
      return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
    }
    if (status.includes('480') || status.includes('404')) {
      return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700'
    }
    if (status.includes('400') || status.includes('401') || status.includes('403')) {
      return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
    }
    return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'
  }

  // Calculate SIP connection errors specifically
  const sipConnectionErrors = sortedBySipStatus.filter(([status]) => 
    status.includes('408') || status.includes('480') || status.includes('503') || status.includes('500')
  ).reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="space-y-6 mb-6">
      {/* SIP Connection Errors - Prominent Display */}
      {sipConnectionErrors > 0 && (
        <Card className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5" />
              SIP Connection Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-700 dark:text-red-300 mb-2">{sipConnectionErrors}</div>
            <div className="text-sm text-red-600 dark:text-red-400">Total connection failures</div>
          </CardContent>
        </Card>
      )}

      {/* SIP Status Codes */}
      {sortedBySipStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SIP Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {sortedBySipStatus.map(([status, count]) => (
                <div
                  key={status}
                  className={`p-4 rounded-lg border-2 ${getStatusColor(status)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{status}</span>
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs mt-1 opacity-75">occurrences</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HTTP Status Codes */}
      {sortedByHttpStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">HTTP Status Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {sortedByHttpStatus.map(([status, count]) => (
                <div
                  key={status}
                  className={`p-4 rounded-lg border-2 ${getStatusColor(status)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{status}</span>
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs mt-1 opacity-75">occurrences</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Types - Displayed like SIP/HTTP status cards */}
      {sortedByType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Errors by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {sortedByType.map(([type, count]) => {
                const [component, errorType] = type.split(':')
                const percentage = aggregation.total > 0 ? ((count / aggregation.total) * 100).toFixed(1) : '0'
                const isConnectionError = errorType?.toLowerCase().includes('connection') || 
                                         errorType?.toLowerCase().includes('timeout') ||
                                         errorType?.toLowerCase().includes('failed')
                
                return (
                  <div
                    key={type}
                    className={`p-4 rounded-lg border-2 ${
                      isConnectionError
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                        : getStatusColor(`HTTP ${errorType}`)
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs">{component}</Badge>
                        <span className="font-semibold text-sm truncate">{errorType}</span>
                      </div>
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs mt-1 opacity-75">{percentage}% of total</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Components - Displayed like status cards */}
      {sortedByComponent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Errors by Component</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {sortedByComponent.map(([component, count]) => {
                const percentage = aggregation.total > 0 ? ((count / aggregation.total) * 100).toFixed(1) : '0'
                return (
                  <div
                    key={component}
                    className="p-4 rounded-lg border-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm uppercase">{component}</span>
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs mt-1 opacity-75">{percentage}% of total</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ErrorAggregation

