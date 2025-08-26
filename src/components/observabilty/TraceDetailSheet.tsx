// src/components/observability/TraceDetailSheet.tsx
"use client"

import { X, Clock, Brain, Mic, Volume2, Activity, Copy, Wrench, CheckCircle, XCircle, ChevronDown, ChevronRight, Phone, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface TraceDetailSheetProps {
  isOpen: boolean
  trace: any
  onClose: () => void
}

const TraceDetailSheet: React.FC<TraceDetailSheetProps> = ({ isOpen, trace, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    toolCalls: true,
    spans: false,
    metrics: true,
    conversation: true
  })


  useEffect(() => {
    if (trace && isOpen) {
      console.log({trace})
    }
  }, [trace, isOpen])

  

  if (!isOpen || !trace) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(3)}s`
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(6)}`
  }

  const parseArguments = (args: any) => {
    if (typeof args === 'string') {
      try {
        return JSON.parse(args)
      } catch {
        return args
      }
    }
    return args || {}
  }

  const totalToolCalls = trace.tool_calls?.length || 0
  const successfulTools = trace.tool_calls?.filter((tool: any) => 
    tool.status === 'success' || tool.success !== false
  ).length || 0

  const getAllMetrics = () => {
    const metrics = []
    if (trace.stt_metrics && Object.keys(trace.stt_metrics).length > 0) {
      metrics.push({ type: 'Speech-to-Text', data: trace.stt_metrics, icon: <Mic className="w-4 h-4" />, color: 'text-blue-600' })
    }
    if (trace.llm_metrics && Object.keys(trace.llm_metrics).length > 0) {
      metrics.push({ type: 'Language Model', data: trace.llm_metrics, icon: <Brain className="w-4 h-4" />, color: 'text-purple-600' })
    }
    if (trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0) {
      metrics.push({ type: 'Text-to-Speech', data: trace.tts_metrics, icon: <Volume2 className="w-4 h-4" />, color: 'text-green-600' })
    }
    if (trace.eou_metrics && Object.keys(trace.eou_metrics).length > 0) {
      metrics.push({ type: 'End of Utterance', data: trace.eou_metrics, icon: <Clock className="w-4 h-4" />, color: 'text-amber-600' })
    }
    return metrics
  }

  const formatMetricValue = (key: string, value: any) => {
    if (key.includes('duration') || key.includes('delay') || key.includes('ttft') || key.includes('ttfb')) {
      return typeof value === 'number' ? formatDuration(value * 1000) : value
    }
    if (key.includes('tokens') || key.includes('characters')) {
      return typeof value === 'number' ? value.toLocaleString() : value
    }
    if (key.includes('timestamp')) {
      return typeof value === 'number' ? new Date(value * 1000).toLocaleString() : value
    }
    if (typeof value === 'number' && value < 1) {
      return value.toFixed(3)
    }
    return value
  }

  const getTraceStatus = () => {
    const spans = trace.otel_spans || []
    const toolErrors = trace.tool_calls?.some((tool: any) => tool.status === 'error' || tool.success === false)
    const callFailed = trace.call_success === false
    
    if (spans.some((span: any) => span.status === "error") || toolErrors || callFailed) return "error"
    if (spans.some((span: any) => span.status === "warning") || !trace.call_success) return "warning"
    return "success"
  }

  const status = getTraceStatus()
  const allMetrics = getAllMetrics()

  return (
    <TooltipProvider>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-[65%] bg-white border-l shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                status === 'error' ? 'bg-red-100 text-red-600' : 
                status === 'warning' ? 'bg-amber-100 text-amber-600' : 
                'bg-green-100 text-green-600'
              )}>
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">Turn #{trace.turn_id}</h2>
                  {trace.lesson_day && (
                    <Badge variant="outline" className="text-xs">Day {trace.lesson_day}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {trace.trace_id ? (
                    <code className="font-mono">{trace.trace_id.slice(0, 20)}...</code>
                  ) : (
                    <code className="font-mono">Session: {trace.session_id.slice(0, 16)}...</code>
                  )}
                  {trace.phone_number && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{trace.phone_number}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => copyToClipboard(trace.trace_id || trace.id, 'trace_id')}
              >
                {copiedField === 'trace_id' ? "✓" : <Copy className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-b bg-white px-4 py-2">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Duration:</span>
              <span className="font-semibold text-blue-600">
                {trace.trace_duration_ms ? formatDuration(trace.trace_duration_ms) : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Cost:</span>
              <span className="font-semibold text-purple-600">
                {trace.trace_cost_usd ? formatCost(parseFloat(trace.trace_cost_usd)) : "N/A"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Tools:</span>
              <span className="font-semibold text-orange-600">{totalToolCalls}</span>
              {totalToolCalls > 0 && (
                <span className="text-gray-400">
                  ({successfulTools} success)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Spans:</span>
              <span className="font-semibold text-green-600">{trace.otel_spans?.length || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Call Status:</span>
              <Badge variant={trace.call_success === false ? "destructive" : "secondary"} className="text-xs">
                {trace.call_success === false ? "Failed" : "Success"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Conversation */}
            {(trace.user_transcript || trace.agent_response) && (
              <div>
                <button 
                  onClick={() => setExpandedSections(prev => ({ ...prev, conversation: !prev.conversation }))}
                  className="flex items-center gap-2 w-full text-left py-1 hover:bg-gray-50 rounded px-1"
                >
                  {expandedSections.conversation ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm font-medium text-gray-900">Conversation</span>
                </button>
                
                {expandedSections.conversation && (
                  <div className="mt-3 space-y-3">
                    {trace.user_transcript && (
                      <div className="border-l-3 border-blue-500 pl-4 py-2 bg-blue-50/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">U</div>
                          <span className="text-xs font-medium text-blue-700">User</span>
                          <span className="text-xs text-gray-400">{new Date(trace.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{trace.user_transcript}</p>
                      </div>
                    )}

                    {trace.agent_response && (
                      <div className="border-l-3 border-gray-400 pl-4 py-2 bg-gray-50/30">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-gray-500 text-white text-[10px] flex items-center justify-center font-bold">A</div>
                          <span className="text-xs font-medium text-gray-700">Assistant</span>
                          <span className="text-xs text-gray-400">{new Date(trace.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{trace.agent_response}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Metrics */}
            {allMetrics.length > 0 && (
              <div>
                <button 
                  onClick={() => setExpandedSections(prev => ({ ...prev, metrics: !prev.metrics }))}
                  className="flex items-center gap-2 w-full text-left py-1 hover:bg-gray-50 rounded px-1"
                >
                  {expandedSections.metrics ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm font-medium text-gray-900">
                    Performance Metrics ({allMetrics.length})
                  </span>
                </button>
                
                {expandedSections.metrics && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allMetrics.map((metric, index) => (
                      <div key={index} className="border rounded-lg bg-white p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("w-5 h-5 rounded flex items-center justify-center bg-gray-100", metric.color)}>
                            {metric.icon}
                          </div>
                          <span className="text-sm font-medium">{metric.type}</span>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(metric.data).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span className="font-mono text-gray-900">
                                {formatMetricValue(key, value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Tool Calls */}
            {trace.tool_calls && trace.tool_calls.length > 0 && (
              <div>
                <button 
                  onClick={() => setExpandedSections(prev => ({ ...prev, toolCalls: !prev.toolCalls }))}
                  className="flex items-center gap-2 w-full text-left py-1 hover:bg-gray-50 rounded px-1"
                >
                  {expandedSections.toolCalls ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm font-medium text-gray-900">
                    Tool Executions ({totalToolCalls})
                  </span>
                  {successfulTools === totalToolCalls ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </button>
                
                {expandedSections.toolCalls && (
                  <div className="mt-3 space-y-3">
                    {trace.tool_calls.map((tool: any, index: number) => {
                      const isSuccess = tool.status === 'success' || tool.success !== false
                      const parsedArgs = parseArguments(tool.arguments || tool.raw_arguments)
                      
                      return (
                        <div key={index} className="border rounded-lg bg-white">
                          <div className="px-3 py-2 bg-gray-50/50 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-5 h-5 rounded flex items-center justify-center",
                                isSuccess ? "bg-green-100" : "bg-red-100"
                              )}>
                                {isSuccess ? 
                                  <CheckCircle className="w-3 h-3 text-green-600" /> : 
                                  <XCircle className="w-3 h-3 text-red-600" />
                                }
                              </div>
                              <span className="text-sm font-medium">{tool.name || tool.function_name}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                #{index + 1}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {tool.execution_duration_ms && (
                                <span>{formatDuration(tool.execution_duration_ms)}</span>
                              )}
                              <span>{tool.result_length || String(tool.result || '').length || 0} chars</span>
                            </div>
                          </div>

                          <div className="p-3 space-y-3">
                            {/* Arguments */}
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-1">Arguments</div>
                              <div className="bg-gray-50 rounded px-3 py-2 text-xs font-mono text-gray-800 overflow-x-auto">
                                <pre>{JSON.stringify(parsedArgs, null, 2)}</pre>
                              </div>
                            </div>

                            {/* Result */}
                            {tool.result && (
                              <div>
                                <div className="text-xs font-medium text-gray-600 mb-1">Result</div>
                                <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-gray-800 max-h-32 overflow-y-auto">
                                  {String(tool.result)}
                                </div>
                              </div>
                            )}

                            {/* Error */}
                            {tool.error && (
                              <div>
                                <div className="text-xs font-medium text-red-600 mb-1">Error</div>
                                <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800">
                                  {tool.error}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* OpenTelemetry Spans */}
            {trace.otel_spans && trace.otel_spans.length > 0 && (
              <div>
                <button 
                  onClick={() => setExpandedSections(prev => ({ ...prev, spans: !prev.spans }))}
                  className="flex items-center gap-2 w-full text-left py-1 hover:bg-gray-50 rounded px-1"
                >
                  {expandedSections.spans ? 
                    <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                  <span className="text-sm font-medium text-gray-900">
                    OpenTelemetry Spans ({trace.otel_spans.length})
                  </span>
                </button>
                
                {expandedSections.spans && (
                  <div className="mt-3 space-y-2">
                    {trace.otel_spans.map((span: any, index: number) => {
                      const getOperationIcon = (op: string) => {
                        if (op.includes('stt')) return <Mic className="w-3 h-3" />
                        if (op.includes('llm')) return <Brain className="w-3 h-3" />
                        if (op.includes('tts')) return <Volume2 className="w-3 h-3" />
                        if (op.includes('tool')) return <Wrench className="w-3 h-3" />
                        return <Activity className="w-3 h-3" />
                      }

                      return (
                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="text-blue-600">
                              {getOperationIcon(span.operation)}
                            </div>
                            <div>
                              <div className="text-sm font-medium capitalize">
                                {span.operation.replace(/_/g, ' ')}
                              </div>
                              {span.span_id && (
                                <div className="text-xs text-gray-500 font-mono">
                                  {span.span_id}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono">
                              {formatDuration(span.duration_ms || 0)}
                            </div>
                            <div className={cn(
                              "text-xs",
                              span.status === 'error' ? 'text-red-600' : 'text-green-600'
                            )}>
                              {span.status || 'success'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Session Info */}
            <div>
              <span className="text-sm font-medium text-gray-900 mb-2 block">Session Details</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Session ID:</span>
                  <code className="text-gray-800">{trace.session_id}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-800">{new Date(trace.created_at).toLocaleString()}</span>
                </div>
                {trace.unix_timestamp && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unix Time:</span>
                    <span className="text-gray-800">{trace.unix_timestamp}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default TraceDetailSheet
