import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Plays one voice preview at a time. `fetchAudio` returns the audio blob, so the hook
 * stays provider-agnostic: each provider's panel supplies its own request.
 */
export function useVoicePreview() {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setPlayingId(null)
  }, [])

  // Don't keep talking after the dialog closes.
  useEffect(() => stop, [stop])

  const toggle = useCallback(
    async (id: string, fetchAudio: () => Promise<Blob>) => {
      if (playingId === id) {
        stop()
        return
      }
      stop()
      setLoadingId(id)
      try {
        const blob = await fetchAudio()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        urlRef.current = url
        setPlayingId(id)

        // onerror can fire spuriously after playback has begun; only report a failure
        // when nothing was ever heard.
        let started = false
        audio.onplaying = () => {
          started = true
        }
        audio.onended = stop
        audio.onerror = () => {
          if (started) return
          stop()
          toast.error('Failed to play audio preview')
        }
        await audio.play().catch(() => {
          if (started) return
          stop()
          toast.error('Browser blocked audio playback — try clicking again')
        })
      } catch (err: any) {
        toast.error(err?.message || 'Failed to preview voice')
      } finally {
        setLoadingId(null)
      }
    },
    [playingId, stop],
  )

  return { playingId, loadingId, toggle, stop }
}
