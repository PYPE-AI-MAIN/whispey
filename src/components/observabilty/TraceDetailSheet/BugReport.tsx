import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Bot, Brain, Settings, User, Volume2 } from 'lucide-react'
import React from 'react'

function BugReport({ trace }: { trace: any }) {
  
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
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

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
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">No Bug Report</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">This turn was not flagged for any reported bugs.</p>
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 flex items-center justify-center text-lg font-semibold">
                !
            </div>
            <div>
                <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                    Flagged Turn
                </Badge>
                <span className="text-sm text-red-700 dark:text-red-300">
                    Turn #{trace.turn_id} • {formatTimestamp(trace.unix_timestamp)}
                </span>
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                This conversation turn was reported as problematic by the user
                </div>
            </div>
            </div>
        </div>

        <div className="p-6 space-y-4">
            {/* User Input */}
            {trace.user_transcript && (
            <div className="border-l-4 border-blue-200 dark:border-blue-700 pl-4">
                <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <Badge variant="outline" className="text-xs">
                    User Input
                </Badge>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(trace.unix_timestamp)}</span>
                </div>
                <blockquote className="text-gray-900 dark:text-gray-100 leading-relaxed">
                "{parseBugReportText(trace.user_transcript)}"
                </blockquote>
            </div>
            )}

            {/* Agent Response that was flagged */}
            {trace.agent_response && (
            <div className="border-l-4 border-red-400 dark:border-red-600 pl-4 bg-red-50 dark:bg-red-900/10 rounded-r-lg py-3">
                <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-red-600 dark:text-red-400" />
                <Badge variant="destructive" className="text-xs">
                    Reported Response
                </Badge>
                <span className="text-xs text-red-600 dark:text-red-400">{formatTimestamp(trace.unix_timestamp + 1)}</span>
                </div>
                <blockquote className="text-red-900 dark:text-red-100 leading-relaxed font-medium">
                "{parseBugReportText(trace.agent_response)}"
                </blockquote>

                {/* Show performance metrics for the flagged response */}
                {(trace.llm_metrics || trace.tts_metrics) && (
                <div className="flex gap-3 mt-3 pt-2 border-t border-red-200 dark:border-red-700">
                    {trace.llm_metrics?.ttft && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <Brain className="w-3 h-3" />
                        LLM: {formatDuration(trace.llm_metrics.ttft * 1000)}
                    </div>
                    )}
                    {trace.tts_metrics?.ttfb && (
                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
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
        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
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
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-amber-600 text-white">Bug Report #{index + 1}</Badge>
                        <span className="text-sm text-amber-700 dark:text-amber-300">
                            {new Date(report.timestamp * 1000).toLocaleTimeString()}
                        </span>
                        </div>
                    </div>
                    </div>

                    <div className="p-6">
                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full"></div>
                        <div className="pl-6">
                        <blockquote className="text-gray-900 dark:text-gray-100 leading-relaxed text-base">
                            "{parseBugReportText(initialReport)}"
                        </blockquote>
                        </div>
                    </div>
                    </div>
                </div>
                )}

                {/* Additional Details */}
                {additionalDetails.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-blue-100 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-semibold">
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
                            <blockquote className="text-gray-900 dark:text-gray-100 leading-relaxed">
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
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            Flagged Turn Details
        </h4>
        <div className="grid grid-cols-1 gap-3">
            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
            <span className="text-gray-600 dark:text-gray-400">Turn ID:</span>
            <code className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{currentFlaggedTurn.turn_id}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
            <span className="text-gray-600 dark:text-gray-400">Flagged At:</span>
            <span className="text-sm text-gray-900 dark:text-gray-100">
                {currentFlaggedTurn.flagged_at ? formatTimestamp(currentFlaggedTurn.flagged_at) : "Unknown"}
            </span>
            </div>
            {currentFlaggedTurn.reason && (
            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded">
                <span className="text-gray-600 dark:text-gray-400">Reason:</span>
                <span className="text-sm text-gray-900 dark:text-gray-100">{currentFlaggedTurn.reason}</span>
            </div>
            )}
        </div>
        </div>
    )}

    {/* Debug Information */}
    <details className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <summary className="cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
        Debug Information
        </summary>
        <div className="mt-3 text-xs">
        <pre className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-auto max-h-64">
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

export default BugReport