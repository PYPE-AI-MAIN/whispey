import { Activity, MessageCircle, ChevronDown, ChevronRight, User, Bot, Settings, ChevronsUpDown } from "lucide-react";
import { useState, useMemo } from "react";
import SpanDetailSheet from './SpanDetailSheet';
import { useSessionSpans } from "@/hooks/useSessionTrace";

interface SessionTraceViewProps {
  trace: any;
  loading: boolean;
}

interface ConversationTurn {
  id: string;
  type: 'session_management' | 'user_turn' | 'assistant_turn';
  title: string;
  spans: any[];
  startTime: number;
  duration: number;
  mainSpan: any;
}

const SessionTraceView = ({ trace, loading }: SessionTraceViewProps) => {
  const [selectedSpan, setSelectedSpan] = useState<any>(null);
  const [expandedTurns, setExpandedTurns] = useState<Set<string>>(new Set());

  const { data: spans, loading: spansLoading } = useSessionSpans(trace);

  // Helper functions defined before useMemo
  const getTurnType = (span: any): ConversationTurn['type'] => {
    const name = span.name?.toLowerCase() || '';
    if (name === 'user_turn') return 'user_turn';
    if (name === 'assistant_turn') return 'assistant_turn';
    return 'session_management';
  };

  const getTurnTitle = (span: any): string => {
    const name = span.name?.toLowerCase() || '';
    switch (name) {
      case 'user_turn': return `user_turn`;
      case 'assistant_turn': return `assistant_turn`;
      case 'start_agent_activity': return 'start_agent_activity';
      case 'drain_agent_activity': return 'drain_agent_activity';
      default: return span.name || 'Unknown';
    }
  };

  const createTurn = (spans: any[], type: ConversationTurn['type'], title: string, id: string): ConversationTurn => {
    const startTimes = spans.map(s => s.captured_at || 0).filter(t => t > 0);
    const startTime = startTimes.length > 0 ? Math.min(...startTimes) : 0;
    
    const totalDuration = spans.reduce((sum, span) => {
      return sum + (span.duration_ms || 0);
    }, 0);
    
    return {
      id,
      type,
      title,
      spans: spans,
      startTime,
      duration: totalDuration,
      mainSpan: spans[0]
    };
  };

  // Memoized turns to prevent infinite re-renders
  const turns = useMemo(() => {
    if (!spans?.length) return [];

    // Use spans instead of trace.spans
    const sortedSpans = [...spans].sort((a, b) => a.start_time_ns - b.start_time_ns);

    // Build span hierarchy
    const spanMap = new Map();
    sortedSpans.forEach(span => {
      const spanId = span.span_id || span.id;
      spanMap.set(spanId, { ...span, children: [], level: 0, spanId });
    });

    // Create parent-child relationships and calculate levels
    sortedSpans.forEach(span => {
      const spanId = span.span_id || span.id;
      const parentId = span.parent_span_id;
      const spanData = spanMap.get(spanId);
      
      if (parentId && spanMap.has(parentId)) {
        const parent = spanMap.get(parentId);
        parent.children.push(spanData);
        spanData.level = parent.level + 1;
      }
    });

    // Find root spans and flatten hierarchy while maintaining nesting levels
    const flattenSpan = (span: any): any[] => {
      const result = [span];
      if (span.children && span.children.length > 0) {
        span.children
          .sort((a: any, b: any) => (a.captured_at || a.start_time_ns || 0) - (b.captured_at || b.start_time_ns || 0))
          .forEach((child: any) => {
            result.push(...flattenSpan(child));
          });
      }
      return result;
    };

    const rootSpans = Array.from(spanMap.values()).filter(span => 
      !span.parent_span_id || !spanMap.has(span.parent_span_id)
    );

    const orderedSpans = rootSpans
      .sort((a: any, b: any) => (a.captured_at || a.start_time_ns || 0) - (b.captured_at || b.start_time_ns || 0))
      .flatMap(span => flattenSpan(span));

    // Create conversation turn groups
    const turnGroups: ConversationTurn[] = [];
    let currentTurnSpans: any[] = [];

    orderedSpans.forEach((span) => {
      const spanName = span.name?.toLowerCase() || '';
      
      // Check if this span starts a new turn
      const isNewTurn = spanName === 'user_turn' || 
                       spanName === 'assistant_turn' || 
                       spanName === 'start_agent_activity' || 
                       spanName === 'drain_agent_activity';

      if (isNewTurn) {
        // Finalize previous turn if exists
        if (currentTurnSpans.length > 0) {
          const turnType = getTurnType(currentTurnSpans[0]);
          const title = getTurnTitle(currentTurnSpans[0]);
          const id = `turn-${turnGroups.length + 1}-${turnType}`;
          turnGroups.push(createTurn(currentTurnSpans, turnType, title, id));
        }

        // Start new turn
        currentTurnSpans = [span];
      } else if (currentTurnSpans.length > 0) {
        // Add to current turn if we're inside one
        currentTurnSpans.push(span);
      }
    });

    // Handle the final turn
    if (currentTurnSpans.length > 0) {
      const turnType = getTurnType(currentTurnSpans[0]);
      const title = getTurnTitle(currentTurnSpans[0]);
      const id = `turn-${turnGroups.length + 1}-${turnType}`;
      turnGroups.push(createTurn(currentTurnSpans, turnType, title, id));
    }

    return turnGroups;
  }, [spans])

  useMemo(() => {
    if (turns.length > 0) {
      setExpandedTurns(new Set(turns.map(turn => turn.id)));
    }
  }, [turns]);


  if (loading || spansLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Activity className="w-4 h-4 mx-auto mb-2 opacity-50 animate-spin" />
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading session trace...</div>
        </div>
      </div>
    );
  }

  if (!spans?.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No trace data available</div>
          <div className="text-sm mt-1">OpenTelemetry spans will appear here</div>
        </div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const toggleTurn = (turnId: string) => {
    const newExpanded = new Set(expandedTurns);
    if (newExpanded.has(turnId)) {
      newExpanded.delete(turnId);
    } else {
      newExpanded.add(turnId);
    }
    setExpandedTurns(newExpanded);
  };

  const toggleAllTurns = () => {
    if (expandedTurns.size === turns.length) {
      // All are expanded, collapse all
      setExpandedTurns(new Set());
    } else {
      // Some or none are expanded, expand all
      setExpandedTurns(new Set(turns.map(turn => turn.id)));
    }
  };

  const getTurnIcon = (type: ConversationTurn['type']) => {
    switch (type) {
      case 'user_turn': return <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
      case 'assistant_turn': return <Bot className="w-3 h-3 text-green-600 dark:text-green-400" />;
      case 'session_management': return <Settings className="w-3 h-3 text-gray-600 dark:text-gray-400" />;
      default: return <Activity className="w-3 h-3 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getOperationColor = (operationType: string) => {
    switch (operationType?.toLowerCase()) {
      case 'llm': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'tts': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'user_interaction': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'assistant_interaction': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'tool': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'other': return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
    }
  };

  // Check if span has children in next spans
  const hasChildren = (currentSpan: any, allSpans: any[], currentIndex: number) => {
    for (let i = currentIndex + 1; i < allSpans.length; i++) {
      if (allSpans[i].level <= currentSpan.level) break;
      if (allSpans[i].level === currentSpan.level + 1) return true;
    }
    return false;
  };

  // Check if this is the last child at this level
  const isLastChildAtLevel = (currentSpan: any, allSpans: any[], currentIndex: number) => {
    for (let i = currentIndex + 1; i < allSpans.length; i++) {
      const nextSpan = allSpans[i];
      if (nextSpan.level < currentSpan.level) return true;
      if (nextSpan.level === currentSpan.level) return false;
    }
    return true;
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {/* Compact Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session Trace</h2>
            <div className="flex items-center justify-center gap-2">
              <div className="flex items-center">
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-2"></div>
                <button
                  onClick={toggleAllTurns}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title={expandedTurns.size === turns.length ? "Collapse all turns" : "Expand all turns"}
                >
                  <ChevronsUpDown className="w-3 h-3" />
                  <span className="font-medium">
                    {expandedTurns.size === turns.length ? "Collapse All" : "Expand All"}
                  </span>
                </button>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {turns.length} turns • {spans?.length || 0} spans
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-800">
          {turns.map((turn) => (
            <div key={turn.id} className="border-b border-gray-100 dark:border-gray-700">
              {/* Turn Header */}
              <div 
                className="px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm border-l-2 border-l-slate-400 bg-slate-200 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600"
                onClick={() => toggleTurn(turn.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedTurns.has(turn.id) ? 
                    <ChevronDown className="w-3 h-3 text-slate-600 dark:text-slate-400" /> : 
                    <ChevronRight className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                  }
                  {getTurnIcon(turn.type)}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{turn.title}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded-md font-medium">
                    {formatDuration(turn.duration)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <span>{turn.spans.length} spans</span>
                </div>
              </div>

              {/* Nested Spans with Tree Lines */}
              {expandedTurns.has(turn.id) && (
                <div className="bg-gray-50/30 dark:bg-gray-800/50 relative">
                  {turn.spans.map((span, index) => {
                    const isLast = isLastChildAtLevel(span, turn.spans, index);
                    const hasChildSpans = hasChildren(span, turn.spans, index);
                    
                    return (
                      <div 
                        key={`${turn.id}-${index}-${span.spanId || span.name}`}
                        className="hover:bg-white dark:hover:bg-gray-700 cursor-pointer border-l-2 border-l-transparent hover:border-l-blue-300 dark:hover:border-l-blue-500 text-sm transition-colors relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSpan(span);
                        }}
                      >
                        {/* Tree connector lines */}
                        <div className="absolute left-0 top-0 h-full pointer-events-none">
                          {/* Draw vertical lines for each parent level */}
                          {Array.from({ length: span.level }, (_, levelIndex) => {
                            const isCurrentLevel = levelIndex === span.level - 1;
                            const xPosition = (levelIndex + 1) * 20 + 4;
                            
                            return (
                              <div key={levelIndex}>
                                {/* Vertical line */}
                                {!isCurrentLevel && (
                                  <div
                                    className="absolute bg-gray-300 dark:bg-gray-600"
                                    style={{
                                      left: `${xPosition}px`,
                                      top: 0,
                                      width: '1px',
                                      height: '100%'
                                    }}
                                  />
                                )}
                                
                                {/* Current level connectors */}
                                {isCurrentLevel && (
                                  <>
                                    {/* Vertical line (top half if not first, bottom half if has children) */}
                                    <div
                                      className="absolute bg-gray-300 dark:bg-gray-600"
                                      style={{
                                        left: `${xPosition}px`,
                                        top: index === 0 ? '50%' : 0,
                                        width: '1px',
                                        height: index === 0 ? (hasChildSpans ? '50%' : 0) : (isLast ? '50%' : '100%')
                                      }}
                                    />
                                    
                                    {/* Horizontal line to span */}
                                    <div
                                      className="absolute bg-gray-300 dark:bg-gray-600"
                                      style={{
                                        left: `${xPosition}px`,
                                        top: '50%',
                                        width: '12px',
                                        height: '1px'
                                      }}
                                    />
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        <div 
                          className="py-1.5 flex items-center justify-between relative z-10"
                          style={{ paddingLeft: `${span.level * 20 + 20}px`, paddingRight: '12px' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Expand/collapse indicator for spans with children */}
                            {hasChildSpans ? (
                              <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            )}
                            
                            <span className="text-gray-900 dark:text-gray-100 truncate">
                              {span.name || 'unknown'}
                            </span>

                            {span.operation_type && (
                              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${getOperationColor(span.operation_type)}`}>
                                {span.operation_type}
                              </span>
                            )}

                            {span.duration_ms !== undefined && span.duration_ms !== null && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0">
                                {formatDuration(span.duration_ms)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
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

export default SessionTraceView;