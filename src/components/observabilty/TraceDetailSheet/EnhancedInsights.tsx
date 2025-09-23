import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Copy } from 'lucide-react'
import React from 'react'

function EnhancedInsights({
  trace,
  isVapiAgent,
  pipelineStages,
  setCopiedField,
  copiedField
}: {
  trace: any
  isVapiAgent: boolean
  pipelineStages: any
  setCopiedField: (field: string | null) => void
  copiedField: string | null
}) {

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }


  // Calculate actual pipeline duration from stage metrics
  const calculatePipelineDuration = () => {
    let totalMs = 0
  
    // For Vapi: include STT in pipeline duration
    // For other platforms: exclude STT (it's parallel/preprocessing)
    if (isVapiAgent && trace.stt_metrics?.duration) {
      totalMs += trace.stt_metrics.duration * 1000 // Convert seconds to ms
    }
  
    // LLM TTFT (always include for all platforms)
    if (trace.llm_metrics?.ttft) {
      totalMs += trace.llm_metrics.ttft * 1000 // Convert seconds to ms
    }
  
    // TTS TTFB (always include for all platforms)
    if (trace.tts_metrics?.ttfb) {
      totalMs += trace.tts_metrics.ttfb * 1000 // Convert seconds to ms
    }
  
    // EOU metrics (always include for all platforms)
    if (trace.eou_metrics?.end_of_utterance_delay) {
      totalMs += trace.eou_metrics.end_of_utterance_delay * 1000
    }
  
    return totalMs
  }

  const actualPipelineDuration = calculatePipelineDuration()

  return (
    <div className="space-y-6">
      {/* Cost Breakdown */}
      {trace.trace_cost_usd && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Cost Breakdown</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-900 dark:text-gray-100">Total Trace Cost:</span>
              <span className="font-mono text-lg text-green-600 dark:text-green-400">
                {formatCost(Number.parseFloat(trace.trace_cost_usd))}
              </span>
            </div>
            {trace.otel_spans &&
              trace.otel_spans.map((span: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded text-sm border border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">{span.operation}:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    ~{formatCost(Number.parseFloat(trace.trace_cost_usd) / trace.otel_spans.length)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Enhanced Latency Analysis */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Latency Analysis</h4>
          <Badge variant="outline" className={cn(
            "text-xs",
            isVapiAgent ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700" : "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700"
          )}>
            {isVapiAgent ? "Vapi Pipeline" : "LiveKit Pipeline"}
          </Badge>
        </div>
        
        {/* Platform-specific explanation */}
        <div className={cn(
          "text-xs rounded-md px-3 py-2 mb-4",
          isVapiAgent 
            ? "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/20 border border-blue-200 dark:border-blue-700" 
            : "text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-800/20 border border-orange-200 dark:border-orange-700"
        )}>
          {isVapiAgent 
            ? "Vapi: STT processing is sequential and included in total pipeline duration"
            : "LiveKit: STT processing runs in parallel with audio streaming, excluded from pipeline duration"}
        </div>
        
        <div className="space-y-2">
          {pipelineStages
            .filter((s: any) => s.metrics)
            .map((stage: any) => {
              // Determine if this stage is included in pipeline calculation
              const isIncludedInPipeline = 
                stage.id === "stt" ? isVapiAgent : // STT only included for Vapi
                true; // All other stages (LLM, TTS, EOU) always included
              
              return (
                <div key={stage.id} className={cn(
                  "flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border",
                  isIncludedInPipeline ? "border-blue-200 dark:border-blue-700" : "border-gray-200 dark:border-gray-600 opacity-60"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded bg-${stage.color}-100 dark:bg-${stage.color}-800/50 flex items-center justify-center`}>
                      {stage.icon}
                    </div>
                    <span className="font-medium capitalize text-gray-900 dark:text-gray-100">
                      {stage.name}
                    </span>
                    
                    {/* Subtle inclusion indicator */}
                    {stage.id === "stt" && !isVapiAgent && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        isVapiAgent 
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-800" 
                          : "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-800"
                      )}>
                        {isVapiAgent ? "" : "parallel"}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <span className={cn(
                      "font-mono text-sm",
                      isIncludedInPipeline ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
                    )}>
                      {stage.id === "stt" && stage.metrics?.duration && formatDuration(stage.metrics.duration * 1000)}
                      {stage.id === "llm" && stage.metrics?.ttft && formatDuration(stage.metrics.ttft * 1000)}
                      {stage.id === "tts" && stage.metrics?.ttfb && formatDuration(stage.metrics.ttfb * 1000)}
                      {stage.id === "eou" && stage.metrics?.end_of_utterance_delay && formatDuration(stage.metrics.end_of_utterance_delay * 1000)}
                    </span>
                  </div>
                </div>
              )
            })}
          
          {/* Simple total with formula */}
          <div className="p-3 bg-white dark:bg-gray-800 rounded border-2 border-blue-200 dark:border-blue-700 font-medium mt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-900 dark:text-gray-100">Total Pipeline Duration:</span>
              <span className="font-mono text-lg text-blue-600 dark:text-blue-400">{formatDuration(actualPipelineDuration)}</span>
            </div>
            
            {/* Show the calculation formula */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
              {[
                isVapiAgent && trace.stt_metrics?.duration && "STT",
                trace.eou_metrics?.end_of_utterance_delay && "EOU", 
                trace.llm_metrics?.ttft && "LLM",
                trace.tts_metrics?.ttfb && "TTS"
              ].filter(Boolean).join(" + ")}
              {!isVapiAgent && trace.stt_metrics?.duration && (
                <span className="text-gray-400 dark:text-gray-500 ml-2">(STT excluded - parallel)</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Session Information */}
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Session Information</h4>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
            <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{trace.session_id.slice(0, 16)}...</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.session_id, "session_id")}>
                {copiedField === "session_id" ? "✓" : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
            <span className="text-gray-600 dark:text-gray-400">Trace ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{trace.trace_id?.slice(0, 16)}...</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.trace_id, "trace_id")}>
                {copiedField === "trace_id" ? "✓" : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
            <span className="text-gray-600 dark:text-gray-400">Turn ID:</span>
            <code className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{trace.turn_id}</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedInsights