// src/components/observability/EnhancedTraceDetailSheet.tsx
"use client"

import type React from "react"

import {
  X,
  Brain,
  Mic,
  Volume2,
  Activity,
  Copy,
  Wrench,
  ArrowDown,
  Zap,
  Settings,
  MessageSquare,
  AlertTriangle,
  User,
  Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"
import { getAgentPlatform } from "@/utils/agentDetection"
import NodeDetails from "./NodeDetails"
import EnhancedInsights from "./EnhancedInsights"
import NodeSelector from "./NodeSelector"
import BugReport from "./BugReport"
import AudioPlayer from "@/components/AudioPlayer"

interface TraceDetailSheetProps {
  isOpen: boolean
  trace: any
  recordingUrl?: string
  callStartTime?: string
  agent?: any
  onClose: () => void
}

const EnhancedTraceDetailSheet: React.FC<TraceDetailSheetProps> = ({ 
  isOpen, 
  trace, 
  recordingUrl,
  callStartTime,
  agent, 
  onClose 
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<string>("pipeline")
  const [selectedNode, setSelectedNode] = useState<string>("stt")

  const isVapiAgent = useMemo(() => {
    if (!agent) return false
    
    const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
    const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
    const isVapiType = agent.agent_type === 'vapi'
    
    return hasVapiKeys || hasVapiConfig || isVapiType
  }, [agent])

  // Calculate audio segment info for both STT and TTS
  const audioSegmentInfo = useMemo(() => {
    if (!recordingUrl || !trace) {
      return null
    }

    // Calculate proper segment timing - relative to first start time
    let segmentStartTime = 0
    
    // Calculate timing as: anytime - firststarttime
    // This means we need to find the first start time and calculate relative to it
    const turnId = parseInt(trace.turn_id) || 0
    
    if (callStartTime && trace.unix_timestamp) {
      try {
        // Calculate the actual time difference from call start
        const callStartMs = new Date(callStartTime).getTime()
        const turnMs = trace.unix_timestamp * 1000
        
        // Handle both seconds and milliseconds timestamps
        const actualTurnMs = turnMs > 1e12 ? turnMs : turnMs * 1000
        const offsetSeconds = (actualTurnMs - callStartMs) / 1000
        
        // This gives us the actual time from call start
        segmentStartTime = Math.max(0, offsetSeconds)
        
        const firstStartTime = 19820 // This should be the first turn's start time
        segmentStartTime = Math.max(0, segmentStartTime - firstStartTime)
        
        // Debug logging for timing calculations
        console.log('Audio segment timing calculation (anytime - firststarttime):', {
          callStartTime,
          turnTimestamp: trace.unix_timestamp,
          callStartMs,
          turnMs: actualTurnMs,
          offsetSeconds,
          firstStartTime,
          finalSegmentStartTime: segmentStartTime,
          turnId: trace.turn_id,
          calculation: `Turn ${turnId}: ${offsetSeconds}s - ${firstStartTime}s = ${segmentStartTime}s`
        })
      } catch (error) {
        console.warn('Failed to calculate segment timing:', error)
        // Fallback to turn-based offset
        segmentStartTime = (turnId - 1) * 2
      }
    } else {
      // Fallback to turn-based offset if no timing data available
      segmentStartTime = (turnId - 1) * 2
    }

    return {
      startTime: segmentStartTime,
      sttDuration: trace.stt_metrics?.audio_duration || 0,
      ttsDuration: trace.tts_metrics?.audio_duration || 0
    }
  }, [trace?.stt_metrics?.audio_duration, trace?.tts_metrics?.audio_duration, trace?.turn_id, recordingUrl, callStartTime, trace?.unix_timestamp])

  useEffect(() => {
    if (trace && isOpen) {
      console.log({
        // Base trace data
        trace_id: trace.trace_id,
        session_id: trace.session_id,
        turn_id: trace.turn_id,
        unix_timestamp: trace.unix_timestamp,
        user_transcript: trace.user_transcript,
        agent_response: trace.agent_response,
        
        // Metrics
        stt_metrics: trace.stt_metrics,
        llm_metrics: trace.llm_metrics,
        tts_metrics: trace.tts_metrics,
        
        // Configuration
        turn_configuration: trace.turn_configuration,
        
        // OTEL Spans
        otel_spans: trace.otel_spans,
        
        // Tool calls
        tool_calls: trace.tool_calls,
        
        // Enhanced data
        enhanced_data: trace.enhanced_data,
        
        // Bug report data
        bug_report: trace.bug_report,
        bug_report_data: trace.bug_report_data,
        
        // Cost data
        trace_cost_usd: trace.trace_cost_usd,
        
        // All other available properties
        ...trace
      })
      // Set first active stage as default selected node
      if (pipelineStages.length > 0) {
        const firstActiveStage = pipelineStages.find((stage) => stage.active)
        if (firstActiveStage) {
          setSelectedNode(firstActiveStage.id)
        }
      }
    }
  }, [trace, isOpen])

  // Reset view when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSelectedView("pipeline")
    }
  }, [isOpen])

  // Early return if no trace
  if (!trace) return null

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Extract configuration data
  const sttConfig = trace.turn_configuration?.stt_configuration?.structured_config
  const llmConfig = trace.turn_configuration?.llm_configuration?.structured_config
  const ttsConfig = trace.turn_configuration?.tts_configuration?.structured_config
  const vadConfig = trace.turn_configuration?.vad_configuration?.structured_config
  const eouConfig = trace.turn_configuration?.eou_configuration?.structured_config

  // Extract enhanced data
  const enhancedSTT = trace.enhanced_data?.enhanced_stt_data
  const enhancedLLM = trace.enhanced_data?.enhanced_llm_data
  const enhancedTTS = trace.enhanced_data?.enhanced_tts_data
  const stateEvents = trace.enhanced_data?.state_events || []
  const llmRequests = trace.enhanced_data?.llm_requests || []

  // Pipeline stages with comprehensive data
  const pipelineStages = [
    {
      id: "vad",
      name: "VAD",
      icon: <Activity className="w-3 h-3" />,
      color: "orange",
      active: !!vadConfig && Object.keys(vadConfig).length > 0 && !!trace.user_transcript && trace.user_transcript.trim() !== "",
      config: vadConfig,
      metrics: null,
      inputType: "Audio Stream",
      outputType: "Speech Events",
      status: vadConfig && Object.keys(vadConfig).length > 0 && trace.user_transcript ? "active" : "inactive",
    },
    {
      id: "eou",
      name: "EOU",
      icon: <Activity className="w-3 h-3" />,
      color: "orange",
      active: !!trace.eou_metrics && Object.keys(trace.eou_metrics).length > 0,
      config: eouConfig,
      metrics: trace.eou_metrics,
      inputType: "Audio Stream",
      outputType: "Speech Events",
      status: trace.eou_metrics && Object.keys(trace.eou_metrics).length > 0 ? "success" : "inactive",
    },
    {
      id: "stt",
      name: "STT",
      icon: <Mic className="w-3 h-3" />,
      color: "blue",
      active: !!trace.user_transcript && trace.user_transcript.trim() !== "",
      config: sttConfig,
      metrics: trace.stt_metrics,
      enhanced: enhancedSTT,
      inputType: "Audio",
      outputType: "Text",
      inputData: `${trace.stt_metrics?.audio_duration?.toFixed(1) || 0}s audio`,
      outputData: trace.user_transcript,
      status: trace.user_transcript && trace.user_transcript.trim() !== "" ? "success" : "missing",
    },
    {
      id: "llm",
      name: "LLM",
      icon: <Brain className="w-3 h-3" />,
      color: "purple",
      active: !!trace.agent_response && trace.agent_response.trim() !== "",
      config: llmConfig,
      metrics: trace.llm_metrics,
      enhanced: enhancedLLM,
      tools: trace.tool_calls || [],
      llmRequests: llmRequests,
      inputType: "Text",
      outputType: "Text",
      inputData: trace.user_transcript,
      outputData: trace.agent_response,
      status: trace.agent_response && trace.agent_response.trim() !== "" ? "success" : "missing",
    },
    {
      id: "tts",
      name: "TTS",
      icon: <Volume2 className="w-3 h-3" />,
      color: "green",
      active: !!trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0,
      config: ttsConfig,
      metrics: trace.tts_metrics,
      enhanced: enhancedTTS,
      inputType: "Text",
      outputType: "Audio",
      inputData: trace.agent_response,
      outputData: `${trace.tts_metrics?.audio_duration?.toFixed(1) || 0}s audio`,
      status: trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0 ? "success" : "missing",
    }
  ].filter(stage => stage.active) 

  const viewTabs = [
    { id: "pipeline", name: "Pipeline Flow", icon: <Zap className="w-4 h-4" /> },
    { id: "config", name: "Config", icon: <Settings className="w-4 h-4" /> },
    { id: "insights", name: "Cost & Metrics", icon: <MessageSquare className="w-4 h-4" /> },
    {
      id: "bug-report",
      name: "Bug Report",
      show:
        trace.bug_report ||
        trace.bug_report_data?.bug_flagged_turns?.some((turn: any) => turn.turn_id === trace.turn_id),
    },
  ]

  return (
    <TooltipProvider>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="min-w-6xl p-0 flex flex-col max-w-none"
          onInteractOutside={() => {
            setSelectedView("pipeline") // Reset view when closing
          }}
        >
          {/* Header */}
          <SheetHeader className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold text-left">
                  Turn Analysis: {trace.turn_id}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {trace.user_transcript && trace.agent_response
                    ? "Complete conversation turn with full pipeline data"
                    : "Partial conversation turn"}
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 absolute top-4 right-6">
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.trace_id || trace.id, "trace_id")}>
                {copiedField === "trace_id" ? "✓" : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </SheetHeader>

          {/* View Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-800">
            <div className="px-6">
              <nav className="flex space-x-4">
                {viewTabs
                  .filter((tab) => tab.show !== false)
                  .map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedView(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                        selectedView === tab.id
                          ? tab.id === "bug-report"
                            ? "border-red-500 dark:border-red-400 text-red-600 dark:text-red-400"
                            : "border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400" 
                          : "border-transparent hover:text-gray-700 dark:hover:text-gray-300", 
                        tab.id === "bug-report" ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" : "text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {tab.icon}
                      {tab.name}
                    </button>
                  ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {selectedView === "pipeline" && (
              <div className="flex h-full">
                {/* Left Panel - Node Selector */}
                <div className="w-80 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-4 flex-shrink-0">
                  <h3 className="font-medium text-sm mb-4 text-gray-700 dark:text-gray-300">Pipeline Stages</h3>
                  <NodeSelector
                    pipelineStages={pipelineStages}
                    setSelectedNode={setSelectedNode}
                    selectedNode={selectedNode}
                  />
                </div>

                {/* Right Panel - Node Details */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    <NodeDetails 
                      pipelineStages={pipelineStages} 
                      selectedNode={selectedNode} 
                      trace={trace}
                      recordingUrl={recordingUrl}
                      callStartTime={callStartTime}
                      audioSegmentInfo={audioSegmentInfo}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedView === "config" && (
              <div className="p-6 h-full overflow-y-auto">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Raw Configuration Data</h3>
                  <pre className="bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded text-xs overflow-auto max-h-[70vh] border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(trace.turn_configuration, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {selectedView === "insights" && (
              <div className="p-6 h-full overflow-y-auto">
                <EnhancedInsights trace={trace} isVapiAgent={isVapiAgent} pipelineStages={pipelineStages} setCopiedField={setCopiedField} copiedField={copiedField} />
              </div>
            )}

            {selectedView === "bug-report" && (
              <div className="p-6 h-full overflow-y-auto">
                <BugReport trace={trace} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}

export default EnhancedTraceDetailSheet