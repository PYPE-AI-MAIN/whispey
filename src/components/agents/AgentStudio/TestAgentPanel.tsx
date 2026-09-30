'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, Info, Loader2, MessageSquare, Mic, MicOff, Phone, PhoneOff, RefreshCw, Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Transcript } from '@/hooks/useVoiceAgent'
import MinimalVoicePicker, { VoiceAvatar, useStudioVoices } from './MinimalVoicePicker'
import SessionVariablesPanel from './SessionVariablesPanel'
import LastCallCard, { type LastCallState } from './LastCallCard'

type AgentCallState = 'initializing' | 'listening' | 'thinking' | 'speaking'
type TestTab = 'voice' | 'phone' | 'chat'

const TABS: { id: TestTab; label: string; ready: boolean }[] = [
  { id: 'voice', label: 'Voice', ready: true },
  { id: 'phone', label: 'Phone', ready: false },
  { id: 'chat', label: 'Chat', ready: false },
]

const STATE_LABEL: Record<AgentCallState, string> = {
  initializing: 'Waiting for agent…',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

const BAR_COUNT = 9

function IconTile({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span
      style={{ width: 44, height: 44 }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    >
      {children}
    </span>
  )
}

/** Animated waveform — calm when idle, lively while the agent speaks. */
function Waveform({ state, active }: Readonly<{ state: AgentCallState; active: boolean }>) {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.3))

  useEffect(() => {
    const base = !active ? 0.22 : state === 'speaking' ? 0.75 : state === 'listening' ? 0.4 : state === 'thinking' ? 0.3 : 0.2
    const spread = !active ? 0.12 : state === 'speaking' ? 0.5 : 0.2
    const tick = () =>
      setLevels(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          // taller in the middle, like a voice envelope
          const envelope = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / BAR_COUNT
          return Math.max(0.12, Math.min(1, (base + (Math.random() - 0.5) * spread) * (0.6 + envelope * 0.6)))
        })
      )
    tick()
    const id = setInterval(tick, active ? 140 : 600)
    return () => clearInterval(id)
  }, [state, active])

  return (
    <div className="flex h-16 items-center justify-center gap-1.5" aria-hidden>
      {levels.map((l, i) => (
        <span
          key={i}
          className={cn(
            'w-1.5 rounded-full transition-[height] duration-300 ease-out',
            active ? 'bg-gradient-to-t from-blue-600 to-sky-400' : 'bg-gradient-to-t from-blue-500/50 to-sky-400/50'
          )}
          style={{ height: `${Math.round(l * 64)}px` }}
        />
      ))}
    </div>
  )
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function LiveTranscript({ transcripts, agentName }: Readonly<{ transcripts: Transcript[]; agentName: string }>) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [transcripts])

  if (transcripts.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
        The transcript will appear here as you talk.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {transcripts.map((t) => (
        <div key={t.id} className={cn('flex flex-col', t.speaker === 'user' ? 'items-end' : 'items-start')}>
          <span className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {t.speaker === 'user' ? 'You' : agentName}
          </span>
          <p
            style={{ maxWidth: '85%' }}
            className={cn(
              'rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed',
              t.speaker === 'user'
                ? 'rounded-br-md bg-blue-600 text-white'
                : 'rounded-bl-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
              !t.isFinal && 'opacity-70'
            )}
          >
            {t.text}
          </p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}

// The hook surfaces raw failures ("Failed to start web session: 500 - ...") —
// fine for logs, never for the person testing. Everything is mapped to calm
// plain language with a way forward (retry, or refresh), and shown neutrally
// rather than in error red.
function friendlyConnectionError(raw: string): { text: string; retryable: boolean } {
  if (/reconnecting/i.test(raw)) return { text: 'Connection dropped — reconnecting…', retryable: false }
  if (/microphone access failed/i.test(raw)) {
    return { text: "We couldn't access your microphone. Allow mic access for this site in your browser, then try again.", retryable: true }
  }
  if (/hasn't joined the call/i.test(raw)) {
    return {
      text: "The agent didn't join the call. It may still be starting up — give it a few seconds and try again.",
      retryable: true,
    }
  }
  return { text: 'Something went wrong connecting to the agent. Try again, or refresh the page if it keeps happening.', retryable: true }
}

function ConnectionErrorNotice({
  message, onRetry, className,
}: Readonly<{ message: string; onRetry?: () => void; className?: string }>) {
  const { text, retryable } = friendlyConnectionError(message)
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <p className="flex items-start gap-1.5 text-center text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        <Info className="mt-px h-3 w-3 shrink-0" /> {text}
      </p>
      {retryable && (
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer text-[11px] text-gray-400 underline-offset-2 transition hover:text-gray-600 hover:underline dark:text-gray-500 dark:hover:text-gray-300"
          >
            Refresh page
          </button>
        </div>
      )}
    </div>
  )
}

function EmptyStage({
  icon, title, subtitle, children,
}: Readonly<{ icon: React.ReactNode; title: string; subtitle: string; children?: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      {icon}
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

interface TestAgentPanelProps {
  agentId: string
  agentDisplayName: string
  voiceId: string
  voiceProvider: string
  voiceSaving: boolean
  /** Live stage label from the backend ("Validating config…", "Starting worker…", etc.), or null before it's known. */
  voiceSavingLabel: string | null
  voiceError: string | null
  onVoiceSelect: (voiceId: string, provider: string, model?: string) => void
  defaultVariables: Record<string, string>
  sessionVariables: Record<string, string>
  onVariablesChange: (vars: Record<string, string>) => void
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null
  connectionTime: number
  agentState: AgentCallState
  transcripts: Transcript[]
  isMuted: boolean
  onToggleMute: () => void
  onConnect: () => void
  onDisconnect: () => void
  /** Tears down a stuck room if there is one, then connects again. */
  onRetryConnect?: () => void
  /** Setup values differ from the saved agent, so starting also updates it. */
  hasPendingChanges?: boolean
  callDisabled?: boolean
  lastCallState?: LastCallState
  lastCallHref?: string
  onRetryLastCall?: () => void
}

export default function TestAgentPanel({
  agentId,
  agentDisplayName,
  voiceId,
  voiceProvider,
  voiceSaving,
  voiceSavingLabel,
  voiceError,
  onVoiceSelect,
  defaultVariables,
  sessionVariables,
  onVariablesChange,
  isConnected,
  isConnecting,
  connectionError,
  connectionTime,
  agentState,
  transcripts,
  isMuted,
  onToggleMute,
  onConnect,
  onDisconnect,
  onRetryConnect,
  hasPendingChanges = false,
  callDisabled,
  lastCallState = { status: 'idle' },
  lastCallHref,
  onRetryLastCall,
}: TestAgentPanelProps) {
  const [tab, setTab] = useState<TestTab>('voice')
  const [setupOpen, setSetupOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const { voices, loading: voicesLoading } = useStudioVoices()

  // voiceSavingLabel is now polled continuously by the page regardless of
  // whether THIS page triggered the change — it's non-null for a deploy
  // started externally (e.g. through the MCP) too, not just a local voice
  // pick. Show the same loading state either way, so the call button's
  // disabled state always has a visible reason next to it.
  const isDeploying = voiceSaving || !!voiceSavingLabel

  const inCall = isConnected || isConnecting
  const currentVoice = voices.find((v) => v.id === voiceId && v.provider === voiceProvider)
  const varKeys = Object.keys(sessionVariables)
  const varsSet = varKeys.filter((k) => sessionVariables[k]?.trim()).length

  // Give the transcript the room once a call starts.
  useEffect(() => {
    if (inCall) setSetupOpen(false)
  }, [inCall])

  return (
    // ~65% of the workspace, with a floor AND a ceiling: min-w keeps it usable
    // on a narrow window, max-w stops it from swallowing the whole screen (and
    // the insights column with it) on a wide one. Inline style, not Tailwind's
    // arbitrary-value classes — those weren't taking effect in practice.
    <aside
      style={{ flexBasis: '65%', minWidth: 420, maxWidth: 820 }}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Toolbar — same tab treatment as the Overview's channel switcher */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <div className="flex items-center gap-1" role="tablist" aria-label="Test channel">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => !inCall && setTab(t.id)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                tab === t.id
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300',
                inCall && tab !== t.id && 'cursor-not-allowed opacity-50'
              )}
            >
              {t.label}
              {!t.ready && (
                <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-normal uppercase tracking-wide text-gray-400 dark:bg-gray-800/80 dark:text-gray-500">
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
        {isConnected && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live · {formatTimer(connectionTime)}
          </span>
        )}
      </div>

      {/* Stage */}
      {tab === 'voice' && !inCall && lastCallState.status === 'idle' && (
        <EmptyStage
          icon={<Waveform state="initializing" active={false} />}
          title={`Talk to ${agentDisplayName}`}
          subtitle="Start a browser call to hear exactly how the agent sounds right now."
        >
          {connectionError && (
            <ConnectionErrorNotice message={connectionError} onRetry={onRetryConnect ?? onConnect} />
          )}
        </EmptyStage>
      )}

      {tab === 'voice' && !inCall && lastCallState.status !== 'idle' && (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          {connectionError && (
            <ConnectionErrorNotice
              className="mb-3"
              message={connectionError}
              onRetry={onRetryConnect ?? onConnect}
            />
          )}
          <LastCallCard state={lastCallState} observabilityHref={lastCallHref} onRetry={onRetryLastCall} />
        </div>
      )}

      {tab === 'voice' && inCall && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col items-center gap-1 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <Waveform state={agentState} active={isConnected} />
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
              {(isConnecting || agentState === 'initializing') && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              )}
              {isConnecting ? 'Connecting…' : STATE_LABEL[agentState]}
            </p>
            {connectionError && (
              <ConnectionErrorNotice className="mt-1" message={connectionError} onRetry={onRetryConnect} />
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <LiveTranscript transcripts={transcripts} agentName={agentDisplayName} />
          </div>
        </div>
      )}

      {tab === 'phone' && (
        <EmptyStage
          icon={<IconTile><Phone className="h-5 w-5" /></IconTile>}
          title="Call a phone number"
          subtitle="The agent will ring this number so you can test it on a real line."
        >
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+91 98765 43210"
            style={{ maxWidth: 260 }}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-center text-sm tabular-nums text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </EmptyStage>
      )}

      {tab === 'chat' && (
        <EmptyStage
          icon={<IconTile><MessageSquare className="h-5 w-5" /></IconTile>}
          title="Chat with the agent"
          subtitle="Test the same agent over text — useful for checking the flow without a mic."
        />
      )}

      {/* Setup — collapsed to a one-line summary, like a settings drawer */}
      <div className="shrink-0 px-4 pb-3">
        <div
          className={cn(
            'overflow-hidden rounded-xl border transition-all duration-300',
            setupOpen
              ? 'border-gray-300 shadow-md dark:border-gray-700'
              : 'border-gray-200 dark:border-gray-800'
          )}
        >
          <button
            onClick={() => setSetupOpen((o) => !o)}
            aria-expanded={setupOpen}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <Settings2
              style={{ transition: 'transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)', transform: setupOpen ? 'rotate(90deg)' : 'none' }}
              className="h-3.5 w-3.5 text-gray-400"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Setup</span>
            <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              <VoiceAvatar voice={currentVoice} size="sm" />
              <span className="truncate">{currentVoice?.name ?? 'Voice'}</span>
              {varKeys.length > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">|</span>
                  <span className="shrink-0 font-mono">{`{} ${varsSet}/${varKeys.length}`}</span>
                </>
              )}
            </span>
            <ChevronDown
              style={{ transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)', transform: setupOpen ? 'rotate(180deg)' : 'none' }}
              className="h-3.5 w-3.5 shrink-0 text-gray-400"
            />
          </button>

          {/* Height animates via the 0fr → 1fr grid-row trick; content fades and
              slides in slightly behind it. Stays mounted so variables seed on load. */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: setupOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            inert={!setupOpen}
          >
            <div style={{ minHeight: 0, overflow: 'hidden' }}>
              <div
                style={{
                  maxHeight: 300,
                  opacity: setupOpen ? 1 : 0,
                  transform: setupOpen ? 'translateY(0)' : 'translateY(-6px)',
                  transition: setupOpen
                    ? 'opacity 240ms ease 80ms, transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1) 40ms'
                    : 'opacity 150ms ease, transform 200ms ease',
                }}
                className="space-y-4 overflow-y-auto border-t border-gray-100 px-3 py-3 dark:border-gray-800"
              >
                <section>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Voice
                  </p>
                  <MinimalVoicePicker
                    voices={voices}
                    loading={voicesLoading}
                    selectedVoiceId={voiceId}
                    selectedProvider={voiceProvider}
                    onSelect={onVoiceSelect}
                    disabled={isDeploying || inCall}
                  />
                  {isDeploying && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> {voiceSavingLabel ?? 'Applying — the agent is restarting with your changes…'}
                    </p>
                  )}
                  {voiceError && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <Info className="h-3 w-3 shrink-0" /> {voiceError}
                    </p>
                  )}
                </section>
                <section>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Variables
                  </p>
                  <SessionVariablesPanel
                    agentId={agentId}
                    defaultVariables={defaultVariables}
                    onChange={onVariablesChange}
                  />
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <div className="shrink-0 border-t border-gray-200 p-4 dark:border-gray-800">
        {tab === 'voice' && inCall ? (
          <div className="flex gap-2">
            <button
              onClick={onToggleMute}
              disabled={!isConnected}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={cn(
                'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50',
                isMuted
                  ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={onDisconnect}
              style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
              className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold shadow-sm transition hover:brightness-110 active:brightness-90"
            >
              <PhoneOff className="h-4 w-4" />
              End call
            </button>
          </div>
        ) : (
          <button
            onClick={tab === 'voice' ? onConnect : undefined}
            disabled={tab !== 'voice' || callDisabled || isDeploying}
            // Colours are inline (theme tokens) rather than disabled: variants —
            // those didn't apply here, so the button stayed blue and looked
            // clickable while an update was running.
            style={
              tab !== 'voice' || callDisabled || isDeploying
                ? { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', boxShadow: 'none', cursor: 'not-allowed' }
                : { backgroundColor: '#2563eb', color: '#ffffff' }
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors enabled:cursor-pointer enabled:hover:brightness-110"
          >
            {tab === 'voice' && isDeploying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tab === 'chat' ? (
              <MessageSquare className="h-4 w-4" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {tab === 'voice'
              ? isDeploying
                ? (voiceSavingLabel ?? 'Updating agent…')
                : hasPendingChanges
                  ? 'Update and start'
                  : 'Start call'
              : tab === 'phone'
                ? 'Place call — soon'
                : 'Start chat — soon'}
          </button>
        )}
      </div>
    </aside>
  )
}
