"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Play, Pause, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AudioPlayerProps {
  s3Key: string
  callId: string
  className?: string
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ s3Key, callId, className }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [audioData, setAudioData] = useState<number[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  // Generate waveform data
  const waveformData = useMemo(() => {
    if (audioData.length > 0) return audioData

    const samples = 150
    const data = []

    for (let i = 0; i < samples; i++) {
      const position = i / samples
      const baseFreq = Math.sin(position * Math.PI * 4) * 0.3
      const noise = (Math.random() - 0.5) * 0.4
      const envelope = Math.sin(position * Math.PI) * 0.8
      const speechPattern = Math.sin(position * Math.PI * 12) * 0.6
      const pause = Math.random() > 0.85 ? 0.1 : 1

      let amplitude = (baseFreq + noise + speechPattern) * envelope * pause
      amplitude = Math.max(0.05, Math.min(0.95, Math.abs(amplitude)))
      data.push(amplitude)
    }
    return data
  }, [audioData])

  // Get presigned URL from API
  const getAudioUrl = useCallback(async () => {
    if (audioUrl) return audioUrl

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key }),
      })

      if (!response.ok) throw new Error("Failed to get audio URL")

      const { url } = await response.json()
      setAudioUrl(url)
      return url
    } catch (err) {
      setError("Failed to load audio")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [audioUrl, s3Key])

  // Handle play/pause
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      const url = await getAudioUrl()
      if (url && audioRef.current) {
        if (audioRef.current.src !== url) {
          audioRef.current.src = url
        }
        try {
          await audioRef.current.play()
          setIsPlaying(true)
        } catch (err) {
          setError("Playback failed")
          setIsPlaying(false)
        }
      }
    }
  }, [isPlaying, getAudioUrl])

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData.length) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas
    const barWidth = width / waveformData.length
    const progress = duration > 0 ? currentTime / duration : 0

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw waveform
    waveformData.forEach((amplitude, index) => {
      const barHeight = amplitude * height * 0.8
      const x = index * barWidth
      const y = (height - barHeight) / 2

      const barProgress = index / waveformData.length
      const isPlayed = barProgress <= progress

      // Simple colors
      if (isPlayed) {
        ctx.fillStyle = "#10b981" // emerald-500
      } else {
        ctx.fillStyle = "#d1d5db" // gray-300
      }

      // Draw thin bars
      const barWidthActual = Math.max(1, barWidth * 0.6)
      ctx.fillRect(x, y, barWidthActual, barHeight)
    })

    // Draw progress line
    if (duration > 0 && isReady) {
      const progressX = progress * width
      ctx.strokeStyle = "#10b981"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(progressX, 0)
      ctx.lineTo(progressX, height)
      ctx.stroke()
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [waveformData, currentTime, duration, isPlaying, isReady])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsReady(true)
    }
    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      setError("Playback failed")
      setIsPlaying(false)
    }
    const handleCanPlay = () => setIsReady(true)

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("error", handleError)
    audio.addEventListener("canplay", handleCanPlay)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("error", handleError)
      audio.removeEventListener("canplay", handleCanPlay)
    }
  }, [])

  // Draw waveform effect
  useEffect(() => {
    drawWaveform()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [drawWaveform])

  // Handle waveform click for seeking
  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !isReady || duration === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const newTime = progress * duration

    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (error) {
    return (
      <Card className={cn("p-3 border-destructive/20 bg-destructive/5", className)}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">Audio unavailable</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("p-4 bg-background border", className)}>
      <audio ref={audioRef} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play Button */}
        <Button
          onClick={togglePlay}
          disabled={isLoading}
          size="sm"
          className="w-8 h-8 rounded-full p-0 flex-shrink-0"
          variant="default"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Play className="w-3 h-3 ml-0.5" />
          )}
        </Button>

        {/* Waveform */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={40}
            className="w-full h-10 cursor-pointer rounded"
            onClick={handleWaveformClick}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Time Display */}
        <div className="text-xs text-muted-foreground font-mono flex-shrink-0 min-w-[35px]">
          {formatTime(currentTime)}
        </div>
      </div>
    </Card>
  )
}

export default AudioPlayer
