'use client'

import React from 'react'
import { Loader2, BarChart2, MessageSquare, Tag, TrendingUp, TrendingDown, Minus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DailyTranscript } from '@/hooks/useDailyVoiceAgent'

// ── Types ────────────────────────────────────────────────────────────────────

interface TurnAnalysis {
  id: string
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number
}

export interface CallAnalysisResult {
  summary: string
  overallSentiment: 'positive' | 'neutral' | 'negative'
  callOutcome: string
  topics: string[]
  turns: TurnAnalysis[]
}

interface CallAnalyticsProps {
  transcripts: DailyTranscript[]
  analysis: CallAnalysisResult | null
  isAnalyzing: boolean
  error: string | null
  onRetry: () => void
  onDismiss: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  positive: {
    label: 'Positive',
    icon: TrendingUp,
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
  },
  neutral: {
    label: 'Neutral',
    icon: Minus,
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    dot: 'bg-gray-400',
  },
  negative: {
    label: 'Negative',
    icon: TrendingDown,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
  },
} as const

function SentimentBadge({ sentiment, size = 'sm' }: { sentiment: 'positive' | 'neutral' | 'negative'; size?: 'xs' | 'sm' }) {
  const cfg = SENTIMENT_CONFIG[sentiment]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${cfg.badge} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {cfg.label}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.6 ? 'bg-green-400' : score >= 0.4 ? 'bg-gray-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="flex gap-2 mt-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        ))}
      </div>
      <div className="space-y-2 mt-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CallAnalytics({
  transcripts,
  analysis,
  isAnalyzing,
  error,
  onRetry,
  onDismiss,
}: CallAnalyticsProps) {
  const turnMap = React.useMemo(() => {
    const m = new Map<string, TurnAnalysis>()
    analysis?.turns.forEach(t => m.set(t.id, t))
    return m
  }, [analysis])

  const overallCfg = analysis ? SENTIMENT_CONFIG[analysis.overallSentiment] : null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4 flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <BarChart2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Call Analytics</span>
          {isAnalyzing && (
            <div className="flex items-center gap-1 text-xs text-violet-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Analyzing…</span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Loading skeleton */}
      {isAnalyzing && <AnalysisSkeleton />}

      {/* Error */}
      {!isAnalyzing && error && (
        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 text-xs text-red-600 hover:text-red-700 gap-1">
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Analysis result */}
      {!isAnalyzing && analysis && (
        <div className="space-y-4">

          {/* Overall sentiment + outcome row */}
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${overallCfg!.bg} ${overallCfg!.border}`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${overallCfg!.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <SentimentBadge sentiment={analysis.overallSentiment} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Overall</span>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{analysis.callOutcome}</p>
            </div>
          </div>

          {/* Summary */}
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Summary</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Topics */}
          {analysis.topics.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Tag className="w-3 h-3 text-gray-400" />
                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Key Topics</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.topics.map(topic => (
                  <span
                    key={topic}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[11px] font-medium border border-violet-100 dark:border-violet-800"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Per-turn transcript with sentiment */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <MessageSquare className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Turn-by-Turn</p>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {transcripts.map(turn => {
                const ta = turnMap.get(turn.id)
                const isUser = turn.speaker === 'user'
                return (
                  <div
                    key={turn.id}
                    className={`rounded-lg px-3 py-2 text-xs border ${
                      isUser
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isUser ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {isUser ? 'User' : 'Agent'}
                      </span>
                      {ta && <SentimentBadge sentiment={ta.sentiment} size="xs" />}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{turn.text}</p>
                    {ta && <ScoreBar score={ta.score} />}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
