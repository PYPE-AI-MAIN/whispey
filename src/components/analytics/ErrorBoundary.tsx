/**
 * One broken chart must not take the dashboard with it.
 *
 * Everything else on this screen already fails in isolation: the query route
 * gives each chart its own status so a slow one fails alone while the rest
 * draw, every fetch is wrapped, and a spec the compiler rejects comes back as
 * that card's error. None of that helps if the *render* throws — React unmounts
 * the whole tree from the nearest boundary up, and with no boundary anywhere in
 * the app that meant a blank page. A saved chart from an older version, a
 * charting library meeting a shape it does not like, a field that changed type
 * under a card: all of them are one thrown error away from losing everything.
 *
 * So each card gets a boundary. The card that threw says so and offers to try
 * again; the other eleven keep working.
 */
'use client'
import React from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = { children: React.ReactNode; label?: string; onReset?: () => void }
type State = { error: Error | null }

export class ChartErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // the card shows a sentence; the console keeps the stack that explains it
    console.error('[analytics] chart render failed', this.props.label ?? '', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    // editing the chart is the most likely fix, so a change clears the error
    // rather than leaving a card stuck until the page is reloaded
    if (this.state.error && prev.children !== this.props.children) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
        <AlertTriangle className="h-4 w-4 text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This chart could not be drawn.{this.props.label ? ` (${this.props.label})` : ''}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Try again
        </button>
      </div>
    )
  }
}
