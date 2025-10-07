import { 
  X, 
  Clock, 
  Activity, 
  Brain, 
  Mic, 
  Volume2, 
  Database, 
  Network, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Copy,
  ExternalLink,
  Zap,
  Code,
  MessageSquare,
  Server,
  Hash,
  User,
  Bot,
  FileText,
  Braces
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useState } from "react";

interface SpanDetailSheetProps {
  span: any;
  isOpen: boolean;
  onClose: () => void;
}

// Improved timestamp formatting function
const formatTimestamp = (timestamp: number | string | null | undefined): string => {
  if (!timestamp) return '';
  
  let date: Date;
  
  try {
    if (typeof timestamp === 'string') {
      // Handle ISO string or other string formats
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle Unix timestamps (both seconds and milliseconds)
      // If the number is less than a reasonable year 2000 timestamp in milliseconds,
      // assume it's in seconds and convert to milliseconds
      const timestampMs = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
      date = new Date(timestampMs);
    } else {
      return '';
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString();
  } catch (error) {
    return '';
  }
};

// Raw Data View Component
const RawDataView = ({ span }: { span: any }) => {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  const getFieldCategory = (key: string) => {
    const identifierFields = ['span_id', 'trace_id', 'request_id', 'parent_span_id', 'session_id'];
    const timeFields = ['created_at', 'captured_at', 'start_time', 'end_time'];
    const metricFields = ['duration_ns', 'duration_ms', 'tokens_used', 'cost_usd'];
    const contentFields = ['name', 'description', 'prompt', 'response', 'output', 'input'];
    const statusFields = ['status', 'error', 'is_error'];
    const configFields = ['operation_type', 'model', 'temperature', 'max_tokens'];

    if (identifierFields.includes(key)) return 'identifiers';
    if (timeFields.includes(key)) return 'timing';
    if (metricFields.includes(key)) return 'metrics';
    if (contentFields.includes(key)) return 'content';
    if (statusFields.includes(key)) return 'status';
    if (configFields.includes(key)) return 'config';
    return 'other';
  };

  const renderFormattedData = () => {
    const entries = Object.entries(span);
    const categorized = {
      identifiers: entries.filter(([key]) => getFieldCategory(key) === 'identifiers'),
      timing: entries.filter(([key]) => getFieldCategory(key) === 'timing'),
      metrics: entries.filter(([key]) => getFieldCategory(key) === 'metrics'),
      content: entries.filter(([key]) => getFieldCategory(key) === 'content'),
      status: entries.filter(([key]) => getFieldCategory(key) === 'status'),
      config: entries.filter(([key]) => getFieldCategory(key) === 'config'),
      other: entries.filter(([key]) => getFieldCategory(key) === 'other'),
    };

    const categoryLabels = {
      identifiers: { title: 'Identifiers', icon: <Hash className="w-4 h-4" />, color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
      timing: { title: 'Timing', icon: <Clock className="w-4 h-4" />, color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
      metrics: { title: 'Metrics', icon: <Activity className="w-4 h-4" />, color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
      content: { title: 'Content', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
      status: { title: 'Status', icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
      config: { title: 'Configuration', icon: <Zap className="w-4 h-4" />, color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
      other: { title: 'Other', icon: <Code className="w-4 h-4" />, color: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
    };

    const renderField = ([key, value]: [string, any]) => {
      const isTimeField = key.includes('time') || key.includes('at');
      const formattedTimestamp = isTimeField ? formatTimestamp(value) : '';
      
      return (
        <div key={key} className="group bg-white dark:bg-gray-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {typeof value}
                </span>
              </div>
              
              <div className="text-sm">
                {typeof value === 'object' && value !== null ? (
                  <details className="group-inner">
                    <summary className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium text-xs mb-2">
                      View Object ({Object.keys(value).length} properties)
                    </summary>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-3 mt-2 border border-slate-200 dark:border-slate-700">
                      <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  </details>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className={`font-medium break-all ${
                      value === null || value === undefined 
                        ? 'text-slate-400 dark:text-slate-500 italic' 
                        : typeof value === 'boolean'
                        ? value ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        : typeof value === 'number'
                        ? 'text-blue-700 dark:text-blue-400'
                        : isTimeField
                        ? 'text-indigo-700 dark:text-indigo-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}>
                      {formatValue(value)}
                    </span>
                    {isTimeField && formattedTimestamp && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {formattedTimestamp}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {(typeof value === 'string' || typeof value === 'number') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(String(value))}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0"
                title="Copy value"
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {Object.entries(categorized).map(([category, fields]) => {
          if (fields.length === 0) return null;
          const config = categoryLabels[category as keyof typeof categoryLabels];
          
          return (
            <div key={category} className={`border rounded-xl p-4 ${config.color}`}>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                {config.icon}
                {config.title}
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">({fields.length})</span>
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {fields.map(renderField)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <Database className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          Raw Span Data
        </h3>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('formatted')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'formatted'
                  ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3 h-3" />
              Formatted
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'raw'
                  ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Braces className="w-3 h-3" />
              Raw JSON
            </button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify(span, null, 2))}
            className="flex items-center gap-2 text-xs"
          >
            <Copy className="w-3 h-3" />
            Copy JSON
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'formatted' ? (
          <div className="pr-1">
            {renderFormattedData()}
          </div>
        ) : (
          <div className="bg-slate-900 dark:bg-gray-950 rounded-lg p-4 min-h-full">
            <pre className="text-green-400 dark:text-green-300 text-xs font-mono whitespace-pre-wrap leading-5 overflow-auto">
{JSON.stringify(span, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const SpanDetailSheet = ({ span, isOpen, onClose }: SpanDetailSheetProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'raw'>('overview');

  if (!isOpen || !span) return null;

  const getSpanIcon = () => {
    const operationType = span.operation_type?.toLowerCase() || '';
    
    if (operationType === 'llm') return <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    if (operationType === 'tts') return <Volume2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
    if (operationType === 'stt') return <Mic className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    if (operationType === 'user_interaction') return <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    if (operationType === 'assistant_interaction') return <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    if (operationType === 'tool') return <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
    if (operationType === 'database') return <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
    return <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
  };

  const getStatusDisplay = () => {
    if (span.status === 'error' || span.error === true) {
      return {
        icon: <XCircle className="w-4 h-4" />,
        text: 'ERROR',
        color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      };
    }
    return {
      icon: <CheckCircle2 className="w-4 h-4" />,
      text: 'SUCCESS',
      color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const statusDisplay = getStatusDisplay();

  // Get readable description of what this span represents
  const getSpanDescription = () => {
    const name = span.name?.toLowerCase() || '';
    const opType = span.operation_type || '';

    if (name === 'start_agent_activity') return 'Agent system initialization - starting conversation flow';
    if (name === 'on_enter') return 'System entry point - beginning of operation';
    if (name === 'assistant_turn') return 'Assistant processing turn - preparing response';
    if (name === 'user_turn') return 'User interaction turn - processing user input';
    if (name === 'user_speaking') return 'User is speaking - audio input detected';
    if (name === 'agent_speaking') return 'Agent is speaking - audio output active';
    if (name === 'llm_node') return 'Language model processing - generating response';
    if (name === 'llm_request') return 'LLM API call - sending request to language model';
    if (name === 'llm_request_run') return 'LLM execution - running language model inference';
    if (name === 'tts_node') return 'Text-to-speech processing - converting text to audio';
    if (name === 'tts_request') return 'TTS API call - generating speech audio';
    if (name === 'tts_request_run') return 'TTS execution - running speech synthesis';
    if (name === 'function_tool') return 'Tool execution - calling external function';
    
    return `${opType} operation: ${name}`.replace('_', ' ');
  };

  // Format timestamp for display with fallback
  const displayTimestamp = formatTimestamp(span?.captured_at);

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-900 dark:to-slate-800 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getSpanIcon()}
            <div>
              <h2 className="text-xl font-semibold">
                {span.name?.replace(/_/g, ' ').toUpperCase() || 'Unknown Operation'}
              </h2>
              <p className="text-slate-300 dark:text-slate-400 text-sm">
                {getSpanDescription()}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 dark:bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm opacity-80">Timestamp</span>
            </div>
            <div className="text-sm font-mono">
              {displayTimestamp || 'Not available'}
            </div>
          </div>
          
          <div className="bg-white/10 dark:bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Server className="w-4 h-4" />
              <span className="text-sm opacity-80">Status</span>
            </div>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${statusDisplay.color} text-xs font-medium`}>
              {statusDisplay.icon}
              {statusDisplay.text}
            </div>
          </div>
          
          <div className="bg-white/10 dark:bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-sm opacity-80">Type</span>
            </div>
            <div className="text-sm font-semibold capitalize">
              {span.operation_type?.replace(/_/g, ' ') || 'Other'}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex">
          {[
            { key: 'overview', label: 'Overview', icon: <MessageSquare className="w-4 h-4" /> },
            { key: 'technical', label: 'Technical', icon: <Code className="w-4 h-4" /> },
            { key: 'raw', label: 'Raw Data', icon: <Database className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* What Happened */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <MessageSquare className="w-4 h-4" />
                What Happened
              </h3>
              <p className="text-blue-900 dark:text-blue-200 text-sm leading-relaxed">
                {getSpanDescription()}
              </p>
            </div>

            {/* Key Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Request ID
                </h4>
                <div className="flex items-center gap-2">
                  {span.request_id ? (
                    <>
                      <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono border border-gray-200 dark:border-gray-600">
                        {span.request_id}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(span.request_id)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">Not available</span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Source
                </h4>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {span.request_id_source || 'Not available'}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                Timeline
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Operation Executed</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {displayTimestamp || 'Time not available'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'technical' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Operation Name</h4>
                <code className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded p-2 text-sm font-mono block text-gray-900 dark:text-gray-100">
                  {span.name || 'Not available'}
                </code>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Operation Type</h4>
                <Badge variant="outline" className="text-sm border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
                  {span.operation_type || 'unknown'}
                </Badge>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Request Identifiers</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Request ID:</span>
                    {span.request_id ? (
                      <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-600">
                        {span.request_id}
                      </code>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Not available</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Source:</span>
                    <span className="text-gray-900 dark:text-gray-100">{span.request_id_source || 'Not available'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Timing Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Captured At:</span>
                    {span.captured_at ? (
                      <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs border border-gray-200 dark:border-gray-600">
                        {span.captured_at}
                      </code>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Not available</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Formatted Time:</span>
                    <span className="text-gray-900 dark:text-gray-100">{displayTimestamp || 'Not available'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <RawDataView span={span} />
        )}
      </div>
    </div>
  );
};

export default SpanDetailSheet;