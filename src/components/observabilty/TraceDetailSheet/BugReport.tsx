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
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">No Bug Report</h3>
            <p className="text-sm text-muted-foreground max-w-sm">This turn was not flagged for any reported bugs.</p>
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
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-destructive/20 bg-destructive/10">
            <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-destructive/15 text-destructive flex items-center justify-center text-lg font-semibold">
                !
            </div>
            <div>
                <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                    Flagged Turn
                </Badge>
                <span className="text-sm text-destructive">
                    Turn #{trace.turn_id} • {formatTimestamp(trace.unix_timestamp)}
                </span>
                </div>
                <div className="text-xs text-destructive mt-1">
                This conversation turn was reported as problematic by the user
                </div>
            </div>
            </div>
        </div>

        <div className="p-6 space-y-4">
            {/* User Input */}
            {trace.user_transcript && (
            <div className="border-l-4 border-primary/30 pl-4">
                <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <Badge variant="outline" className="text-xs">
                    User Input
                </Badge>
                <span className="text-xs text-muted-foreground">{formatTimestamp(trace.unix_timestamp)}</span>
                </div>
                <blockquote className="text-foreground leading-relaxed">
                "{parseBugReportText(trace.user_transcript)}"
                </blockquote>
            </div>
            )}

            {/* Agent Response that was flagged */}
            {trace.agent_response && (
            <div className="border-l-4 border-red-400 dark:border-red-600 pl-4 bg-destructive/10 rounded-r-lg py-3">
                <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-destructive" />
                <Badge variant="destructive" className="text-xs">
                    Reported Response
                </Badge>
                <span className="text-xs text-destructive">{formatTimestamp(trace.unix_timestamp + 1)}</span>
                </div>
                <blockquote className="text-red-900 dark:text-red-100 leading-relaxed font-medium">
                "{parseBugReportText(trace.agent_response)}"
                </blockquote>

                {/* Show performance metrics for the flagged response */}
                {(trace.llm_metrics || trace.tts_metrics) && (
                <div className="flex gap-3 mt-3 pt-2 border-t border-destructive/30">
                    {trace.llm_metrics?.ttft && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                        <Brain className="w-3 h-3" />
                        LLM: {formatDuration(trace.llm_metrics.ttft * 1000)}
                    </div>
                    )}
                    {trace.tts_metrics?.ttfb && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
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
        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-warning" />
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
                <div className="bg-card rounded-xl border border-warning/30 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-warning/20 bg-warning/10">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-warning/15 text-warning flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-amber-600 text-white">Bug Report #{index + 1}</Badge>
                        <span className="text-sm text-warning">
                            {new Date(report.timestamp * 1000).toLocaleTimeString()}
                        </span>
                        </div>
                    </div>
                    </div>

                    <div className="p-6">
                    <div className="relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full"></div>
                        <div className="pl-6">
                        <blockquote className="text-foreground leading-relaxed text-base">
                            "{parseBugReportText(initialReport)}"
                        </blockquote>
                        </div>
                    </div>
                    </div>
                </div>
                )}

                {/* Additional Details */}
                {additionalDetails.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold">
                        
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
                            <blockquote className="text-foreground leading-relaxed">
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
        <div className="rounded-xl border border-border bg-muted/50 shadow-sm p-4">
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-foreground">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Flagged Turn Details
        </h4>
        <div className="grid grid-cols-1 gap-3">
            <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
            <span className="text-muted-foreground">Turn ID:</span>
            <code className="text-sm bg-muted text-foreground px-2 py-1 rounded">{currentFlaggedTurn.turn_id}</code>
            </div>
            <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
            <span className="text-muted-foreground">Flagged At:</span>
            <span className="text-sm text-foreground">
                {currentFlaggedTurn.flagged_at ? formatTimestamp(currentFlaggedTurn.flagged_at) : "Unknown"}
            </span>
            </div>
            {currentFlaggedTurn.reason && (
            <div className="flex justify-between items-center p-3 bg-card border border-border rounded">
                <span className="text-muted-foreground">Reason:</span>
                <span className="text-sm text-foreground">{currentFlaggedTurn.reason}</span>
            </div>
            )}
        </div>
        </div>
    )}

    {/* Debug Information */}
    <details className="rounded-xl border border-border bg-muted/50 shadow-sm p-4">
        <summary className="cursor-pointer font-medium text-sm text-foreground hover:text-foreground">
        Debug Information
        </summary>
        <div className="mt-3 text-xs">
        <pre className="bg-card text-foreground p-3 rounded border border-border overflow-auto max-h-64">
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