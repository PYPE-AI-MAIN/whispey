import { OTEL_ATTRIBUTES, OTelSpan, SpanTypeInfo, StatusInfo } from "@/types/openTelemetry";
import { 
    Activity, 
    Brain, 
    Mic, 
    Volume2, 
    Database, 
    Network,
    AlertCircle, 
    CheckCircle2, 
    XCircle
  } from "lucide-react";
  
  export const getSpanTypeInfo = (name: string, attributes: any = {}): SpanTypeInfo => {
    // Better OTel span classification based on semantic conventions
    if (name?.includes('llm') || attributes?.[OTEL_ATTRIBUTES.LLM_REQUEST_TYPE]) 
      return { 
        icon: Brain({ className: "w-4 h-4" }), 
        color: 'text-purple-600', 
        bg: 'bg-purple-100', 
        category: 'LLM' 
      };
    
    if (name?.includes('tts') || attributes?.[OTEL_ATTRIBUTES.TTS_PROVIDER]) 
      return { 
        icon: Volume2({ className: "w-4 h-4" }), 
        color: 'text-green-600', 
        bg: 'bg-green-100', 
        category: 'TTS' 
      };
    
    if (name?.includes('stt') || attributes?.[OTEL_ATTRIBUTES.STT_PROVIDER]) 
      return { 
        icon: Mic({ className: "w-4 h-4" }), 
        color: 'text-blue-600', 
        bg: 'bg-blue-100', 
        category: 'STT' 
      };
    
    if (name?.includes('database') || attributes?.[OTEL_ATTRIBUTES.DB_SYSTEM]) 
      return { 
        icon: Database({ className: "w-4 h-4" }), 
        color: 'text-orange-600', 
        bg: 'bg-orange-100', 
        category: 'Database' 
      };
    
    if (name?.includes('http') || attributes?.[OTEL_ATTRIBUTES.HTTP_METHOD]) 
      return { 
        icon: Network({ className: "w-4 h-4" }), 
        color: 'text-indigo-600', 
        bg: 'bg-indigo-100', 
        category: 'HTTP' 
      };
    
    return { 
      icon: Activity({ className: "w-4 h-4" }), 
      color: 'text-gray-600', 
      bg: 'bg-gray-100', 
      category: 'Other' 
    };
  };
  
  export const getStatusInfo = (status: any): StatusInfo => {
    if (status?.code === 'ERROR' || status?.code === 2) {
      return { 
        icon: XCircle({ className: "w-4 h-4 text-red-500" }), 
        text: 'Error', 
        color: 'text-red-600' 
      };
    }
    
    if (status?.code === 'OK' || status?.code === 1 || !status) {
      return { 
        icon: CheckCircle2({ className: "w-4 h-4 text-green-500" }), 
        text: 'Success', 
        color: 'text-green-600' 
      };
    }
    
    return { 
      icon: AlertCircle({ className: "w-4 h-4 text-yellow-500" }), 
      text: 'Unknown', 
      color: 'text-yellow-600' 
    };
  };
  
  export const formatDuration = (durationNs: number): string => {
    if (!durationNs) return 'N/A';
    
    const ms = durationNs / 1_000_000; // Convert nanoseconds to milliseconds
    
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };
  
  export const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'N/A';
    
    // Handle both nanoseconds and milliseconds
    const ms = timestamp > 1e12 ? timestamp / 1_000_000 : timestamp;
    return new Date(ms).toLocaleTimeString();
  };
  
  export const formatFullTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'N/A';
    
    // Handle both nanoseconds and milliseconds
    const ms = timestamp > 1e12 ? timestamp / 1_000_000 : timestamp;
    return new Date(ms).toLocaleString();
  };
  
  export const groupSpans = (spans: OTelSpan[], groupType: 'service' | 'operation' | 'none'): Record<string, OTelSpan[]> => {
    if (groupType === 'none') return { 'All Spans': spans };
    
    return spans.reduce((groups: Record<string, OTelSpan[]>, span: OTelSpan) => {
      let key = '';
      
      if (groupType === 'service') {
        key = span.attributes?.[OTEL_ATTRIBUTES.SERVICE_NAME] || 'Unknown Service';
      } else if (groupType === 'operation') {
        if (span.name?.includes('llm') || span.attributes?.[OTEL_ATTRIBUTES.LLM_REQUEST_TYPE]) {
          key = 'LLM Operations';
        } else if (span.name?.includes('tts') || span.attributes?.[OTEL_ATTRIBUTES.TTS_PROVIDER]) {
          key = 'Text-to-Speech';
        } else if (span.name?.includes('stt') || span.attributes?.[OTEL_ATTRIBUTES.STT_PROVIDER]) {
          key = 'Speech-to-Text';
        } else if (span.attributes?.[OTEL_ATTRIBUTES.DB_SYSTEM]) {
          key = 'Database Operations';
        } else if (span.attributes?.[OTEL_ATTRIBUTES.HTTP_METHOD]) {
          key = 'HTTP Requests';
        } else {
          key = 'Other Operations';
        }
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(span);
      return groups;
    }, {});
  };
  
  export const calculateTraceMetrics = (spans: OTelSpan[]) => {
    const totalDuration = spans.reduce((sum, span) => sum + (span.duration_ns || 0), 0) / 1_000_000; // ms
    const errorCount = spans.filter(s => s.status?.code === 'ERROR' || s.status?.code === 2).length;
    const llmCount = spans.filter(s => s.name?.includes('llm') || s.attributes?.[OTEL_ATTRIBUTES.LLM_REQUEST_TYPE]).length;
    const ttsCount = spans.filter(s => s.name?.includes('tts') || s.attributes?.[OTEL_ATTRIBUTES.TTS_PROVIDER]).length;
    const sttCount = spans.filter(s => s.name?.includes('stt') || s.attributes?.[OTEL_ATTRIBUTES.STT_PROVIDER]).length;
    
    return {
      totalSpans: spans.length,
      totalDuration,
      errorCount,
      llmCount,
      ttsCount,
      sttCount,
    };
  };