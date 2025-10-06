import { BarChart3, MessageCircle, Clock, Activity, ChevronDown, ChevronRight, Zap, Brain, Volume2, Mic, User, Bot, Database } from "lucide-react";
import { useState, useMemo } from "react";
import SpanDetailSheet from './SpanDetailSheet';

interface WaterfallViewProps {
  trace: any;
  loading: boolean;
}

interface SpanData {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  captured_at: number;
  duration_ms: number;
  operation_type: string;
  session_id: string;
  attributes: Record<string, any>;
  request_id?: string;
  request_id_source?: string;
}

interface TraceGroup {
  trace_id: string;
  spans: SpanData[];
  root_span: SpanData;
  start_time: number;
  end_time: number;
  duration_ms: number;
  operation_summary: string;
  span_count: number;
  error_count: number;
}

interface WaterfallRow {
  id: string;
  type: 'trace-header' | 'span';
  name: string;
  startTime: number;
  duration: number;
  startPercent: number;
  widthPercent: number;
  level: number;
  rowIndex: number;
  operation_type: string;
  span_count?: number;
  error_count?: number;
  request_id?: string;
  attributes?: Record<string, any>;
}

// Simplified trace grouping logic
const useTraceGrouping = (spans: SpanData[]) => {
  return useMemo(() => {
    if (!spans?.length) return { traceGroups: [], waterfallData: null };

    // Group spans by trace_id
    const traceMap = new Map<string, SpanData[]>();
    spans.forEach(span => {
      if (!span.trace_id) return;
      if (!traceMap.has(span.trace_id)) {
        traceMap.set(span.trace_id, []);
      }
      traceMap.get(span.trace_id)!.push(span);
    });

    // Create trace groups
    const traceGroups: TraceGroup[] = Array.from(traceMap.entries()).map(([traceId, traceSpans]) => {
      const sortedSpans = traceSpans.sort((a, b) => a.captured_at - b.captured_at);
      const rootSpan = sortedSpans.find(s => !s.parent_span_id) || sortedSpans[0];
      
      const startTimes = sortedSpans.map(s => s.captured_at);
      const endTimes = sortedSpans.map(s => s.captured_at + (s.duration_ms / 1000));
      const startTime = Math.min(...startTimes);
      const endTime = Math.max(...endTimes);
      
      const errorCount = sortedSpans.filter(s => 
        s.attributes?.error === true || s.name.includes('error')
      ).length;

      // Summarize operations
      const operations = new Map<string, number>();
      sortedSpans.forEach(span => {
        const opType = span.operation_type || 'other';
        operations.set(opType, (operations.get(opType) || 0) + 1);
      });
      const summary = Array.from(operations.entries())
        .map(([op, count]) => `${count} ${op}`)
        .join(' • ');

      return {
        trace_id: traceId,
        spans: sortedSpans,
        root_span: rootSpan,
        start_time: startTime,
        end_time: endTime,
        duration_ms: (endTime - startTime) * 1000,
        operation_summary: summary || `${sortedSpans.length} operations`,
        span_count: sortedSpans.length,
        error_count: errorCount
      };
    });

    // Sort chronologically
    traceGroups.sort((a, b) => a.start_time - b.start_time);

    // Create waterfall data
    let waterfallData = null;
    if (traceGroups.length > 0) {
      const allStartTimes = traceGroups.map(tg => tg.start_time);
      const allEndTimes = traceGroups.map(tg => tg.end_time);
      const timelineStart = Math.min(...allStartTimes);
      const timelineEnd = Math.max(...allEndTimes);
      const totalDuration = (timelineEnd - timelineStart) * 1000;

      waterfallData = {
        timelineStart,
        timelineEnd,
        totalDuration,
        traceGroups
      };
    }

    return { traceGroups, waterfallData };
  }, [spans]);
};

