import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { RayaVoice } from '@/lib/tts/raya'

export type RayaVoicesStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface RayaVoicesState {
  status: RayaVoicesStatus
  voices: RayaVoice[]
  error: string | null
  /** Machine-readable failure from /api/raya-voices: not_configured | invalid_key | upstream_error. */
  errorCode: string | null
}

// One catalogue shared by every dialog on the page. A config screen mounts several
// <SelectTTS> (primary, fallback, dynamic switches); without this each would call Raya.
let state: RayaVoicesState = { status: 'idle', voices: [], error: null, errorCode: null }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

const SERVER_SNAPSHOT: RayaVoicesState = { status: 'idle', voices: [], error: null, errorCode: null }

function setState(next: RayaVoicesState) {
  state = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function load(forceRefresh: boolean) {
  if (inflight) return inflight
  // Keep showing the previous list while a refresh runs.
  setState({ ...state, status: 'loading', error: null, errorCode: null })
  inflight = (async () => {
    try {
      const response = await fetch(`/api/raya-voices${forceRefresh ? '?refresh=1' : ''}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setState({
          status: 'error',
          voices: state.voices,
          error: data?.error || 'Failed to load Raya voices',
          errorCode: data?.code || null,
        })
        return
      }
      setState({ status: 'ready', voices: data.voices || [], error: null, errorCode: null })
    } catch {
      setState({ status: 'error', voices: state.voices, error: 'Could not reach the server', errorCode: 'network' })
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Raya's voice catalogue. Pass `enabled` to defer the request until the list is needed
 * (the dialog opening, or an agent already using Raya), so pages without Raya never call it.
 */
export function useRayaVoices(enabled: boolean) {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT)

  useEffect(() => {
    if (enabled && state.status === 'idle') void load(false)
  }, [enabled])

  const refresh = useCallback(() => load(true), [])
  return { ...snapshot, refresh }
}

/** Test seam: resets the module store between tests. */
export function __resetRayaVoicesForTests() {
  inflight = null
  state = { status: 'idle', voices: [], error: null, errorCode: null }
  listeners.clear()
}
