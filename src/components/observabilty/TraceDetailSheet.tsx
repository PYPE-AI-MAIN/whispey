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
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface TraceDetailSheetProps {
  isOpen: boolean
  trace: any
  onClose: () => void
}

const EnhancedTraceDetailSheet: React.FC<TraceDetailSheetProps> = ({ isOpen, trace, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<string>("pipeline")
  const [selectedNode, setSelectedNode] = useState<string>("stt")

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
      const firstActiveStage = pipelineStages.find((stage) => stage.active)
      if (firstActiveStage) {
        setSelectedNode(firstActiveStage.id)
      }
    }
  }, [trace, isOpen])

  if (!isOpen || !trace) return null

  const formatTimestamp = (timestamp: number) => {
    // Handle both seconds and milliseconds timestamps
    const timestampMs = timestamp > 1e12 ? timestamp : timestamp * 1000
    const date = new Date(timestampMs)

    // Check if it's a valid date
    if (isNaN(date.getTime())) {
      return `Invalid timestamp: ${timestamp}`
    }

    // Get clean timezone abbreviation (IST, EST, PST etc.)
    const timeZoneAbbr =
      date
        .toLocaleTimeString("en-US", {
          timeZoneName: "short",
        })
        .split(" ")
        .pop() || "Local"

    // Simple format: Aug 27, 14:36:00 IST (user's timezone)
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) +
      ", " +
      date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      ` ${timeZoneAbbr}`
    )
  }

  const parseBugReportText = (data: any): string => {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return parsed.text || data;
      } catch {
        return data;
      }
    }
    return data?.text || JSON.stringify(data);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(3)}ms`
    return `${(ms / 1000).toFixed(3)}s`
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`
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
      active: !!vadConfig,
      config: vadConfig,
      metrics: null,
      inputType: "Audio Stream",
      outputType: "Speech Events",
      status: vadConfig ? "active" : "inactive",
    },
    {
      id: "eou",
      name: "EOU",
      icon: <Activity className="w-3 h-3" />,
      color: "orange",
      active: !!trace.eou_metrics,
      config: eouConfig,
      metrics: trace.eou_metrics,
      inputType: "Audio Stream",
      outputType: "Speech Events",
      status: trace.eou_metrics ? "success" : "inactive",
    },
    {
      id: "stt",
      name: "STT",
      icon: <Mic className="w-3 h-3" />,
      color: "blue",
      active: !!trace.user_transcript,
      config: sttConfig,
      metrics: trace.stt_metrics,
      enhanced: enhancedSTT,
      inputType: "Audio",
      outputType: "Text",
      inputData: `${trace.stt_metrics?.audio_duration?.toFixed(1) || 0}s audio`,
      outputData: trace.user_transcript,
      status: trace.stt_metrics ? "success" : "missing",
    },
    {
      id: "llm",
      name: "LLM",
      icon: <Brain className="w-3 h-3" />,
      color: "purple",
      active: !!trace.agent_response,
      config: llmConfig,
      metrics: trace.llm_metrics,
      enhanced: enhancedLLM,
      tools: trace.tool_calls || [],
      llmRequests: llmRequests,
      inputType: "Text",
      outputType: "Text",
      inputData: trace.user_transcript,
      outputData: trace.agent_response,
      status: trace.llm_metrics ? "success" : "missing",
    },
    {
      id: "tts",
      name: "TTS",
      icon: <Volume2 className="w-3 h-3" />,
      color: "green",
      active: !!trace.tts_metrics,
      config: ttsConfig,
      metrics: trace.tts_metrics,
      enhanced: enhancedTTS,
      inputType: "Text",
      outputType: "Audio",
      inputData: trace.agent_response,
      outputData: `${trace.tts_metrics?.audio_duration?.toFixed(1) || 0}s audio`,
      status: trace.tts_metrics ? "success" : "missing",
    }
  ]

  // log for eou config and all
  console.log({eouConfig, trace})


  const renderNodeSelector = () => (
    <div className="space-y-2">
      {pipelineStages
        .filter((stage) => stage.active)
        .map((stage) => (
          <button
            key={stage.id}
            onClick={() => setSelectedNode(stage.id)}
            className={cn(
              "w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm",
              selectedNode === stage.id
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                  `bg-${stage.color}-50 border-${stage.color}-200 text-${stage.color}-600`,
                )}
              >
                {stage.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  {stage.name}
                  {stage.tools && stage.tools.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-600 font-medium">{stage.tools.length}</span>
                    </div>
                  )}
                  {stage.llmRequests && stage.llmRequests.length > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-purple-600" />
                      <span className="text-xs text-purple-600 font-medium">{stage.llmRequests.length}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {stage.status === "success" && <span className="text-green-600">✓ Completed</span>}
                  {stage.status === "missing" && <span className="text-gray-500">No data</span>}
                  {stage.status === "active" && <span className="text-orange-600">● Active</span>}
                </div>
              </div>
              {stage.metrics && (
                <div className="text-right">
                  <div className="text-xs font-mono text-gray-600">
                    {stage.id === "eou" && `${stage.metrics.end_of_utterance_delay?.toFixed(2)}s`}
                    {stage.id === "stt" && `${stage.metrics.duration?.toFixed(2)}s`}
                    {stage.id === "llm" && `${stage.metrics.ttft?.toFixed(2)}s`}
                    {stage.id === "tts" && `${stage.metrics.ttfb?.toFixed(2)}s`}
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
    </div>
  )

  const renderNodeDetails = () => {
    const selectedStage = pipelineStages.find((stage) => stage.id === selectedNode)
    if (!selectedStage) return null

    return (
      <div className="space-y-4">
        {/* Node Header */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center border",
              `bg-${selectedStage.color}-50 border-${selectedStage.color}-200 text-${selectedStage.color}-600`,
            )}
          >
            {selectedStage.icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{selectedStage.name} Processing</h3>
            <p className="text-sm text-gray-600">
              {selectedStage.inputType} → {selectedStage.outputType}
            </p>
          </div>
          {selectedStage.status && (
            <Badge variant={selectedStage.status === "success" ? "default" : "secondary"} className="ml-auto">
              {selectedStage.status}
            </Badge>
          )}
        </div>

        {/* Input/Output Flow */}
        <div className="space-y-4">
          {/* Skip VAD and EOU input/output as they're real-time monitoring, not transformative */}
          {selectedStage.id !== "vad" && selectedStage.id !== "eou" && (
            <>
              {/* Input Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Input
                  {selectedStage.id === "stt" && trace.stt_metrics?.audio_duration && (
                    <span className="text-xs text-gray-500 ml-auto">
                      Audio stream •{" "}
                      <code className="bg-gray-100 px-1 rounded">{trace.stt_metrics.audio_duration.toFixed(1)}s</code>
                    </span>
                  )}
                  {selectedStage.id === "tts" && trace.tts_metrics?.audio_duration && (
                    <span className="text-xs text-gray-500 ml-auto">
                      Text length:{" "}
                      <code className="bg-gray-100 px-1 rounded">{trace.agent_response?.length || 0} chars</code>
                    </span>
                  )}
                </h4>
                {selectedStage.id === "stt" && (
                  <div className="bg-gray-100 border rounded-lg p-3 text-sm text-gray-600 italic">
                    Audio stream processed ({trace.stt_metrics?.audio_duration?.toFixed(1) || 0}s duration)
                  </div>
                )}
                {selectedStage.id === "llm" && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 pl-3 py-2 text-sm">
                    "{trace.user_transcript || "No input"}"
                  </div>
                )}
                {selectedStage.id === "tts" && (
                  <div className="bg-purple-50 border-l-4 border-purple-500 pl-3 py-2 text-sm max-h-32 overflow-y-auto">
                    "{trace.agent_response || "No text"}"
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-gray-400" />
              </div>

              {/* Output Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Output
                </h4>
                {selectedStage.id === "stt" && (
                  <div className="bg-green-50 border-l-4 border-green-500 pl-3 py-2 text-sm">
                    "{trace.user_transcript || "No transcription"}"
                  </div>
                )}
                {selectedStage.id === "llm" && (
                  <div className="bg-green-50 border-l-4 border-green-500 pl-3 py-2 text-sm max-h-40 overflow-y-auto">
                    "{trace.agent_response || "No response"}"
                  </div>
                )}
                {selectedStage.id === "tts" && (
                  <div className="bg-gray-100 border rounded-lg p-3 text-sm text-gray-600 italic">
                    Audio generated ({trace.tts_metrics?.audio_duration?.toFixed(1) || 0}s duration)
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Special handling for EOU - show detection timing instead of input/output */}
          {selectedStage.id === "eou" && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-600" />
                End of Utterance Detection
              </h4>
              <div className="space-y-3">
                {/* <div className="bg-white border rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Transcription Delay</div>
                  <div className="font-mono text-sm font-medium">
                    {trace.eou_metrics?.transcription_delay ? 
                      formatDuration(trace.eou_metrics.transcription_delay * 1000) : 
                      "No data"}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Time from audio end to transcription completion
                  </div>
                </div> */}
                
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">EOU Detection Delay</div>
                  <div className="font-mono text-sm font-medium text-orange-600">
                    {trace.eou_metrics?.end_of_utterance_delay ? 
                      formatDuration(trace.eou_metrics.end_of_utterance_delay * 1000) : 
                      "No data"}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Time to detect the user stopped speaking
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LLM Prompt Data - Enhanced Design */}
        {selectedStage.id === "llm" && trace.enhanced_data?.prompt_data && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Complete Prompt Context
              </h4>
              <Badge variant="secondary" className="text-xs">
                {trace.enhanced_data.prompt_data.conversation_history?.length || 0} messages
              </Badge>
            </div>

            {/* System Instructions */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-sm font-medium text-gray-700">System Instructions</span>
              </div>
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-3">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {trace.enhanced_data.prompt_data.system_instructions || "No system instructions"}
                </pre>
              </div>
            </div>

            {/* Available Tools */}
            {trace.enhanced_data.prompt_data.available_tools?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium text-gray-700">Available Tools</span>
                  <Badge variant="outline" className="text-xs">
                    {trace.enhanced_data.prompt_data.available_tools.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {trace.enhanced_data.prompt_data.available_tools.map((tool: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-semibold text-blue-800">{tool.name}</code>
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">{tool.tool_type}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation History */}
            {trace.enhanced_data.prompt_data.conversation_history?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-gray-700">Conversation History</span>
                  <Badge variant="outline" className="text-xs">
                    {trace.enhanced_data.prompt_data.conversation_history.length} messages
                  </Badge>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                  {trace.enhanced_data.prompt_data.conversation_history.map((message: any, idx: number) => {
                    // Parse content if it's a string array
                    let displayContent = message.content
                    if (typeof message.content === "string" && message.content.startsWith("[")) {
                      try {
                        const parsed = JSON.parse(message.content)
                        displayContent = Array.isArray(parsed) ? parsed[0] : parsed
                      } catch {
                        displayContent = message.content
                      }
                    }

                    const roleColors = {
                      system: "bg-amber-50 border-amber-200 text-amber-800",
                      user: "bg-blue-50 border-blue-200 text-blue-800",
                      assistant: "bg-green-50 border-green-200 text-green-800",
                      unknown: "bg-gray-50 border-gray-200 text-gray-600",
                    }

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3 ${roleColors[message.role as keyof typeof roleColors] || roleColors.unknown}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={message.role === "system" ? "secondary" : "outline"} className="text-xs">
                              {message.role}
                            </Badge>
                            {message.id && (
                              <span className="text-xs font-mono text-gray-500">{message.id.slice(0, 12)}...</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">#{idx + 1}</span>
                        </div>

                        {displayContent ? (
                          <div className="text-sm leading-relaxed">
                            <pre className="whitespace-pre-wrap font-sans">
                              {typeof displayContent === "string"
                                ? displayContent
                                : JSON.stringify(displayContent, null, 2)}
                            </pre>
                          </div>
                        ) : (
                          <div className="text-xs italic text-gray-500">
                            [Empty content - likely a function call or system event]
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Context Summary */}
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Context Length</div>
                  <div className="font-mono font-semibold">{trace.enhanced_data.prompt_data.context_length || 0}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Tools Available</div>
                  <div className="font-mono font-semibold">{trace.enhanced_data.prompt_data.tools_count || 0}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Captured</div>
                  <div className="font-mono font-semibold text-xs">
                    {trace.enhanced_data.prompt_data.timestamp
                      ? new Date(trace.enhanced_data.prompt_data.timestamp * 1000).toLocaleTimeString()
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tool Calls for LLM - Show after prompts */}
        {selectedStage.id === "llm" && selectedStage.tools && selectedStage.tools.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              Tool Executions ({selectedStage.tools.length})
            </h4>
            <div className="space-y-3">
              {selectedStage.tools.map((tool: any, index: number) => (
                <div key={index} className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        <Wrench className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="font-mono text-sm font-medium">{tool.name}</span>
                      <Badge variant={tool.status === "success" ? "default" : "destructive"} className="text-xs">
                        {tool.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {tool.execution_duration_ms ? formatDuration(tool.execution_duration_ms) : "< 1ms"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 font-medium min-w-[4rem]">Args:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                        {JSON.stringify(tool.arguments, null, 1)}
                      </code>
                    </div>

                    {tool.result && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-600 font-medium min-w-[4rem]">Result:</span>
                        <code className="text-xs bg-green-50 border border-green-200 px-2 py-1 rounded flex-1 max-h-24 overflow-y-auto">
                          {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 1)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedStage.metrics && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">Performance Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(selectedStage.metrics).map(([key, value]) => (
                <div key={key} className="bg-white rounded p-3">
                  <div className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</div>
                  <div className="font-mono text-sm font-medium">
                    {key.includes("duration") || key.includes("ttft") || key.includes("ttfb")
                      ? `${typeof value === "number" ? value.toFixed(3) : value}s`
                      : key.includes("timestamp")
                        ? formatTimestamp(typeof value === "number" ? value : Number.parseFloat(String(value)))
                        : typeof value === "number"
                          ? value.toLocaleString()
                          : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration */}
        {selectedStage.config && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3">Configuration</h4>
            <div className="bg-white rounded p-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {selectedStage.id === "vad" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Activation Threshold:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.activation_threshold}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Speech Duration:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.min_speech_duration}s
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Update Interval:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.capabilities?.update_interval}s
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "eou" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Detection Mode:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config?.detection_mode || "Voice Activity"}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Silence Threshold:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config?.silence_threshold || "Default"}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Duration:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config?.min_duration || "Auto"}s
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "stt" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Language:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.config.language}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Streaming:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.capabilities?.streaming ? "Yes" : "No"}
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "llm" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Temperature:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.config.temperature}</code>
                    </div>
                    {selectedStage.metrics && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prompt Tokens:</span>
                        <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.metrics.prompt_tokens}</code>
                      </div>
                    )}
                    {selectedStage.metrics && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completion Tokens:</span>
                        <code className="bg-gray-100 px-1 rounded text-xs">
                          {selectedStage.metrics.completion_tokens}
                        </code>
                      </div>
                    )}
                  </>
                )}
                {selectedStage.id === "tts" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Voice ID:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.voice_id?.slice(0, 12)}...
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <code className="bg-gray-100 px-1 rounded text-xs">
                        {selectedStage.config.voice_settings?.speed}
                      </code>
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
      </div>
    )
  }

  const renderEnhancedInsights = () => {
    // Calculate actual pipeline duration from stage metrics
    const calculatePipelineDuration = () => {
      let totalMs = 0

      // STT duration (convert to ms if needed)
      if (trace.stt_metrics?.duration) {
        totalMs += trace.stt_metrics.duration * 1000 // Convert seconds to ms
      }

      // LLM TTFT (convert to ms if needed)
      if (trace.llm_metrics?.ttft) {
        totalMs += trace.llm_metrics.ttft * 1000 // Convert seconds to ms
      }

      // TTS TTFB (convert to ms if needed)
      if (trace.tts_metrics?.ttfb) {
        totalMs += trace.tts_metrics.ttfb * 1000 // Convert seconds to ms
      }

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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-lg font-semibold mb-4">Cost Breakdown</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded border">
                <span className="font-medium">Total Trace Cost:</span>
                <span className="font-mono text-lg text-green-600">
                  {formatCost(Number.parseFloat(trace.trace_cost_usd))}
                </span>
              </div>
              {trace.otel_spans &&
                trace.otel_spans.map((span: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-white rounded text-sm">
                    <span className="text-gray-600">{span.operation}:</span>
                    <span className="font-mono">
                      ~{formatCost(Number.parseFloat(trace.trace_cost_usd) / trace.otel_spans.length)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Latency Analysis */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Latency Analysis</h4>
          <div className="space-y-3">
            {pipelineStages
              .filter((s) => s.metrics)
              .map((stage) => (
                <div key={stage.id} className="flex justify-between items-center p-3 bg-white rounded">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded bg-${stage.color}-100 flex items-center justify-center`}>
                      {stage.icon}
                    </div>
                    <span className="font-medium capitalize">{stage.name}:</span>
                  </div>
                  <span className="font-mono text-sm">
                    {stage.id === "stt" && stage.metrics?.duration && formatDuration(stage.metrics.duration * 1000)}
                    {stage.id === "llm" && stage.metrics?.ttft && formatDuration(stage.metrics.ttft * 1000)}
                    {stage.id === "tts" && stage.metrics?.ttfb && formatDuration(stage.metrics.ttfb * 1000)}
                    {stage.id === "eou" && stage.metrics?.end_of_utterance_delay && formatDuration(stage.metrics.end_of_utterance_delay * 1000)}
                  </span>
                </div>
              ))}
            <div className="flex justify-between items-center p-3 bg-white rounded border-2 border-blue-200 font-medium">
              <span>Actual Pipeline Duration:</span>
              <span className="font-mono text-lg text-blue-600">{formatDuration(actualPipelineDuration)}</span>
            </div>
          </div>
        </div>

        {/* Session Information */}
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="text-lg font-semibold mb-4">Session Information</h4>
          <div className="grid grid-cols-1 gap-3">
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-gray-600">Session ID:</span>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{trace.session_id.slice(0, 16)}...</code>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.session_id, "session_id")}>
                  {copiedField === "session_id" ? "✓" : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-gray-600">Trace ID:</span>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{trace.trace_id?.slice(0, 16)}...</code>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.trace_id, "trace_id")}>
                  {copiedField === "trace_id" ? "✓" : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded">
              <span className="text-gray-600">Turn ID:</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{trace.turn_id}</code>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderBugReport = () => {
    // Check if this turn has bug reports
    const isFlaggedTurn =
      trace.bug_report ||
      trace.bug_report_data?.bug_flagged_turns?.some(
        (turn: any) => turn.turn_id.toString() === trace.turn_id.toString(),
      )

    if (!isFlaggedTurn) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">No Bug Report</h3>
            <p className="text-sm text-gray-500 max-w-sm">This turn was not flagged for any reported bugs.</p>
          </div>
        </div>
      )
    }

    // Find the flagged turn details for this specific turn
    const currentFlaggedTurn = trace.bug_report_data?.bug_flagged_turns?.find(
      (turn: any) => turn.turn_id.toString() === trace.turn_id.toString(),
    )

    // Map bug reports to this specific turn by finding the closest flagged turn for each report
    const currentTurnBugReports =
      trace.bug_report_data?.bug_reports?.filter((report: any) => {
        if (!trace.bug_report_data?.bug_flagged_turns) return false

        // Find which flagged turn this bug report is closest to
        let closestFlaggedTurn: any = null
        let minTimeDiff = Number.POSITIVE_INFINITY

        trace.bug_report_data.bug_flagged_turns.forEach((flaggedTurn: any) => {
          const timeDiff = Math.abs(report.timestamp - flaggedTurn.flagged_at)
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff
            closestFlaggedTurn = flaggedTurn
          }
        })

        // Only include this bug report if the closest flagged turn matches our current turn
        return closestFlaggedTurn?.turn_id === trace.turn_id
      }) || []

    return (
      <div className="space-y-6">
        {/* Turn Context - Flagged Conversation */}
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-lg font-semibold">
                !
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    Flagged Turn
                  </Badge>
                  <span className="text-sm text-red-700">
                    Turn #{trace.turn_id} • {formatTimestamp(trace.unix_timestamp)}
                  </span>
                </div>
                <div className="text-xs text-red-600 mt-1">
                  This conversation turn was reported as problematic by the user
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* User Input */}
            {trace.user_transcript && (
              <div className="border-l-4 border-blue-200 pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <Badge variant="outline" className="text-xs">
                    User Input
                  </Badge>
                  <span className="text-xs text-gray-500">{formatTimestamp(trace.unix_timestamp)}</span>
                </div>
                <blockquote className="text-gray-900 leading-relaxed">
                  "{parseBugReportText(trace.user_transcript)}"
                  </blockquote>
              </div>
            )}

            {/* Agent Response that was flagged */}
            {trace.agent_response && (
              <div className="border-l-4 border-red-400 pl-4 bg-red-50/50 rounded-r-lg py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-red-600" />
                  <Badge variant="destructive" className="text-xs">
                    Reported Response
                  </Badge>
                  <span className="text-xs text-red-600">{formatTimestamp(trace.unix_timestamp + 1)}</span>
                </div>
                <blockquote className="text-red-900 leading-relaxed font-medium">
                  "{parseBugReportText(trace.agent_response)}"
                  </blockquote>

                {/* Show performance metrics for the flagged response */}
                {(trace.llm_metrics || trace.tts_metrics) && (
                  <div className="flex gap-3 mt-3 pt-2 border-t border-red-200">
                    {trace.llm_metrics?.ttft && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <Brain className="w-3 h-3" />
                        LLM: {formatDuration(trace.llm_metrics.ttft * 1000)}
                      </div>
                    )}
                    {trace.tts_metrics?.ttfb && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <Volume2 className="w-3 h-3" />
                        TTS: {formatDuration(trace.tts_metrics.ttfb * 1000)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bug Reports from Users */}
        {currentTurnBugReports.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              User Bug Reports ({currentTurnBugReports.length})
            </h3>

            {currentTurnBugReports.map((report: any, index: number) => {
              const allDetails = report.details || []
              const initialReport = allDetails.length > 0 ? allDetails[0] : null
              const additionalDetails = allDetails.slice(1)

              return (
                <div key={`${report.timestamp}-${index}`} className="space-y-4">
                  {/* Initial Bug Report */}
                  {initialReport && (
                    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-amber-600 text-white">Bug Report #{index + 1}</Badge>
                            <span className="text-sm text-amber-700">
                              {new Date(report.timestamp * 1000).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full"></div>
                          <div className="pl-6">
                            <blockquote className="text-gray-900 leading-relaxed text-base">
                              "{parseBugReportText(initialReport)}"
                            </blockquote>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Details */}
                  {additionalDetails.length > 0 && (
                    <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                            💬
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Additional Details ({additionalDetails.length} message
                              {additionalDetails.length !== 1 ? "s" : ""})
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="space-y-3">
                          {additionalDetails.map((detail: any, detailIndex: number) => (
                            <div key={`${report.timestamp}-detail-${detailIndex}`} className="relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-200 to-blue-100 rounded-full"></div>
                              <div className="pl-6">
                                <blockquote className="text-gray-900 leading-relaxed">
                                  "{parseBugReportText(detail)}"
                                </blockquote>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Flagged Turn Metadata */}
        {currentFlaggedTurn && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-600" />
              Flagged Turn Details
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between items-center p-3 bg-white rounded">
                <span className="text-gray-600">Turn ID:</span>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{currentFlaggedTurn.turn_id}</code>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded">
                <span className="text-gray-600">Flagged At:</span>
                <span className="text-sm">
                  {currentFlaggedTurn.flagged_at ? formatTimestamp(currentFlaggedTurn.flagged_at) : "Unknown"}
                </span>
              </div>
              {currentFlaggedTurn.reason && (
                <div className="flex justify-between items-center p-3 bg-white rounded">
                  <span className="text-gray-600">Reason:</span>
                  <span className="text-sm">{currentFlaggedTurn.reason}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Information */}
        <details className="bg-gray-50 rounded-lg p-4">
          <summary className="cursor-pointer font-medium text-sm text-gray-700 hover:text-gray-900">
            Debug Information
          </summary>
          <div className="mt-3 text-xs">
            <pre className="bg-white p-3 rounded border overflow-auto max-h-64">
              {JSON.stringify(
                {
                  turn_id: trace.turn_id,
                  has_bug_report_flag: !!trace.bug_report,
                  bug_reports_found: currentTurnBugReports.length,
                  flagged_turn_details: currentFlaggedTurn,
                  timestamp: trace.unix_timestamp,
                  all_bug_reports: trace.bug_report_data?.bug_reports?.map((r: any) => ({
                    timestamp: r.timestamp,
                    details_count: r.details?.length || 0,
                    first_detail: r.details?.[0],
                  })),
                },
                null,
                2,
              )}
            </pre>
          </div>
        </details>
      </div>
    )
  }


  const viewTabs = [
    { id: "pipeline", name: "Pipeline Flow", icon: <Zap className="w-4 h-4" /> },
    { id: "config", name: "Config", icon: <Settings className="w-4 h-4" /> },
    { id: "insights", name: "Cost & Metrics", icon: <MessageSquare className="w-4 h-4" /> },
    {
      id: "bug-report",
      name: "Bug Report",
      icon: <AlertTriangle className="w-4 h-4" />,
      // Only show if this turn has bug reports
      show:
        trace.bug_report ||
        trace.bug_report_data?.bug_flagged_turns?.some((turn: any) => turn.turn_id === trace.turn_id),
    },
  ]

  return (
    <TooltipProvider>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-[90%] bg-white border-l shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Turn Analysis: {trace.turn_id}</h2>
                <div className="text-sm text-gray-500">
                  {trace.user_transcript && trace.agent_response
                    ? "Complete conversation turn with full pipeline data"
                    : "Partial conversation turn"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(trace.trace_id || trace.id, "trace_id")}>
                {copiedField === "trace_id" ? "✓" : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="border-b bg-white">
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
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700",
                      // Highlight bug report tab in red when it's available
                      tab.id === "bug-report" &&
                        "hover:text-red-600 data-[selected]:border-red-500 data-[selected]:text-red-600",
                    )}
                    data-selected={selectedView === tab.id}
                  >
                    {tab.icon}
                    {tab.name}
                  </button>
                ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedView === "pipeline" && (
            <div className="flex h-full">
              {/* Left Panel - Node Selector */}
              <div className="w-80 border-r bg-gray-50 p-4">
                <h3 className="font-medium text-sm mb-4 text-gray-700">Pipeline Stages</h3>
                {renderNodeSelector()}
              </div>

              {/* Right Panel - Node Details */}
              <div className="flex-1 p-6">{renderNodeDetails()}</div>
            </div>
          )}

          {selectedView === "config" && (
            <div className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Raw Configuration Data</h3>
                <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-[70vh] border">
                  {JSON.stringify(trace.turn_configuration, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {selectedView === "insights" && <div className="p-6">{renderEnhancedInsights()}</div>}

          {selectedView === "bug-report" && <div className="p-6">{renderBugReport()}</div>}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default EnhancedTraceDetailSheet
