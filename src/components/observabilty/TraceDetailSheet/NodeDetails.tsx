// src/components/observabilty/TraceDetailSheet/NodeDetails.tsx
import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, Activity, MessageSquare, Wrench } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'

interface NodeDetailsProps {
  pipelineStages: any[]
  selectedNode: string
  trace: any
  recordingUrl?: string
  callStartTime?: string
  audioSegmentInfo?: {
    startTime: number
    sttDuration: number
    ttsDuration: number
  } | null
}

function NodeDetails({
  pipelineStages, 
  selectedNode, 
  trace, 
  recordingUrl,
  callStartTime,
  audioSegmentInfo
}: NodeDetailsProps) {
    const selectedStage = pipelineStages.find((stage: any) => stage.id === selectedNode)
    if (!selectedStage) return null

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms.toFixed(1)}ms`
        return `${(ms / 1000).toFixed(2)}s`
    }

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
    
    // Simple Audio Component
    const SimpleAudioPlayer = ({ type, duration }: { type: 'stt' | 'tts', duration: number }) => {
      if (!recordingUrl || !audioSegmentInfo || duration === 0) {
        return (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
            Audio not available
          </div>
        )
      }

      // Ensure duration is in seconds (convert from milliseconds if needed)
      // Also validate duration is reasonable (not too long or negative)
      let durationInSeconds = duration > 100 ? duration / 1000 : duration
      if (durationInSeconds <= 0 || durationInSeconds > 300) { // Max 5 minutes
        durationInSeconds = 0
      }

      // If duration becomes 0 after validation, show error
      if (durationInSeconds === 0) {
        return (
          <div className="text-sm text-red-500 dark:text-red-400 italic">
            Invalid audio duration: {duration}s
          </div>
        )
      }

      // Calculate the actual start time for this specific segment type
      let segmentStartTime = audioSegmentInfo.startTime
      
      // For TTS segments, start after the STT duration of the same turn
      if (type === 'tts' && trace.stt_metrics?.audio_duration) {
        const sttDuration = trace.stt_metrics.audio_duration > 100 ? 
          trace.stt_metrics.audio_duration / 1000 : 
          trace.stt_metrics.audio_duration
        segmentStartTime = audioSegmentInfo.startTime + sttDuration
      }
      
      // Debug logging for segment timing
      console.log(`Segment timing for ${type.toUpperCase()}:`, {
        turnId: trace.turn_id,
        type,
        baseStartTime: audioSegmentInfo.startTime,
        segmentStartTime,
        duration: durationInSeconds,
        endTime: segmentStartTime + durationInSeconds
      })

      return (
        <div className="rounded-lg p-4">
          <AudioPlayer
            url={recordingUrl}
            s3Key=""
            callId={`${trace.turn_id}-${type}`}
            className="border-0 bg-transparent p-2"
            segmentStartTime={segmentStartTime}
            segmentDuration={durationInSeconds}
          />
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Node Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center border",
              `bg-${selectedStage.color}-50 dark:bg-${selectedStage.color}-900/20 border-${selectedStage.color}-200 dark:border-${selectedStage.color}-800 text-${selectedStage.color}-600 dark:text-${selectedStage.color}-400`,
            )}
          >
            {selectedStage.icon}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{selectedStage.name} Processing</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
                <h4 className="font-medium text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Input
                  {selectedStage.id === "stt" && trace.stt_metrics?.audio_duration && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      Audio stream •{" "}
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded">{trace.stt_metrics.audio_duration.toFixed(1)}s</code>
                    </span>
                  )}
                  {selectedStage.id === "tts" && trace.tts_metrics?.audio_duration && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      Text length:{" "}
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded">{trace.agent_response?.length || 0} chars</code>
                    </span>
                  )}
                </h4>
                {selectedStage.id === "stt" && (
                  <div className="space-y-3">
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 italic">
                      Audio stream processed ({trace.stt_metrics?.audio_duration?.toFixed(1) || 0}s duration)
                    </div>
                    
                    {/* Audio Player for STT Input */}
                    {trace.stt_metrics?.audio_duration && (
                      <SimpleAudioPlayer type="stt" duration={trace.stt_metrics.audio_duration} />
                    )}
                  </div>
                )}
                {selectedStage.id === "llm" && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 pl-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                    "{trace.user_transcript || "No input"}"
                  </div>
                )}
                {selectedStage.id === "tts" && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 dark:border-purple-400 pl-3 py-2 text-sm max-h-32 overflow-y-auto text-gray-900 dark:text-gray-100">
                    "{trace.agent_response || "No text"}"
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <ArrowDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>

              {/* Output Section */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Output
                </h4>
                {selectedStage.id === "stt" && (
                  <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-400 pl-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                    "{trace.user_transcript || "No transcription"}"
                  </div>
                )}
                {selectedStage.id === "llm" && (
                  <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-400 pl-3 py-2 text-sm max-h-40 overflow-y-auto text-gray-900 dark:text-gray-100">
                    "{trace.agent_response || "No response"}"
                  </div>
                )}
                {selectedStage.id === "tts" && (
                  <div className="space-y-3">
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400 italic">
                      Audio generated ({trace.tts_metrics?.audio_duration?.toFixed(1) || 0}s duration)
                    </div>
                    
                    {/* Audio Player for TTS Output */}
                    {trace.tts_metrics?.audio_duration && (
                      <SimpleAudioPlayer type="tts" duration={trace.tts_metrics.audio_duration} />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Special handling for EOU - show detection timing instead of input/output */}
          {selectedStage.id === "eou" && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Activity className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                End of Utterance Detection
              </h4>
              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">EOU Detection Delay</div>
                  <div className="font-mono text-sm font-medium text-orange-600 dark:text-orange-400">
                    {trace.eou_metrics?.end_of_utterance_delay ? 
                      formatDuration(trace.eou_metrics.end_of_utterance_delay * 1000) : 
                      "No data"}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Time to detect the user stopped speaking
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LLM Prompt Data - Enhanced Design */}
        {selectedStage.id === "llm" && trace.enhanced_data?.prompt_data && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-200 dark:border-purple-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System Instructions</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 rounded-r-lg p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {trace.enhanced_data.prompt_data.system_instructions || "No system instructions"}
                </pre>
              </div>
            </div>

            {/* Available Tools */}
            {trace.enhanced_data.prompt_data.available_tools?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Tools</span>
                  <Badge variant="outline" className="text-xs">
                    {trace.enhanced_data.prompt_data.available_tools.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {trace.enhanced_data.prompt_data.available_tools.map((tool: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <code className="text-sm font-semibold text-blue-800 dark:text-blue-200">{tool.name}</code>
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{tool.tool_type}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tool.description}</p>
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Conversation History</span>
                  <Badge variant="outline" className="text-xs">
                    {trace.enhanced_data.prompt_data.conversation_history.length} messages
                  </Badge>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
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
                      system: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
                      user: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
                      assistant: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
                      unknown: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400",
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
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{message.id.slice(0, 12)}...</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">#{idx + 1}</span>
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
                          <div className="text-xs italic text-gray-500 dark:text-gray-400">
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
            <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Context Length</div>
                  <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">{trace.enhanced_data.prompt_data.context_length || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Tools Available</div>
                  <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">{trace.enhanced_data.prompt_data.tools_count || 0}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Captured</div>
                  <div className="font-mono font-semibold text-xs text-gray-900 dark:text-gray-100">
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Tool Executions ({selectedStage.tools.length})
            </h4>
            <div className="space-y-3">
              {selectedStage.tools.map((tool: any, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                        <Wrench className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{tool.name}</span>
                      <Badge variant={tool.status === "success" ? "default" : "destructive"} className="text-xs">
                        {tool.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {tool.execution_duration_ms ? formatDuration(tool.execution_duration_ms) : "< 1ms"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium min-w-[4rem]">Args:</span>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded flex-1 break-all">
                        {JSON.stringify(tool.arguments, null, 1)}
                      </code>
                    </div>

                    {tool.result && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium min-w-[4rem]">Result:</span>
                        <code className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded flex-1 max-h-24 overflow-y-auto">
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
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">Performance Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(selectedStage.metrics).map(([key, value]) => (
                <div key={key} className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{key.replace(/_/g, " ")}</div>
                  <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-3 text-gray-900 dark:text-gray-100">Configuration</h4>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {selectedStage.id === "vad" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Activation Threshold:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.activation_threshold}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Min Speech Duration:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.min_speech_duration}s
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Update Interval:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.capabilities?.update_interval}s
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "eou" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Detection Mode:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config?.detection_mode || "Voice Activity"}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Silence Threshold:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config?.silence_threshold || "Default"}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Min Duration:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config?.min_duration || "Auto"}s
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "stt" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Model:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Language:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.config.language}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Streaming:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.capabilities?.streaming ? "Yes" : "No"}
                      </code>
                    </div>
                  </>
                )}
                {selectedStage.id === "llm" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Model:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.config.temperature}</code>
                    </div>
                    {selectedStage.metrics && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Prompt Tokens:</span>
                        <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.metrics.prompt_tokens}</code>
                      </div>
                    )}
                    {selectedStage.metrics && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Completion Tokens:</span>
                        <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                          {selectedStage.metrics.completion_tokens}
                        </code>
                      </div>
                    )}
                  </>
                )}
                {selectedStage.id === "tts" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Voice ID:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.voice_id?.slice(0, 12)}...
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Model:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">{selectedStage.config.model}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Speed:</span>
                      <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 rounded text-xs">
                        {selectedStage.config.voice_settings?.speed}
                      </code>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
}

export default NodeDetails