const WaterfallView = ({ trace, loading }: WaterfallViewProps) => {
  const [selectedSpan, setSelectedSpan] = useState<any>(null);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  // Transform trace data to our format
  const spans: SpanData[] = useMemo(() => {
    if (!trace?.spans?.length) return [];
    
    return trace.spans.map((span: any) => ({
      trace_id: span.trace_id || span.context?.trace_id || 'unknown',
      span_id: span.span_id || span.context?.span_id || span.id || 'unknown',
      parent_span_id: span.parent_span_id || null,
      name: span.name || 'Unknown Operation',
      // FIX: captured_at is already a proper timestamp, don't convert
      captured_at: new Date(span.captured_at).getTime() / 1000, // Convert to Unix seconds
      duration_ms: span.duration_ms || 0,
      operation_type: span.operation_type || 'other',
      session_id: span.session_id || '',
      attributes: span.attributes || {},
      request_id: span.request_id,
      request_id_source: span.request_id_source
    }));
  }, [trace]);

  const { traceGroups, waterfallData } = useTraceGrouping(spans);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin" />
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading timeline...</div>
        </div>
      </div>
    );
  }

  if (!spans.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <div className="text-lg font-medium">No timeline data available</div>
          <div className="text-sm mt-1 max-w-md">
            Execution timeline will appear here when span data is available
          </div>
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const getOperationIcon = (opType: string) => {
    switch (opType) {
      case 'llm': return <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'tts': return <Volume2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'stt': return <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'user_interaction': return <User className="w-4 h-4 text-blue-500 dark:text-blue-300" />;
      case 'assistant_interaction': return <Bot className="w-4 h-4 text-indigo-500 dark:text-indigo-300" />;
      case 'tool': return <Zap className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      default: return <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getSpanColor = (opType: string) => {
    switch (opType) {
      case 'llm': return 'bg-purple-500 dark:bg-purple-600';
      case 'tts': return 'bg-green-500 dark:bg-green-600';
      case 'stt': return 'bg-blue-500 dark:bg-blue-600';
      case 'user_interaction': return 'bg-blue-400 dark:bg-blue-500';
      case 'assistant_interaction': return 'bg-indigo-500 dark:bg-indigo-600';
      case 'tool': return 'bg-orange-500 dark:bg-orange-600';
      default: return 'bg-gray-400 dark:bg-gray-500';
    }
  };

  const toggleTrace = (traceId: string) => {
    const newExpanded = new Set(expandedTraces);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
    }
    setExpandedTraces(newExpanded);
  };

  const totalSpans = traceGroups.reduce((sum, tg) => sum + tg.span_count, 0);
  const totalErrors = traceGroups.reduce((sum, tg) => sum + tg.error_count, 0);
  const totalDuration = waterfallData?.totalDuration || 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trace-based Timeline</h2>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {traceGroups.length} traces • {formatDuration(totalDuration)} total
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-600 dark:text-slate-400">{traceGroups.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Traces</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalSpans}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Spans</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatDuration(totalDuration)}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Duration</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${totalErrors > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {totalErrors}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Errors</div>
            </div>
          </div>
        </div>

        {/* Trace Groups */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {traceGroups.map((traceGroup) => (
            <div key={traceGroup.trace_id}>
              {/* Trace Header */}
              <div 
                className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between group"
                onClick={() => toggleTrace(traceGroup.trace_id)}
              >
                <div className="flex items-center gap-3">
                  {expandedTraces.has(traceGroup.trace_id) ? 
                    <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : 
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  }
                  <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Database className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      Trace {traceGroup.trace_id.substring(2, 10)}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {traceGroup.operation_summary}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatTime(traceGroup.start_time)}</span>
                  <span className="font-mono">{formatDuration(traceGroup.duration_ms)}</span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                    {traceGroup.span_count} spans
                  </span>
                  {traceGroup.error_count > 0 && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                      {traceGroup.error_count} errors
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Spans */}
              {expandedTraces.has(traceGroup.trace_id) && (
                <div className="bg-gray-50/50 dark:bg-gray-800/50">
                  {/* Waterfall Timeline */}
                  <div className="px-12 py-4">
                    <div className="space-y-2">
                      {traceGroup.spans.map((span, index) => {
                        // Calculate position relative to trace start
                        const relativeStart = span.captured_at - traceGroup.start_time;
                        const startPercent = (relativeStart / (traceGroup.duration_ms / 1000)) * 100;
                        const widthPercent = Math.max((span.duration_ms / traceGroup.duration_ms) * 100, 0.5);

                        return (
                          <div 
                            key={`${traceGroup.trace_id}-span-${index}`}
                            className="flex items-center h-8 hover:bg-white dark:hover:bg-gray-700 cursor-pointer rounded group"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSpan(span);
                            }}
                          >
                            {/* Span name */}
                            <div className="w-48 flex items-center gap-2 text-sm pr-4">
                              {getOperationIcon(span.operation_type)}
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                {span.name}
                              </span>
                            </div>
                            
                            {/* Timeline bar container */}
                            <div className="flex-1 relative h-6 bg-gray-200 dark:bg-gray-600 rounded">
                              {/* Span bar */}
                              <div
                                className={`absolute h-full rounded ${getSpanColor(span.operation_type)} opacity-80 hover:opacity-100 transition-all duration-200 group-hover:shadow-sm`}
                                style={{
                                  left: `${startPercent}%`,
                                  width: `${widthPercent}%`,
                                  minWidth: '2px'
                                }}
                                title={`${span.name} - ${formatDuration(span.duration_ms)}`}
                              />
                            </div>

                            {/* Duration and metadata */}
                            <div className="w-32 text-right text-xs text-gray-500 dark:text-gray-400 pl-4">
                              <div className="font-mono">{formatDuration(span.duration_ms)}</div>
                              <div className="text-[10px] uppercase font-medium px-1 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded mt-0.5 inline-block">
                                {span.operation_type}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-8 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Summary</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• {traceGroups.length} distinct traces executed</div>
            <div>• {totalSpans} total operations performed</div>
            <div>• {formatDuration(totalDuration)} total execution time</div>
            {totalErrors > 0 && <div>• {totalErrors} errors encountered</div>}
          </div>
        </div>
      </div>

      {/* Side Sheet */}
      <SpanDetailSheet 
        span={selectedSpan}
        isOpen={!!selectedSpan}
        onClose={() => setSelectedSpan(null)}
      />
    </>
  );
};

export default WaterfallView;