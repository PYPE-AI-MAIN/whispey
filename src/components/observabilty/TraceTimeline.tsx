// src/components/observability/TraceTimeline.tsx
"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Brain, Mic, Volume2, Clock, Activity, Wrench, Zap, Phone, MessageSquare } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

interface TraceTimelineProps {
  trace: any
  spans?: any[]
  totalDuration?: number
}

const TraceTimeline: React.FC<TraceTimelineProps> = ({ trace, spans, totalDuration }) => {
  // Process both spans and metrics for comprehensive timeline
  const timelineData = useMemo(() => {
    const items: any[] = []
    
    // Add spans if available
    if (spans?.length) {
      spans.forEach((span, index) => {
        items.push({
          type: 'span',
          operation: span.operation,
          duration: span.duration_ms || 0,
          startTime: span.start_time || 0,
          status: span.status || 'success',
          metadata: span.metadata || {},
          span_id: span.span_id,
          index
        })
      })
    }
    
    // Add metrics as timeline items if no spans
    if (!spans?.length && trace) {
      let currentTime = 0
      
      if (trace.stt_metrics && Object.keys(trace.stt_metrics).length > 0) {
        const duration = (trace.stt_metrics.duration || 0) * 1000 // Convert to ms
        items.push({
          type: 'metric',
          operation: 'stt_processing',
          duration,
          startTime: currentTime,
          status: 'success',
          metadata: trace.stt_metrics,
          label: 'Speech-to-Text'
        })
        currentTime += duration
      }
      
      if (trace.llm_metrics && Object.keys(trace.llm_metrics).length > 0) {
        const duration = (trace.llm_metrics.ttft || trace.llm_metrics.total_time || 1) * 1000
        items.push({
          type: 'metric',
          operation: 'llm_processing',
          duration,
          startTime: currentTime,
          status: 'success',
          metadata: trace.llm_metrics,
          label: 'Language Model'
        })
        currentTime += duration
      }
      
      if (trace.tool_calls?.length) {
        trace.tool_calls.forEach((tool: any, index: number) => {
          const duration = tool.execution_duration_ms || 100
          items.push({
            type: 'tool',
            operation: `tool_${tool.name}`,
            duration,
            startTime: currentTime,
            status: tool.status || (tool.success !== false ? 'success' : 'error'),
            metadata: tool,
            label: `Tool: ${tool.name}`,
            toolIndex: index
          })
          currentTime += duration
        })
      }
      
      if (trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0) {
        const duration = (trace.tts_metrics.ttfb || trace.tts_metrics.audio_duration || 1) * 1000
        items.push({
          type: 'metric',
          operation: 'tts_processing',
          duration,
          startTime: currentTime,
          status: 'success',
          metadata: trace.tts_metrics,
          label: 'Text-to-Speech'
        })
        currentTime += duration
      }
    }

    // Sort by start time
    items.sort((a, b) => a.startTime - b.startTime)
    
    // Calculate relative positioning
    if (items.length > 0) {
      const minStartTime = Math.min(...items.map(item => item.startTime))
      items.forEach(item => {
        item.relativeStartTime = item.startTime - minStartTime
      })
    }

    const maxDuration = totalDuration || 
      trace?.trace_duration_ms || 
      Math.max(...items.map(item => (item.relativeStartTime || 0) + item.duration), 1000)

    return { processedItems: items, maxDuration }
  }, [trace, spans, totalDuration])

  const getOperationIcon = (operation: string, type: string) => {
    if (type === 'tool') return <Wrench className="w-3 h-3" />
    if (operation.includes('stt')) return <Mic className="w-3 h-3" />
    if (operation.includes('llm')) return <Brain className="w-3 h-3" />
    if (operation.includes('tts')) return <Volume2 className="w-3 h-3" />
    if (operation.includes('eou')) return <Clock className="w-3 h-3" />
    if (operation.includes('call')) return <Phone className="w-3 h-3" />
    return <Activity className="w-3 h-3" />
  }

  const getOperationColor = (operation: string, status?: string, type?: string) => {
    if (status === 'error') return 'bg-red-500'
    if (status === 'warning') return 'bg-amber-500'
    
    if (type === 'tool') return 'bg-orange-500'
    if (operation.includes('stt')) return 'bg-blue-500'
    if (operation.includes('llm')) return 'bg-purple-500'
    if (operation.includes('tts')) return 'bg-green-500'
    if (operation.includes('eou')) return 'bg-amber-500'
    if (operation.includes('call')) return 'bg-indigo-500'
    return 'bg-gray-500'
  }

  const getOperationLightColor = (operation: string, status?: string, type?: string) => {
    if (status === 'error') return 'bg-red-100 border-red-200'
    if (status === 'warning') return 'bg-amber-100 border-amber-200'
    
    if (type === 'tool') return 'bg-orange-100 border-orange-200'
    if (operation.includes('stt')) return 'bg-blue-100 border-blue-200'
    if (operation.includes('llm')) return 'bg-purple-100 border-purple-200'
    if (operation.includes('tts')) return 'bg-green-100 border-green-200'
    if (operation.includes('eou')) return 'bg-amber-100 border-amber-200'
    if (operation.includes('call')) return 'bg-indigo-100 border-indigo-200'
    return 'bg-gray-100 border-gray-200'
  }

  const getOperationTextColor = (operation: string, status?: string, type?: string) => {
    if (status === 'error') return 'text-red-700'
    if (status === 'warning') return 'text-amber-700'
    
    if (type === 'tool') return 'text-orange-700'
    if (operation.includes('stt')) return 'text-blue-700'
    if (operation.includes('llm')) return 'text-purple-700'
    if (operation.includes('tts')) return 'text-green-700'
    if (operation.includes('eou')) return 'text-amber-700'
    if (operation.includes('call')) return 'text-indigo-700'
    return 'text-gray-700'
  }

  const getOperationDisplayName = (item: any) => {
    if (item.label) return item.label
    if (item.type === 'tool') return `Tool: ${item.metadata.name || 'Unknown'}`
    if (item.operation.includes('stt')) return 'Speech-to-Text'
    if (item.operation.includes('llm')) return 'Language Model'
    if (item.operation.includes('tts')) return 'Text-to-Speech'
    if (item.operation.includes('eou')) return 'End of Utterance'
    if (item.operation.includes('call')) return 'Phone Call'
    return item.operation.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(3)}s`
  }

  const formatPercentage = (duration: number, total: number) => {
    return `${((duration / total) * 100).toFixed(1)}%`
  }

  const getConversationSummary = () => {
    const hasInput = !!trace?.user_transcript
    const hasOutput = !!trace?.agent_response
    const inputLength = trace?.user_transcript?.length || 0
    const outputLength = trace?.agent_response?.length || 0
    
    return { hasInput, hasOutput, inputLength, outputLength }
  }

  if (!timelineData.processedItems.length && !trace) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 text-center border">
        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h4 className="text-lg font-semibold text-gray-600 mb-2">No Timeline Data</h4>
        <p className="text-sm text-muted-foreground">
          Trace timeline will appear here when execution data is available
        </p>
      </div>
    )
  }

  const { processedItems, maxDuration } = timelineData
  const conversationSummary = getConversationSummary()

  return (
    <TooltipProvider>
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        {/* Timeline Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Execution Timeline</h4>
              <p className="text-sm text-muted-foreground">
                {processedItems.length ? (
                  <>
                    {processedItems.length} operations • {formatDuration(maxDuration)} total
                  </>
                ) : (
                  <>
                    Turn #{trace?.turn_id} • {formatDuration(maxDuration)} duration
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {conversationSummary.hasInput && (
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                Input: {conversationSummary.inputLength} chars
              </Badge>
            )}
            {conversationSummary.hasOutput && (
              <Badge variant="outline" className="text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                Output: {conversationSummary.outputLength} chars
              </Badge>
            )}
          </div>
        </div>

        {/* Conversation Preview */}
        {(conversationSummary.hasInput || conversationSummary.hasOutput) && (
          <>
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
              <h5 className="text-sm font-semibold text-gray-900 mb-2">Conversation</h5>
              <div className="space-y-2">
                {conversationSummary.hasInput && (
                  <div className="text-sm">
                    <span className="font-medium text-blue-600">User:</span>
                    <span className="ml-2 text-gray-700">
                      {trace.user_transcript.length > 120 
                        ? trace.user_transcript.substring(0, 120) + "..." 
                        : trace.user_transcript}
                    </span>
                  </div>
                )}
                {conversationSummary.hasOutput && (
                  <div className="text-sm">
                    <span className="font-medium text-purple-600">Assistant:</span>
                    <span className="ml-2 text-gray-700">
                      {trace.agent_response.length > 120 
                        ? trace.agent_response.substring(0, 120) + "..." 
                        : trace.agent_response}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Timeline Scale */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>0ms</span>
            <span>{formatDuration(maxDuration)}</span>
          </div>
          <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-full relative">
            <div className="absolute top-0 left-0 w-1 h-2 bg-green-500 rounded-l-full"></div>
            <div className="absolute top-0 right-0 w-1 h-2 bg-red-500 rounded-r-full"></div>
          </div>
        </div>

        {/* Timeline Items */}
        {processedItems.length > 0 ? (
          <div className="space-y-4">
            {processedItems.map((item, index) => {
              const widthPercentage = maxDuration > 0 ? (item.duration / maxDuration) * 100 : 0
              const leftPercentage = maxDuration > 0 ? ((item.relativeStartTime || 0) / maxDuration) * 100 : 0
              const displayName = getOperationDisplayName(item)

              return (
                <div key={index} className="relative">
                  <div className="flex items-center min-h-[3rem]">
                    {/* Operation Label */}
                    <div className="w-48 flex items-center gap-3 pr-4">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center border",
                        getOperationLightColor(item.operation, item.status, item.type)
                      )}>
                        <div className={getOperationTextColor(item.operation, item.status, item.type)}>
                          {getOperationIcon(item.operation, item.type)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "text-sm font-medium truncate",
                          getOperationTextColor(item.operation, item.status, item.type)
                        )}>
                          {displayName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(item.duration)}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Bar Container */}
                    <div className="flex-1 relative h-8 bg-gray-50 rounded-full border ml-4">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute h-8 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105 hover:shadow-md",
                              getOperationColor(item.operation, item.status, item.type),
                              widthPercentage < 10 ? "min-w-[4px]" : ""
                            )}
                            style={{
                              left: `${leftPercentage}%`,
                              width: `${Math.max(widthPercentage, 0.5)}%`
                            }}
                          >
                            {widthPercentage > 20 && (
                              <span className="text-xs font-medium text-white px-2 truncate">
                                {formatDuration(item.duration)}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <div className="space-y-2">
                            <div className="font-semibold">{displayName}</div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between gap-4">
                                <span>Duration:</span>
                                <span className="font-mono">{formatDuration(item.duration)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>% of Total:</span>
                                <span className="font-mono">{formatPercentage(item.duration, maxDuration)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>Status:</span>
                                <Badge variant={item.status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                                  {item.status}
                                </Badge>
                              </div>
                              {item.span_id && (
                                <div className="flex justify-between gap-4">
                                  <span>Span ID:</span>
                                  <code className="text-xs">{item.span_id}</code>
                                </div>
                              )}
                            </div>
                            {item.metadata && Object.keys(item.metadata).length > 0 && (
                              <div className="border-t pt-2 mt-2">
                                <div className="font-medium mb-1 text-xs">Metadata:</div>
                                <div className="text-xs space-y-1">
                                  {Object.entries(item.metadata).slice(0, 4).map(([key, value]: [string, any]) => (
                                    <div key={key} className="flex justify-between gap-2">
                                      <span className="text-muted-foreground capitalize">
                                        {key.replace(/_/g, ' ')}:
                                      </span>
                                      <span className="font-mono truncate max-w-24">
                                        {typeof value === 'number' ? 
                                          (key.includes('token') ? value : value.toFixed(2)) : 
                                          String(value).substring(0, 20)
                                        }
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Duration Label */}
                    <div className="w-20 text-right pl-4">
                      <div className="text-sm font-mono text-gray-900">
                        {formatDuration(item.duration)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPercentage(item.duration, maxDuration)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Fallback view when no detailed timeline items
          <div className="space-y-4">
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm text-gray-600">No detailed timeline available</div>
              <div className="text-xs text-gray-500 mt-1">
                Showing basic trace information
              </div>
            </div>
            
            {/* Basic trace info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {trace?.trace_duration_ms && (
                <div className="text-center p-3 bg-blue-50 rounded-lg border">
                  <div className="text-lg font-semibold text-blue-600">
                    {formatDuration(trace.trace_duration_ms)}
                  </div>
                  <div className="text-xs text-blue-600">Total Duration</div>
                </div>
              )}
              
              {trace?.tool_calls?.length > 0 && (
                <div className="text-center p-3 bg-orange-50 rounded-lg border">
                  <div className="text-lg font-semibold text-orange-600">
                    {trace.tool_calls.length}
                  </div>
                  <div className="text-xs text-orange-600">Tool Calls</div>
                </div>
              )}
              
              {trace?.trace_cost_usd && (
                <div className="text-center p-3 bg-purple-50 rounded-lg border">
                  <div className="text-lg font-semibold text-purple-600">
                    ${parseFloat(trace.trace_cost_usd).toFixed(4)}
                  </div>
                  <div className="text-xs text-purple-600">Cost</div>
                </div>
              )}
              
              {trace?.call_success !== undefined && (
                <div className="text-center p-3 bg-green-50 rounded-lg border">
                  <div className={cn(
                    "text-lg font-semibold",
                    trace.call_success ? "text-green-600" : "text-red-600"
                  )}>
                    {trace.call_success ? "✓" : "✗"}
                  </div>
                  <div className={cn(
                    "text-xs",
                    trace.call_success ? "text-green-600" : "text-red-600"
                  )}>
                    Call Status
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline Summary */}
        <div className="mt-6 pt-6 border-t bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="font-medium text-gray-900">
                  {processedItems.length || 'Basic'}
                </span>
                <span className="text-muted-foreground ml-1">
                  {processedItems.length ? 'operations' : 'trace info'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-900">{formatDuration(maxDuration)}</span>
                <span className="text-muted-foreground ml-1">total duration</span>
              </div>
              {trace?.session_id && (
                <div>
                  <span className="font-medium text-gray-900">
                    {trace.session_id.slice(-8)}
                  </span>
                  <span className="text-muted-foreground ml-1">session</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Legend */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-4">
            {['stt', 'llm', 'tool', 'tts', 'eou'].map(operation => {
              const hasOperation = processedItems.some(item => 
                item.operation.includes(operation) || item.type === operation
              )
              if (!hasOperation && processedItems.length > 0) return null

              const displayName = operation === 'tool' ? 'Tools' : 
                                operation === 'stt' ? 'STT' :
                                operation === 'llm' ? 'LLM' :
                                operation === 'tts' ? 'TTS' :
                                operation === 'eou' ? 'EOU' : operation.toUpperCase()
              const count = processedItems.filter(item => 
                item.operation.includes(operation) || item.type === operation
              ).length

              return (
                <div key={operation} className="flex items-center gap-2">
                  <div className={cn("w-4 h-4 rounded", getOperationColor(operation, 'success', operation))}></div>
                  <span className="text-sm text-muted-foreground">
                    {displayName} {count > 1 && `(${count})`}
                  </span>
                </div>
              )
            })}
            
            {/* Always show basic legend items */}
            {processedItems.length === 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span className="text-sm text-muted-foreground">Processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <span className="text-sm text-muted-foreground">Error</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default TraceTimeline