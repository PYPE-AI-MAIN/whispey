"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Play, Pause, Loader2, AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface AudioPlayerProps {
  s3Key: string
  callId: string
  className?: string
  url: string | null
  segmentStartTime?: number
  segmentDuration?: number
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ s3Key, url, callId, className, segmentStartTime, segmentDuration }) => {

  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [audioData, setAudioData] = useState<number[]>([])
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [downloadFileName, setDownloadFileName] = useState("")
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [segmentStarted, setSegmentStarted] = useState(false)

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
  
    // First, try to use the direct URL if provided
    if (url) {
      try {
        // Test if the URL is accessible using our proxy API
        const testResponse = await fetch('/api/audio-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, method: 'HEAD' })
        })

        const result = await testResponse.json()
        console.log('Audio proxy response:', result)

        if (testResponse.ok && result.accessible) {
          // Prefer a fresh/resigned URL returned by proxy if present
          if (result.url) {
            setAudioUrl(result.url)
            setIsLoading(false)
            return result.url
          }
          // Otherwise, stream via proxy GET
          const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(url)}`
          setAudioUrl(proxyUrl)
          setIsLoading(false)
          return proxyUrl
        }
      } catch (err) {
        console.log('Proxy URL test failed, falling back to S3 key extraction')
      }
    }
  
    // If direct URL fails or is not provided, try server re-sign with URL first
    try {
      if (url) {
        const response = await fetch("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
        if (response.ok) {
          const { url: s3Url } = await response.json()
          setAudioUrl(s3Url)
          return s3Url
        }
      }
      // Fallback to S3 key extraction
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key }),
      })
  
      if (!response.ok) throw new Error("Failed to get audio URL")
  
      const { url: s3Url } = await response.json()
      setAudioUrl(s3Url)
      return s3Url
    } catch (err) {
      setError("Failed to load audio")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [audioUrl, url, s3Key])

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
        
        // If we have segment parameters, seek to the start time
        if (segmentStartTime !== undefined && !segmentStarted) {
          // Wait for metadata to load, then seek to segment start
          const handleLoadedMetadata = () => {
            if (audioRef.current && segmentStartTime !== undefined) {
              // Ensure we don't seek beyond the audio duration
              const seekTime = Math.min(segmentStartTime, audioRef.current.duration || 0)
              audioRef.current.currentTime = seekTime
              setSegmentStarted(true)
              audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata)
            }
          }
          
          // If metadata is already loaded, seek immediately
          if (audioRef.current.readyState >= 1) {
            handleLoadedMetadata()
          } else {
            audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata)
          }
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
  }, [isPlaying, getAudioUrl, segmentStartTime, segmentStarted])

  // Generate default filename
  const getDefaultFileName = useCallback(() => {
    if (s3Key) {
      // Handle both S3 keys and full URLs
      let key = s3Key
      
      // If it's a full URL, extract just the key part
      if (s3Key.includes('amazonaws.com')) {
        try {
          const url = new URL(s3Key)
          // Remove the bucket name and get just the key path
          const pathParts = url.pathname.split('/')
          // Skip the first empty part and bucket name
          key = pathParts.slice(2).join('/')
        } catch (e) {
          console.error('Failed to parse S3 URL:', e)
        }
      }
      
      // Extract filename from the key and convert to .mp3
      const keyParts = key.split('/')
      const fileName = keyParts[keyParts.length - 1]
      if (fileName && fileName.includes('.')) {
        // Replace any extension with .mp3
        const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'))
        return `${nameWithoutExtension}.mp3`
      }
    }
    return `call-${callId}.mp3`
  }, [s3Key, callId])

  // Ensure filename has proper extension
  const getDownloadFileName = useCallback((userFileName: string) => {
    // If user provided a filename with extension, use it as is
    if (userFileName.includes('.')) {
      return userFileName
    }
    
    // Always add .mp3 extension by default
    return `${userFileName}.mp3`
  }, [])

  // Extract clean S3 key from URL or key
  const getCleanS3Key = useCallback(() => {
    if (!s3Key) return null
    
    // If it's already a clean key (no URL), return as is
    if (!s3Key.includes('amazonaws.com')) {
      // Also handle cases where a bare key was URL-encoded and/or has query params appended
      const withoutQuery = s3Key.split('?')[0]
      try {
        // Decode percent-encoding once; do NOT translate '+' to space
        const decodedOnce = decodeURIComponent(withoutQuery)
        return decodedOnce
      } catch {
        return withoutQuery
      }
    }
    
    // If it's a full URL, extract just the key part
    try {
      const url = new URL(s3Key)
      const pathname = url.pathname || '/'
      const host = url.hostname

      // Handle virtual-hosted–style: https://<bucket>.s3.<region>.amazonaws.com/<key>
      // In this case, the key is the pathname without the leading '/'
      const isVirtualHosted = /\.s3[.-][^./]+\.amazonaws\.com$/i.test(host) || /\.s3\.amazonaws\.com$/i.test(host)
      if (isVirtualHosted) {
        // URL.pathname is already percent-decoded in WHATWG URL
        return pathname.replace(/^\/+/, '')
      }

      // Handle path-style: https://s3.<region>.amazonaws.com/<bucket>/<key>
      // Split on '/' and drop the leading empty segment and bucket segment
      const parts = pathname.split('/') // ['', 'bucket', 'key', ...]
      return parts.slice(2).join('/')
    } catch (e) {
      console.error('Failed to parse S3 URL:', e)
      return null
    }
  }, [s3Key])

  // Handle download dialog open
  const handleDownloadClick = useCallback(async () => {
    setDownloadDialogOpen(true)
    setDownloadFileName(getDefaultFileName())
    
    try {
      const url = await getAudioUrl()
      setDownloadUrl(url)
    } catch (err) {
      console.error('Failed to get download URL:', err)
      setError("Failed to prepare download")
    }
  }, [getAudioUrl, getDefaultFileName])

  // Handle actual download
  const handleDownload = useCallback(async () => {
    if (!downloadUrl || isDownloading) return
    
    setIsDownloading(true)
    setError(null)
    
    try {
      // Ensure filename has proper extension
      const finalFileName = getDownloadFileName(downloadFileName)

      // If we have a direct/presigned URL, route via proxy GET to avoid CORS and preserve filename
      if (downloadUrl.includes('amazonaws.com')) {
        const proxy = `/api/audio-proxy?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(finalFileName)}`
        const link = document.createElement('a')
        link.href = proxy
        link.download = finalFileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setDownloadDialogOpen(false)
        return
      }

      // Fallback: use our API with a clean S3 key
      const cleanS3Key = getCleanS3Key()
      if (!cleanS3Key) {
        throw new Error("Invalid S3 key")
      }
      const downloadApiUrl = `/api/audio-download?s3Key=${encodeURIComponent(cleanS3Key)}&filename=${encodeURIComponent(finalFileName)}`
      const link = document.createElement('a')
      link.href = downloadApiUrl
      link.download = finalFileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setDownloadDialogOpen(false)
    } catch (err) {
      console.error('Download failed:', err)
      setError("Download failed: " + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsDownloading(false)
    }
  }, [downloadUrl, downloadFileName, isDownloading, getCleanS3Key, getDownloadFileName])

  // Handle dialog close
  const handleDialogClose = useCallback(() => {
    setDownloadDialogOpen(false)
    setDownloadFileName("")
    setDownloadUrl(null)
    setError(null)
  }, [])

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

      // Theme-aware colors for waveform
      if (isPlayed) {
        ctx.fillStyle = "#10b981" // emerald-500 (same for both themes)
      } else {
        // Use different colors for light/dark theme
        const isDark = document.documentElement.classList.contains('dark')
        ctx.fillStyle = isDark ? "#4b5563" : "#d1d5db" // gray-600 dark, gray-300 light
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

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      
      // Check if we've reached the end of the segment
      if (segmentStartTime !== undefined && segmentDuration !== undefined) {
        const segmentEndTime = segmentStartTime + segmentDuration
        // Add a small buffer (0.1s) to ensure we don't miss the end
        if (audio.currentTime >= segmentEndTime - 0.1) {
          audio.pause()
          setIsPlaying(false)
          setCurrentTime(segmentEndTime)
        }
      }
    }
    
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
  }, [segmentStartTime, segmentDuration])

  // Reset segment state when parameters change
  useEffect(() => {
    setSegmentStarted(false)
    setCurrentTime(0)
    setIsPlaying(false)
    setError(null) // Clear any previous errors
  }, [segmentStartTime, segmentDuration])

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
      <Card className={cn("p-3 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20", className)}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400">Audio unavailable</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn("p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700", className)}>
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

        {/* Download Button with Dialog */}
        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleDownloadClick}
              disabled={isLoading}
              size="sm"
              className="w-8 h-8 rounded-full p-0 flex-shrink-0"
              variant="outline"
              title="Download audio file"
            >
              <Download className="w-3 h-3" />
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Download className="w-5 h-5" />
                Download Audio File
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File Name Input */}
              <div className="space-y-2">
                <Label htmlFor="filename" className="text-gray-700 dark:text-gray-300">File Name</Label>
                <Input
                  id="filename"
                  value={downloadFileName}
                  onChange={(e) => setDownloadFileName(e.target.value)}
                  placeholder="Enter file name..."
                  className="font-mono text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  File will be downloaded as MP3 format
                </p>
              </div>

              {/* URL Preview */}
              {downloadUrl && (
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Download Source</Label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                      {downloadUrl.includes('amazonaws.com') ? 'AWS S3 URL' : 'Direct URL'}
                    </p>
                    <p className="text-xs font-mono break-all mt-1 text-gray-600 dark:text-gray-300">
                      {downloadUrl.length > 50 ? `${downloadUrl.substring(0, 50)}...` : downloadUrl}
                    </p>
                  </div>
                </div>
              )}

              {/* Download Instructions */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Download Instructions:</strong>
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                  <li>• Click "Download" to download the audio file</li>
                  <li>• The .mp3 extension will be added automatically if not provided</li>
                  <li>• File will be saved to your Downloads folder</li>
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading || !downloadUrl || !downloadFileName.trim()}
                  className="flex-1"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDialogClose}
                  disabled={isDownloading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Waveform */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={40}
            className="w-full h-10 cursor-pointer rounded bg-gray-50 dark:bg-gray-700"
            onClick={handleWaveformClick}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>

        {/* Time Display */}
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 min-w-[35px]">
          {formatTime(currentTime)}
        </div>
      </div>
    </Card>
  )
}

export default AudioPlayer