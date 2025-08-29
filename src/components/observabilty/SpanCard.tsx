import { 
    Activity, 
    Brain, 
    Mic, 
    Volume2, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    XCircle, 
    ChevronRight,
    Database,
    Network
  } from "lucide-react";
  import { Badge } from "../ui/badge";
  
  interface SpanCardProps {
    span: any;
    onClick: () => void;
    isGrouped?: boolean;
  }
  
  const SpanCard = ({ span, onClick, isGrouped = false }: SpanCardProps) => {
    const getSpanTypeInfo = (name: string, attributes: any = {}) => {
      // Better OTel span classification
      if (name?.includes('llm') || attributes?.['llm.request.type']) 
        return { icon: <Brain className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-100', category: 'LLM' };
      if (name?.includes('tts') || attributes?.['tts.provider']) 
        return { icon: <Volume2 className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-100', category: 'TTS' };
      if (name?.includes('stt') || attributes?.['stt.provider']) 
        return { icon: <Mic className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-100', category: 'STT' };
      if (name?.includes('database') || attributes?.['db.system']) 
        return { icon: <Database className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-100', category: 'Database' };
      if (name?.includes('http') || attributes?.['http.method']) 
        return { icon: <Network className="w-4 h-4" />, color: 'text-indigo-600', bg: 'bg-indigo-100', category: 'HTTP' };
      return { icon: <Activity className="w-4 h-4" />, color: 'text-gray-600', bg: 'bg-gray-100', category: 'Other' };
    };
  
    const getStatusInfo = (status: any) => {
      if (status?.code === 'ERROR' || status?.code === 2) {
        return { icon: <XCircle className="w-4 h-4 text-red-500" />, text: 'Error', color: 'text-red-600' };
      }
      if (status?.code === 'OK' || status?.code === 1 || !status) {
        return { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, text: 'Success', color: 'text-green-600' };
      }
      return { icon: <AlertCircle className="w-4 h-4 text-yellow-500" />, text: 'Unknown', color: 'text-yellow-600' };
    };
  
    const formatDuration = (durationNs: number) => {
      if (!durationNs) return 'N/A';
      const ms = durationNs / 1_000_000; // Convert nanoseconds to milliseconds
      if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
      if (ms < 1000) return `${ms.toFixed(1)}ms`;
      return `${(ms / 1000).toFixed(2)}s`;
    };
  
    const formatTimestamp = (timestamp: number) => {
      if (!timestamp) return 'N/A';
      // Handle both nanoseconds and milliseconds
      const ms = timestamp > 1e12 ? timestamp / 1_000_000 : timestamp;
      return new Date(ms).toLocaleTimeString();
    };
  
    const typeInfo = getSpanTypeInfo(span.name, span.attributes);
    const statusInfo = getStatusInfo(span.status);
  
    return (
      <div 
        className={`border rounded-lg p-4 bg-white hover:shadow-md cursor-pointer transition-all ${isGrouped ? 'ml-4 border-l-4' : ''}`}
        style={isGrouped ? { borderLeftColor: typeInfo.color.replace('text-', '#').replace('600', '') } : {}}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${typeInfo.bg}`}>
              <div className={typeInfo.color}>{typeInfo.icon}</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">{span.name || 'Unknown Operation'}</div>
              <div className="text-sm text-gray-500">
                {span.attributes?.['service.name'] || 'Unknown Service'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-sm font-mono">{formatDuration(span.duration_ns)}</span>
              </div>
              <div className="text-xs text-gray-500">
                {formatTimestamp(span.start_time_ns)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusInfo.icon}
              <Badge variant={statusInfo.text === 'Error' ? 'destructive' : 'secondary'} className="text-xs">
                {typeInfo.category}
              </Badge>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        
        {span.attributes?.['error.message'] && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {span.attributes['error.message']}
          </div>
        )}
      </div>
    );
  };
  
  export default SpanCard;