'use client'

interface TranscriptMessageProps {
  speaker: 'user' | 'agent'
  text: string
  timestamp: Date
  agentName: string
}

export function TranscriptMessage({ speaker, text, timestamp, agentName }: TranscriptMessageProps) {
  const isUser = speaker === 'user'
  
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600/20 border border-blue-500/30'
            : 'bg-gray-800/50 border border-gray-700/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-xs font-semibold uppercase ${
            isUser ? 'text-blue-400' : 'text-gray-400'
          }`}>
            {isUser ? 'You' : agentName}
          </span>
          <span className="text-xs text-gray-500">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className={`text-sm leading-relaxed ${
          isUser ? 'text-blue-100' : 'text-white'
        }`}>
          {text}
        </p>
      </div>
    </div>
  )
}
