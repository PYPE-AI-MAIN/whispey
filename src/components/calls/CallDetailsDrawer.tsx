"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { X, Bot, Clock, Brain, Volume2, Mic, Activity, Download, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { useSupabaseQuery } from "../../hooks/useSupabase"
import AudioPlayer from "../AudioPlayer"
import { extractS3Key } from "../../utils/s3"
import { cn } from "@/lib/utils"

interface TranscriptLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  stt_metrics: any
  llm_metrics: any
  tts_metrics: any
  eou_metrics: any
  lesson_day: number
  created_at: string
  unix_timestamp: number
  phone_number: string
  call_duration: number
  call_success: boolean
  lesson_completed: boolean
  bug_report?: boolean
}

interface CallDetailsDrawerProps {
  isOpen: boolean
  callData: any
  onClose: () => void
}

const CallDetailsDrawer: React.FC<CallDetailsDrawerProps> = ({ isOpen, callData, onClose }) => {
  const sessionId = callData?.id
  const [bugReportDialogOpen, setBugReportDialogOpen] = useState(false)
  const [selectedBugReport, setSelectedBugReport] = useState(0)

  const {
    data: transcriptLogs,
    loading,
    error,
  } = useSupabaseQuery("pype_voice_metrics_logs", {
    select: "*",
    filters: [{ column: "session_id", operator: "eq", value: sessionId }],
    orderBy: { column: "unix_timestamp", ascending: true },
  })

  // Parse bug report data from metadata
  const bugReportData = useMemo(() => {
    if (!callData?.metadata) return null

    try {
      const metadata = typeof callData.metadata === "string" ? JSON.parse(callData.metadata) : callData.metadata
      return metadata?.bug_reports || null
    } catch (e) {
      return null
    }
  }, [callData?.metadata])

  // Parse bug flagged turns from metadata
  const bugFlaggedTurns = useMemo(() => {
    if (!callData?.metadata) return null

    try {
      const metadata = typeof callData.metadata === "string" ? JSON.parse(callData.metadata) : callData.metadata
      return metadata?.bug_flagged_turns || null
    } catch (e) {
      return null
    }
  }, [callData?.metadata])

  // Check for bug report flags using both transcript analysis AND metadata
  const checkBugReportFlags = useMemo(() => {
    const bugReportTurnIds = new Set()

    // Use metadata bug_flagged_turns
    if (bugFlaggedTurns && Array.isArray(bugFlaggedTurns)) {
      bugFlaggedTurns.forEach((flaggedTurn: any) => {
        if (flaggedTurn.turn_id) {
          bugReportTurnIds.add(flaggedTurn.turn_id)
        }
      })
    }

    // Fallback Check: checking transcript logs for explicit bug_report flags
    if (transcriptLogs?.length) {
      transcriptLogs.forEach((log: TranscriptLog) => {
        if (log.bug_report === true) {
          bugReportTurnIds.add(log.turn_id)
        }
      })
    }

    return bugReportTurnIds
  }, [transcriptLogs, bugFlaggedTurns])

  const basicTranscript = useMemo(() => {
    if (!callData?.transcript_json || transcriptLogs?.length > 0) return null

    try {
      const transcript = Array.isArray(callData.transcript_json)
        ? callData.transcript_json
        : JSON.parse(callData.transcript_json)

      return transcript.map((item: any, index: number) => ({
        id: `basic-${index}`,
        role: item.role,
        content: item.content,
        timestamp: item.timestamp,
        turn_id: index + 1,
      }))
    } catch (e) {
      return null
    }
  }, [callData?.transcript_json, transcriptLogs])

  // Calculate conversation metrics
  const conversationMetrics = useMemo(() => {
    if (!transcriptLogs?.length) return null

    const metrics = {
      stt: [] as number[],
      llm: [] as number[],
      tts: [] as number[],
      eou: [] as number[],
      agentResponseLatencies: [] as number[],
      totalTurnLatencies: [] as number[],
      endToEndLatencies: [] as number[],
      totalTurns: transcriptLogs.length,
    }

    transcriptLogs.forEach((log: TranscriptLog) => {
      if (log.stt_metrics?.duration) metrics.stt.push(log.stt_metrics.duration)
      if (log.llm_metrics?.ttft) metrics.llm.push(log.llm_metrics.ttft)
      if (log.tts_metrics?.ttfb) metrics.tts.push(log.tts_metrics.ttfb)
      if (log.eou_metrics?.end_of_utterance_delay) metrics.eou.push(log.eou_metrics.end_of_utterance_delay)

      if (log.user_transcript && log.agent_response && log.llm_metrics?.ttft && log.tts_metrics) {
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics.ttfb || 0) + (log.tts_metrics.duration || 0)
        const agentResponseTime = llmTime + ttsTime
        metrics.agentResponseLatencies.push(agentResponseTime)
      }

      if (log.stt_metrics && log.tts_metrics) {
        const sttTime = log.stt_metrics?.duration || 0
        const llmTime = log.llm_metrics?.ttft || 0
        const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
        const totalTurnTime = llmTime + ttsTime + sttTime

        if (totalTurnTime > 0) {
          metrics.totalTurnLatencies.push(totalTurnTime)
        }
      }

      if (
        log.eou_metrics?.end_of_utterance_delay &&
        log.stt_metrics?.duration &&
        log.llm_metrics?.ttft &&
        log.tts_metrics
      ) {
        const eouTime = log.eou_metrics.end_of_utterance_delay || 0
        const sttTime = log.stt_metrics.duration || 0
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
        const endToEndTime = eouTime + sttTime + llmTime + ttsTime
        metrics.endToEndLatencies.push(endToEndTime)
      }
    })

    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0, p95: 0 }
      const sorted = [...values].sort((a, b) => a - b)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      const p95Index = Math.floor(sorted.length * 0.95)
      const p95 = sorted[p95Index] || 0
      return { avg, min, max, count: values.length, p95 }
    }

    return {
      ...metrics,
      sttStats: calculateStats(metrics.stt),
      llmStats: calculateStats(metrics.llm),
      ttsStats: calculateStats(metrics.tts),
      eouStats: calculateStats(metrics.eou),
      agentResponseStats: calculateStats(metrics.agentResponseLatencies),
      totalTurnStats: calculateStats(metrics.totalTurnLatencies),
      endToEndStats: calculateStats(metrics.endToEndLatencies),
      avgTotalLatency: calculateStats(metrics.totalTurnLatencies).avg,
      avgAgentResponseTime: calculateStats(metrics.agentResponseLatencies).avg,
      avgEndToEndLatency: calculateStats(metrics.endToEndLatencies).avg,
    }
  }, [transcriptLogs])

  const getLatencyColor = (value: number, type: "stt" | "llm" | "tts" | "eou" | "total" | "e2e") => {
    const thresholds = {
      stt: { good: 1, fair: 2 },
      llm: { good: 1, fair: 3 },
      tts: { good: 1, fair: 2 },
      eou: { good: 0.5, fair: 1.5 },
      total: { good: 3, fair: 6 },
      e2e: { good: 4, fair: 8 },
    }
    const threshold = thresholds[type]
    if (value <= threshold.good) return "text-emerald-500"
    if (value <= threshold.fair) return "text-amber-500"
    return "text-red-500"
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(2)}s`
  }

  const formatConversationTime = (timestamp: number) => {
    if (!transcriptLogs?.length) return "00:00"
    const firstTimestamp = transcriptLogs[0].unix_timestamp
    const elapsed = timestamp - firstTimestamp
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.floor(elapsed % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const downloadTranscript = () => {
    if (!transcriptLogs?.length) return

    let transcriptText = transcriptLogs
      .map((log: TranscriptLog) => {
        const timestamp = formatConversationTime(log.unix_timestamp)
        let text = `[${timestamp}]\n`

        if (checkBugReportFlags.has(log.turn_id)) {
          text += `[BUG REPORT DETECTED]\n`
        }

        if (log.user_transcript) {
          text += `User: ${log.user_transcript}\n`
        }
        if (log.agent_response) {
          text += `Agent: ${log.agent_response}\n`
        }
        return text + "\n"
      })
      .join("")

    if (bugReportData && bugReportData.length > 0) {
      transcriptText += "\n\n=== BUG REPORTS ===\n"
      bugReportData.forEach((report: any, index: number) => {
        transcriptText += `\nBug Report #${index + 1} - ${new Date(report.timestamp * 1000).toLocaleString()}\n`
        transcriptText += `Messages: ${report.total_messages}\n`
        if (report.details) {
          report.details.forEach((detail: any) => {
            transcriptText += `  ${detail.type}: ${detail.text}\n`
          })
        }
      })
    }

    const blob = new Blob([transcriptText], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcript-${callData.call_id}.txt`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <TooltipProvider>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[80%] bg-background border-l shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{callData.call_id}</h2>
                {bugReportData && bugReportData.length > 0 && (
                  <Dialog open={bugReportDialogOpen} onOpenChange={setBugReportDialogOpen}>
                    <DialogTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
                          {bugReportData.length} Bug Report{bugReportData.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    </DialogTrigger>

                    <DialogContent  className="min-w-[90vw] h-[90vh] p-0 flex flex-col gap-0">
                      {/* Dialog Header */}
                      <DialogHeader className="flex-shrink-0 p-6 border-b">
                        <div className="flex items-center justify-between">
                          <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                              <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                              <div className="font-semibold">Bug Reports</div>
                            </div>
                          </DialogTitle>
                        </div>
                      </DialogHeader>

                      {/* Dialog Body - Two Panel Layout */}
                      <div className="flex flex-1 min-h-0">
                        {/* Left Sidebar - Bug Reports List */}
                        <div className="w-80 flex-shrink-0 border-r bg-gray-50/50 flex flex-col">
                          <div className="p-4 border-b bg-white">
                            <h3 className="font-medium text-gray-900">All Reports</h3>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-3">
                              {bugReportData.map((report: any, index: number) => (
                                <button
                                  key={index}
                                  onClick={() => setSelectedBugReport(index)}
                                  className={cn(
                                    "w-full p-4 text-left rounded-lg border transition-all duration-200 hover:shadow-sm",
                                    selectedBugReport === index
                                      ? "bg-white border-amber-300 shadow-sm ring-2 ring-amber-100"
                                      : "bg-white border-gray-200 hover:border-gray-300"
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                                      selectedBugReport === index ? "bg-amber-200 text-amber-800" : "bg-gray-200 text-gray-600"
                                    )}>
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm text-gray-900 mb-1">
                                        Bug Report #{index + 1}
                                      </div>
                                      <div className="text-xs text-gray-500 mb-2">
                                        {report.total_messages} message{report.total_messages !== 1 ? 's' : ''} • {new Date(report.timestamp * 1000).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right Content Panel */}
                        <div className="flex-1 flex flex-col min-w-0">
                          {/* Content Header */}
                          <div className="flex-shrink-0 py-2 px-8 justify-center items-center border-b bg-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-lg font-semibold">
                                  {selectedBugReport + 1}
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 text-lg">Bug Report #{selectedBugReport + 1}</h3>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedBugReport(Math.max(0, selectedBugReport - 1))}
                                  disabled={selectedBugReport === 0}
                                >
                                  Previous
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedBugReport(Math.min(bugReportData.length - 1, selectedBugReport + 1))
                                  }
                                  disabled={selectedBugReport === bugReportData.length - 1}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                            
                            {/* Metadata Row */}
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {new Date(bugReportData[selectedBugReport].timestamp * 1000).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Scrollable Content Body */}
                          <div className="flex-1 overflow-y-auto bg-gray-50/30">
                            <div className="p-6">
                              {bugReportData[selectedBugReport].details && bugReportData[selectedBugReport].details.length > 0 ? (
                                <div className="space-y-4">
                                  {(() => {
                                    const currentReport = bugReportData[selectedBugReport]
                                    
                                    // Find the agent message that was flagged as bug (has the "Reported Bug" badge)
                                    const flaggedAgentTurn = transcriptLogs?.find((log: TranscriptLog) => 
                                      checkBugReportFlags.has(log.turn_id) && log.agent_response
                                    )
                                    
                                    // Find the user message right before that flagged agent response
                                    const userMessageBeforeBug = flaggedAgentTurn ? 
                                      transcriptLogs?.find((log: TranscriptLog) => 
                                        log.turn_id === flaggedAgentTurn.turn_id && log.user_transcript
                                      ) : null
                                    
                                    const initialReport = currentReport.details.find((detail: any) => detail.type === "initial_report")
                                    const additionalDetails = currentReport.details.filter((detail: any) => detail.type !== "initial_report")
                                    
                                    return (
                                      <>
                                        {/* Show the flagged conversation exchange */}
                                        {(userMessageBeforeBug || flaggedAgentTurn) && (
                                          <div className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
                                              <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-semibold">
                                                  !
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="destructive" className="text-xs">
                                                    Flagged Conversation
                                                  </Badge>
                                                  <span className="text-sm text-red-700">
                                                    Turn #{flaggedAgentTurn?.turn_id} • {flaggedAgentTurn ? formatConversationTime(flaggedAgentTurn.unix_timestamp) : ''}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="p-6 space-y-4">
                                              {/* User message that led to the problematic response */}
                                              {userMessageBeforeBug?.user_transcript && (
                                                <div className="border-l-4 border-blue-200 pl-4">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="outline" className="text-xs">User</Badge>
                                                    <span className="text-xs text-gray-500">
                                                      {formatConversationTime(userMessageBeforeBug.unix_timestamp)}
                                                    </span>
                                                  </div>
                                                  <blockquote className="text-gray-900 leading-relaxed">
                                                    "{userMessageBeforeBug.user_transcript}"
                                                  </blockquote>
                                                </div>
                                              )}
                                              
                                              {/* The agent response that was flagged as bug */}
                                              {flaggedAgentTurn?.agent_response && (
                                                <div className="border-l-4 border-red-400 pl-4 bg-red-50/50 rounded-r-lg py-3">
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="destructive" className="text-xs">
                                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                                      Reported Bug
                                                    </Badge>
                                                    <span className="text-xs text-red-600">
                                                      {formatConversationTime(flaggedAgentTurn.unix_timestamp)}
                                                    </span>
                                                  </div>
                                                  <blockquote className="text-red-900 leading-relaxed font-medium">
                                                    "{flaggedAgentTurn.agent_response}"
                                                  </blockquote>
                                                  
                                                  {/* Show performance metrics for the flagged response */}
                                                  {(flaggedAgentTurn.llm_metrics || flaggedAgentTurn.tts_metrics) && (
                                                    <div className="flex gap-3 mt-3 pt-2 border-t border-red-200">
                                                      {flaggedAgentTurn.llm_metrics && (
                                                        <div className="flex items-center gap-1 text-xs text-red-600">
                                                          <Brain className="w-3 h-3" />
                                                          LLM: {formatDuration(flaggedAgentTurn.llm_metrics.ttft || 0)}
                                                        </div>
                                                      )}
                                                      {flaggedAgentTurn.tts_metrics && (
                                                        <div className="flex items-center gap-1 text-xs text-red-600">
                                                          <Volume2 className="w-3 h-3" />
                                                          TTS: {formatDuration(flaggedAgentTurn.tts_metrics.ttfb || 0)}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* User's bug report complaint */}
                                        {initialReport && (
                                          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/50">
                                              <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-semibold">
                                                 𖢥
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge className="text-xs bg-amber-600 text-white">
                                                    User's Bug Report
                                                  </Badge>
                                                  <span className="text-sm text-amber-700">
                                                    {new Date(currentReport.timestamp * 1000).toLocaleTimeString()}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="p-6">
                                              <div className="relative">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full"></div>
                                                <div className="pl-6">
                                                  <blockquote className="text-gray-900 leading-relaxed text-lg">
                                                    "{initialReport.text}"
                                                  </blockquote>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Additional details from user */}
                                        {additionalDetails.length > 0 && (
                                          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-blue-100 bg-blue-50/50">
                                              <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                                                  💬
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="secondary" className="text-xs">
                                                    Bug details ({additionalDetails.length} message{additionalDetails.length !== 1 ? 's' : ''})
                                                  </Badge>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="p-6">
                                              <div className="space-y-3">
                                                {additionalDetails.map((detail: any, index: number) => (
                                                  <div key={index} className="relative">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-200 to-blue-100 rounded-full"></div>
                                                    <div className="pl-6">
                                                      <blockquote className="text-gray-900 leading-relaxed">
                                                        "{detail.text}"
                                                      </blockquote>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-full min-h-[300px]">
                                  <div className="text-center">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <AlertTriangle className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h3 className="font-medium text-gray-900 mb-2">No Details Available</h3>
                                    <p className="text-sm text-gray-500 max-w-sm">
                                      This bug report doesn't contain detailed information about the reported issues.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="flex-shrink-0 p-4 border-t bg-white">
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div>Viewing report {selectedBugReport + 1} of {bugReportData.length}</div>
                              <DialogClose asChild>
                                <Button variant="outline" size="sm">
                                  Close
                                </Button>
                              </DialogClose>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp(
                  callData.created_at ? new Date(callData.created_at).getTime() / 1000 : Date.now() / 1000,
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTranscript} disabled={!transcriptLogs?.length}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Audio Player */}
          {callData.recording_url && (
            <div className="mb-6">
              <AudioPlayer
                s3Key={extractS3Key(callData.recording_url)}
                url={callData.recording_url}
                callId={callData.id}
              />
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{transcriptLogs?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Turns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.floor(callData.duration_seconds / 60)}:
                {(callData.duration_seconds % 60).toString().padStart(2, "0")}
              </div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  conversationMetrics ? getLatencyColor(conversationMetrics.avgEndToEndLatency, "total") : "",
                )}
              >
                {conversationMetrics ? formatDuration(conversationMetrics.avgEndToEndLatency) : "N/A"}
              </div>
              <div className="text-sm text-muted-foreground">Avg Latency</div>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  "text-2xl font-bold",
                  bugReportData && bugReportData.length > 0 ? "text-amber-500" : "text-muted-foreground",
                )}
              >
                {bugReportData ? bugReportData.length : 0}
              </div>
              <div className="text-sm text-muted-foreground">Bug Reports</div>
            </div>
          </div>

          {/* Performance Metrics */}
          {conversationMetrics && transcriptLogs?.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">PERFORMANCE METRICS</h3>
              <div className="grid grid-cols-4 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.sttStats.avg, "stt"),
                        )}
                      >
                        {formatDuration(conversationMetrics.sttStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">STT</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Speech-to-Text</div>
                      <div className="text-xs text-muted-foreground">Time to convert speech to text</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.llmStats.avg, "llm"),
                        )}
                      >
                        {formatDuration(conversationMetrics.llmStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">LLM</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Language Model</div>
                      <div className="text-xs text-muted-foreground">Time to generate response</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.ttsStats.avg, "tts"),
                        )}
                      >
                        {formatDuration(conversationMetrics.ttsStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">TTS</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">Text-to-Speech</div>
                      <div className="text-xs text-muted-foreground">Time to convert text to speech</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          getLatencyColor(conversationMetrics.eouStats.avg, "eou"),
                        )}
                      >
                        {formatDuration(conversationMetrics.eouStats.avg)}
                      </div>
                      <div className="text-xs text-muted-foreground">EOU</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">End of Utterance</div>
                      <div className="text-xs text-muted-foreground">Time to detect speech end</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b bg-muted/20">
            <h3 className="font-medium">Conversation Transcript</h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <p>Error loading transcript: {error}</p>
                </div>
              ) : transcriptLogs?.length ? (
                <div className="space-y-6">
                  {/* Metrics-based transcript display */}
                  {transcriptLogs.map((log: TranscriptLog) => (
                    <div key={log.id} className="space-y-4">
                      {/* User Message */}
                      {log.user_transcript && (
                        <div
                          className={cn(
                            "flex gap-4 group",
                            log.user_transcript?.toLowerCase().includes("bug report") &&
                              "bg-amber-50 rounded-lg p-3 border border-amber-200",
                          )}
                        >
                          <div className="flex-shrink-0 w-12 text-right">
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatConversationTime(log.unix_timestamp)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                User
                              </Badge>
                              {log.user_transcript?.toLowerCase().includes("bug report") && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-amber-100 text-amber-800 border-amber-300"
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Bug Report Trigger
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">{log.user_transcript}</p>

                            {/* User Metrics */}
                            <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.stt_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                      <Mic className="w-3 h-3" />
                                      {formatDuration(log.stt_metrics.duration || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Speech-to-Text processing time</TooltipContent>
                                </Tooltip>
                              )}
                              {log.eou_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(log.eou_metrics.end_of_utterance_delay || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>End of utterance detection time</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Agent Response */}
                      {log.agent_response && (
                        <div
                          className={cn(
                            "flex gap-4 group",
                            checkBugReportFlags.has(log.turn_id) && "bg-red-50 rounded-lg p-3 border border-red-200",
                          )}
                        >
                          <div className="flex-shrink-0 w-12 text-right">
                            <div className="text-xs text-muted-foreground font-mono">
                              {formatConversationTime(log.unix_timestamp + 1)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                Agent
                              </Badge>
                              {checkBugReportFlags.has(log.turn_id) && (
                                <Badge variant="destructive" className="text-xs bg-red-100 text-red-800 border-red-300">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Reported Bug
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">{log.agent_response}</p>

                            <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {log.llm_metrics && log.tts_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(
                                          (log.llm_metrics.ttft || 0) + (log.tts_metrics.ttfb || 0),
                                          "total",
                                        ),
                                      )}
                                    >
                                      <Activity className="w-3 h-3" />
                                      {formatDuration((log.llm_metrics.ttft || 0) + (log.tts_metrics.ttfb || 0))}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Total response time (LLM + TTS)</TooltipContent>
                                </Tooltip>
                              )}
                              {log.llm_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(log.llm_metrics.ttft || 0, "llm"),
                                      )}
                                    >
                                      <Brain className="w-3 h-3" />
                                      {formatDuration(log.llm_metrics.ttft || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Language model processing time</TooltipContent>
                                </Tooltip>
                              )}
                              {log.tts_metrics && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1 text-xs cursor-help",
                                        getLatencyColor(log.tts_metrics.ttfb || 0, "tts"),
                                      )}
                                    >
                                      <Volume2 className="w-3 h-3" />
                                      {formatDuration(log.tts_metrics.ttfb || 0)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Text-to-speech processing time</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : basicTranscript?.length ? (
                <div className="space-y-6">
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-blue-800 text-sm font-medium">Basic Transcript</p>
                    <p className="text-blue-700 text-xs">Simple conversation format without detailed metrics</p>
                  </div>
                  {basicTranscript.map((item: any) => (
                    <div key={item.id} className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-12 text-right">
                          <div className="text-xs text-muted-foreground font-mono">
                            {item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit' 
                            }) : `${item.id}`}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.role === 'user' ? 'outline' : 'secondary'} className="text-xs">
                              {item.role === 'user' ? 'User' : item.role === 'assistant' ? 'Assistant' : item.role}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No conversation transcript available for this call</p>
                  <p className="text-xs">Make sure to include either transcript_json or transcript_with_metrics in your API requests</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default CallDetailsDrawer
