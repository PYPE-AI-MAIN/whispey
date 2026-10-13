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

  const copyToClipboard = async (text: string | null | undefined, field: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
      } catch {
        // clipboard completely unavailable
      }
    }
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
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4 text-foreground">Cost Breakdown</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-card rounded border border-border">
              <span className="font-medium text-foreground">Total Trace Cost:</span>
              <span className="font-mono text-lg text-foreground">
                {formatCost(Number.parseFloat(trace.trace_cost_usd))}
              </span>
            </div>
            {trace.otel_spans &&
              trace.otel_spans.map((span: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-card rounded text-sm border border-border">
                  <span className="text-muted-foreground">{span.operation}:</span>
                  <span className="font-mono text-foreground">
                    ~{formatCost(Number.parseFloat(trace.trace_cost_usd) / trace.otel_spans.length)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Enhanced Latency Analysis */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-foreground">Latency Analysis</h4>
          <Badge variant="outline" className="text-xs">
            {isVapiAgent ? "Vapi Pipeline" : "LiveKit Pipeline"}
          </Badge>
        </div>

        {/* Platform-specific explanation — informational, not a warning */}
        <div className="text-xs rounded-md px-3 py-2 mb-4 text-muted-foreground bg-muted border border-border">
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
                  "flex justify-between items-center p-3 bg-card rounded border border-border",
                  !isIncludedInPipeline && "opacity-60"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-muted flex items-center justify-center text-muted-foreground">
                      {stage.icon}
                    </div>
                    <span className="font-medium capitalize text-foreground">
                      {stage.name}
                    </span>

                    {/* Subtle inclusion indicator */}
                    {stage.id === "stt" && !isVapiAgent && (
                      <span className="text-xs px-2 py-1 rounded-full text-muted-foreground bg-muted">
                        parallel
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className={cn(
                      "font-mono text-sm",
                      isIncludedInPipeline ? "text-foreground" : "text-muted-foreground"
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
          <div className="p-3 bg-card rounded border-2 border-blue-200 dark:border-blue-700 font-medium mt-4">
            <div className="flex justify-between items-center">
              <span className="text-foreground">Total Pipeline Duration:</span>
              <span className="font-mono text-lg text-blue-600 dark:text-blue-400">{formatDuration(actualPipelineDuration)}</span>
            </div>
            
            {/* Show the calculation formula */}
            <div className="text-xs text-muted-foreground mt-2 font-mono">
              {[
                isVapiAgent && trace.stt_metrics?.duration && "STT",
                trace.eou_metrics?.end_of_utterance_delay && "EOU", 
                trace.llm_metrics?.ttft && "LLM",
                trace.tts_metrics?.ttfb && "TTS"
              ].filter(Boolean).join(" + ")}
              {!isVapiAgent && trace.stt_metrics?.duration && (
                <span className="text-muted-foreground ml-2">(STT excluded - parallel)</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Session Information */}
      <div className="rounded-xl border border-border bg-muted/50 shadow-sm p-4">
        <h4 className="text-lg font-semibold mb-4 text-foreground">Session Information</h4>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
            <span className="text-muted-foreground">Session ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">{trace.session_id.slice(0, 16)}...</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.session_id, "session_id")}>
                {copiedField === "session_id" ? "✓" : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
            <span className="text-muted-foreground">Trace ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">{trace.trace_id?.slice(0, 16)}...</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.trace_id, "trace_id")}>
                {copiedField === "trace_id" ? "✓" : <Copy className="w-3 h-3" />}
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
            <span className="text-muted-foreground">Turn ID:</span>
            <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">{trace.turn_id}</code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EnhancedInsights