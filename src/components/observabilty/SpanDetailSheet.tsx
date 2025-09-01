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
    Bot
  } from "lucide-react";
  import { Button } from "../ui/button";
  import { Badge } from "../ui/badge";
  import { useState } from "react";
  
  interface SpanDetailSheetProps {
    span: any;
    isOpen: boolean;
    onClose: () => void;
  }
  
  const SpanDetailSheet = ({ span, isOpen, onClose }: SpanDetailSheetProps) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'raw'>('overview');
  
    if (!isOpen || !span) return null;
  
    const formatTimestamp = (timestamp: number) => {
      if (!timestamp) return 'N/A';
      return new Date(timestamp * 1000).toLocaleString();
    };
  
    const getSpanIcon = () => {
      const operationType = span.operation_type?.toLowerCase() || '';
      
      if (operationType === 'llm') return <Brain className="w-5 h-5 text-purple-600" />;
      if (operationType === 'tts') return <Volume2 className="w-5 h-5 text-green-600" />;
      if (operationType === 'stt') return <Mic className="w-5 h-5 text-blue-600" />;
      if (operationType === 'user_interaction') return <User className="w-5 h-5 text-purple-600" />;
      if (operationType === 'assistant_interaction') return <Bot className="w-5 h-5 text-blue-600" />;
      if (operationType === 'tool') return <Zap className="w-5 h-5 text-orange-600" />;
      if (operationType === 'database') return <Database className="w-5 h-5 text-orange-600" />;
      return <Activity className="w-5 h-5 text-gray-600" />;
    };
  
    const getStatusDisplay = () => {
      if (span.status === 'error' || span.error === true) {
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: 'ERROR',
          color: 'text-red-600 bg-red-50 border-red-200'
        };
      }
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        text: 'SUCCESS',
        color: 'text-green-600 bg-green-50 border-green-200'
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
  
    return (
      <div className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl border-l z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {getSpanIcon()}
              <div>
                <h2 className="text-xl font-semibold">
                  {span.name?.replace(/_/g, ' ').toUpperCase() || 'Unknown Operation'}
                </h2>
                <p className="text-slate-300 text-sm">
                  {getSpanDescription()}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="w-5 h-5" />
            </Button>
          </div>
  
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm opacity-80">Timestamp</span>
              </div>
              {/* <div className="text-sm font-mono">
                {formatTimestamp(span?.captured_at || 0)}
              </div> */}
            </div>
            
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4" />
                <span className="text-sm opacity-80">Status</span>
              </div>
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${statusDisplay.color} text-xs font-medium`}>
                {statusDisplay.icon}
                {statusDisplay.text}
              </div>
            </div>
            
            <div className="bg-white/10 rounded-lg p-3">
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
        <div className="border-b bg-gray-50">
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
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
  
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* What Happened */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                  <MessageSquare className="w-4 h-4" />
                  What Happened
                </h3>
                <p className="text-blue-900 text-sm leading-relaxed">
                  {getSpanDescription()}
                </p>
              </div>
  
              {/* Key Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Request ID
                  </h4>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded text-xs font-mono border">
                      {span.request_id || 'N/A'}
                    </code>
                    {span.request_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(span.request_id)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
  
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Source
                  </h4>
                  <span className="text-sm">
                    {span.request_id_source || 'Unknown'}
                  </span>
                </div>
              </div>
  
              {/* Timeline */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  Timeline
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <div className="text-sm font-medium">Operation Executed</div>
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(span.captured_at || 0)}
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
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Operation Name</h4>
                  <code className="bg-white border rounded p-2 text-sm font-mono block">
                    {span.name || 'N/A'}
                  </code>
                </div>
  
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Operation Type</h4>
                  <Badge variant="outline" className="text-sm">
                    {span.operation_type || 'unknown'}
                  </Badge>
                </div>
  
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Request Identifiers</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Request ID:</span>
                      <code className="bg-white px-2 py-1 rounded text-xs">
                        {span.request_id || 'N/A'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Source:</span>
                      <span>{span.request_id_source || 'N/A'}</span>
                    </div>
                  </div>
                </div>
  
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Timing Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Captured At:</span>
                      <code className="bg-white px-2 py-1 rounded text-xs">
                        {span.captured_at || 'N/A'}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Formatted Time:</span>
                      <span>{formatTimestamp(span.captured_at || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
  
          {activeTab === 'raw' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Raw Span Data</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(span, null, 2))}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </Button>
              </div>
              <div className="bg-slate-900 rounded-xl p-4 overflow-auto">
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
  {JSON.stringify(span, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  export default SpanDetailSheet;