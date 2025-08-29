// trace-grouping-utils.ts
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
  
  interface ConversationTurnWithTraces {
    turn_id: string;
    user_transcript?: string;
    agent_response?: string;
    timestamp: number;
    matched_traces: TraceGroup[];
    unmatched_spans: SpanData[];
  }
  
  class TraceGroupingEngine {
    
    /**
     * Main entry point: Process session spans into trace groups
     */
    groupSessionSpans(spans: SpanData[]): {
      traceGroups: TraceGroup[];
      orphanedSpans: SpanData[];
    } {
      console.log(`Processing ${spans.length} spans into trace groups`);
      
      // Group spans by trace_id
      const traceMap = new Map<string, SpanData[]>();
      const orphanedSpans: SpanData[] = [];
      
      spans.forEach(span => {
        if (!span.trace_id) {
          orphanedSpans.push(span);
          return;
        }
        
        if (!traceMap.has(span.trace_id)) {
          traceMap.set(span.trace_id, []);
        }
        traceMap.get(span.trace_id)!.push(span);
      });
  
      // Convert to TraceGroup objects
      const traceGroups: TraceGroup[] = Array.from(traceMap.entries()).map(([traceId, traceSpans]) => {
        return this.createTraceGroup(traceId, traceSpans);
      });
  
      // Sort trace groups chronologically
      traceGroups.sort((a, b) => a.start_time - b.start_time);
      
      console.log(`Created ${traceGroups.length} trace groups with ${orphanedSpans.length} orphaned spans`);
      
      return { traceGroups, orphanedSpans };
    }
  
    /**
     * Match trace groups to conversation turns
     */
    matchTracesToTurns(
      traceGroups: TraceGroup[], 
      conversationTurns: any[],
      timeWindowSeconds = 30
    ): ConversationTurnWithTraces[] {
      
      const result: ConversationTurnWithTraces[] = [];
      const usedTraces = new Set<string>();
      
      // Sort turns chronologically
      const sortedTurns = [...conversationTurns].sort((a, b) => {
        const aTime = this.getTurnTimestamp(a);
        const bTime = this.getTurnTimestamp(b);
        return aTime - bTime;
      });
  
      sortedTurns.forEach(turn => {
        const turnTime = this.getTurnTimestamp(turn);
        const matchedTraces: TraceGroup[] = [];
        const unMatchedSpans: SpanData[] = [];
  
        // Find traces within time window
        traceGroups.forEach(traceGroup => {
          if (usedTraces.has(traceGroup.trace_id)) return;
          
          const timeDiff = Math.abs(traceGroup.start_time - turnTime);
          if (timeDiff <= timeWindowSeconds) {
            matchedTraces.push(traceGroup);
            usedTraces.add(traceGroup.trace_id);
          }
        });
  
        result.push({
          turn_id: turn.turn_id,
          user_transcript: turn.user_transcript,
          agent_response: turn.agent_response,
          timestamp: turnTime,
          matched_traces: matchedTraces,
          unmatched_spans: unMatchedSpans
        });
      });
  
      // Handle unmatched traces as separate entries
      const unmatchedTraces = traceGroups.filter(tg => !usedTraces.has(tg.trace_id));
      unmatchedTraces.forEach(traceGroup => {
        result.push({
          turn_id: `trace-${traceGroup.trace_id.substring(0, 8)}`,
          timestamp: traceGroup.start_time,
          matched_traces: [traceGroup],
          unmatched_spans: []
        });
      });
  
      return result.sort((a, b) => a.timestamp - b.timestamp);
    }
  
    /**
     * Create waterfall data for visualization
     */
    createWaterfallData(traceGroups: TraceGroup[]): {
      timelineStart: number;
      timelineEnd: number;
      totalDuration: number;
      waterfallRows: WaterfallRow[];
    } {
      if (traceGroups.length === 0) {
        return {
          timelineStart: 0,
          timelineEnd: 0,
          totalDuration: 0,
          waterfallRows: []
        };
      }
  
      // Calculate overall timeline
      const allStartTimes = traceGroups.map(tg => tg.start_time);
      const allEndTimes = traceGroups.map(tg => tg.end_time);
      const timelineStart = Math.min(...allStartTimes);
      const timelineEnd = Math.max(...allEndTimes);
      const totalDuration = (timelineEnd - timelineStart) * 1000; // Convert to ms
  
      const waterfallRows: WaterfallRow[] = [];
      let rowIndex = 0;
  
      traceGroups.forEach(traceGroup => {
        // Add trace header row
        waterfallRows.push({
          id: `trace-${traceGroup.trace_id}`,
          type: 'trace-header',
          name: `Trace ${traceGroup.trace_id.substring(0, 8)}`,
          startTime: traceGroup.start_time,
          duration: traceGroup.duration_ms,
          startPercent: ((traceGroup.start_time - timelineStart) / (timelineEnd - timelineStart)) * 100,
          widthPercent: (traceGroup.duration_ms / totalDuration) * 100,
          level: 0,
          rowIndex: rowIndex++,
          operation_type: 'trace',
          span_count: traceGroup.span_count,
          error_count: traceGroup.error_count
        });
  
        // Add span rows (hierarchically organized)
        const hierarchyRows = this.buildSpanHierarchy(traceGroup, timelineStart, timelineEnd, totalDuration);
        hierarchyRows.forEach(row => {
          row.rowIndex = rowIndex++;
          waterfallRows.push(row);
        });
      });
  
      return {
        timelineStart,
        timelineEnd,
        totalDuration,
        waterfallRows
      };
    }
  
    // Private helper methods
  
    private createTraceGroup(traceId: string, spans: SpanData[]): TraceGroup {
      // Sort spans chronologically
      const sortedSpans = spans.sort((a, b) => a.captured_at - b.captured_at);
      
      // Find root span (no parent or earliest)
      const rootSpan = this.findRootSpan(sortedSpans);
      
      // Calculate timing
      const startTimes = sortedSpans.map(s => s.captured_at);
      const endTimes = sortedSpans.map(s => s.captured_at + (s.duration_ms / 1000));
      const startTime = Math.min(...startTimes);
      const endTime = Math.max(...endTimes);
      
      // Count errors
      const errorCount = sortedSpans.filter(s => 
        s.attributes?.error === true || 
        s.name.includes('error') ||
        s.operation_type === 'error'
      ).length;
  
      return {
        trace_id: traceId,
        spans: sortedSpans,
        root_span: rootSpan,
        start_time: startTime,
        end_time: endTime,
        duration_ms: (endTime - startTime) * 1000,
        operation_summary: this.summarizeTraceOperations(sortedSpans),
        span_count: sortedSpans.length,
        error_count: errorCount
      };
    }
  
    private findRootSpan(spans: SpanData[]): SpanData {
      // Look for span with no parent
      const rootSpan = spans.find(span => !span.parent_span_id);
      if (rootSpan) return rootSpan;
      
      // Look for "start_agent_activity" or similar root operations
      const startSpan = spans.find(span => 
        span.name === 'start_agent_activity' || 
        span.name === 'session_start' ||
        span.name.includes('start')
      );
      if (startSpan) return startSpan;
      
      // Fallback to earliest span
      return spans[0];
    }
  
    private summarizeTraceOperations(spans: SpanData[]): string {
      const operations = new Map<string, number>();
      
      spans.forEach(span => {
        const opType = span.operation_type || 'other';
        operations.set(opType, (operations.get(opType) || 0) + 1);
      });
  
      const parts: string[] = [];
      operations.forEach((count, opType) => {
        if (count > 0) {
          parts.push(`${count} ${opType}`);
        }
      });
  
      return parts.join(' • ') || `${spans.length} operations`;
    }
  
    private getTurnTimestamp(turn: any): number {
      const timestamp = turn.timestamp || turn.created_at || turn.unix_timestamp;
      if (timestamp instanceof Date) {
        return timestamp.getTime() / 1000;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp).getTime() / 1000;
      }
      return timestamp || 0;
    }
  
    private buildSpanHierarchy(
      traceGroup: TraceGroup, 
      timelineStart: number, 
      timelineEnd: number, 
      totalDuration: number
    ): WaterfallRow[] {
      const rows: WaterfallRow[] = [];
      const spanMap = new Map<string, SpanData>();
      
      // Create span lookup map
      traceGroup.spans.forEach(span => {
        spanMap.set(span.span_id, span);
      });
  
      // Build hierarchy starting from root
      const buildRecursive = (span: SpanData, level: number = 1) => {
        const startPercent = ((span.captured_at - timelineStart) / (timelineEnd - timelineStart)) * 100;
        const widthPercent = Math.max((span.duration_ms / totalDuration) * 100, 0.1); // Minimum width
  
        rows.push({
          id: span.span_id,
          type: 'span',
          name: span.name,
          startTime: span.captured_at,
          duration: span.duration_ms,
          startPercent,
          widthPercent,
          level,
          rowIndex: 0, // Will be set later
          operation_type: span.operation_type,
          request_id: span.request_id,
          attributes: span.attributes
        });
  
        // Find children
        const children = traceGroup.spans.filter(s => s.parent_span_id === span.span_id);
        children.forEach(child => buildRecursive(child, level + 1));
      };
  
      buildRecursive(traceGroup.root_span);
      return rows;
    }
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
  
  // Usage example:
  export const useTraceGrouping = () => {
    const engine = new TraceGroupingEngine();
    
    const processSessionSpans = (spans: SpanData[]) => {
      return engine.groupSessionSpans(spans);
    };
  
    const matchToTurns = (traceGroups: TraceGroup[], turns: any[]) => {
      return engine.matchTracesToTurns(traceGroups, turns);
    };
  
    const createWaterfall = (traceGroups: TraceGroup[]) => {
      return engine.createWaterfallData(traceGroups);
    };
  
    return {
      processSessionSpans,
      matchToTurns,
      createWaterfall
    };
  };
  
  export default TraceGroupingEngine;