"use client"

import { useState, useEffect } from "react"
import { Loader2, FileText, Mic, Volume2, Brain, Code } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfigTabProps {
  sessionId?: string
}

interface AgentConfig {
  log_id: string
  agent_id: string
  project_id: string
  full_config?: {
    agent?: {
      assistant?: Array<{
        prompt?: string
        stt?: {
          name?: string
          language?: string
          model?: string
        }
        tts?: {
          name?: string
          language?: string
          model?: string
          voice_id?: string
          voice_settings?: any
        }
        llm?: {
          provider?: string
          name?: string
          model?: string
          temperature?: number
          api_key_env?: string
        }
      }>
    }
  }
}

const ConfigTab: React.FC<ConfigTabProps> = ({ sessionId }) => {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    const fetchConfig = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/agent-config-by-log-id/${sessionId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Agent config not found for this session")
          } else {
            setError("Failed to fetch agent config")
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        setConfig(data)
      } catch (err: any) {
        console.error("Error fetching config:", err)
        setError("Error loading configuration")
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Loading configuration...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-xs text-muted-foreground">{error}</div>
      </div>
    )
  }

  if (!config || !config.full_config?.agent?.assistant?.[0]) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-xs text-muted-foreground">No configuration available</div>
      </div>
    )
  }

  const assistant = config.full_config.agent.assistant[0]
  const prompt = assistant.prompt || ""
  const stt = assistant.stt
  const tts = assistant.tts
  const llm = assistant.llm

  return (
    <div className="p-4 space-y-3">
      {/* LLM Configuration */}
      {llm && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-medium text-muted-foreground">LLM Configuration</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Provider:</span>
              <span className="ml-2 font-medium text-foreground">{llm.provider || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium text-foreground">{llm.name || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2 font-medium text-foreground">{llm.model || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Temperature:</span>
              <span className="ml-2 font-medium text-foreground">{llm.temperature ?? "N/A"}</span>
            </div>
            {llm.api_key_env && (
              <div className="col-span-2">
                <span className="text-muted-foreground">API Key Env:</span>
                <span className="ml-2 font-medium text-foreground">{llm.api_key_env}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STT Configuration */}
      {stt && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-success" />
            <h3 className="text-xs font-medium text-muted-foreground">STT Configuration</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium text-foreground">{stt.name || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Language:</span>
              <span className="ml-2 font-medium text-foreground">{stt.language || "N/A"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2 font-medium text-foreground">{stt.model || "N/A"}</span>
            </div>
          </div>
        </div>
      )}

      {/* TTS Configuration */}
      {tts && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-medium text-muted-foreground">TTS Configuration</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <span className="ml-2 font-medium text-foreground">{tts.name || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Language:</span>
              <span className="ml-2 font-medium text-foreground">{tts.language || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2 font-medium text-foreground">{tts.model || "N/A"}</span>
            </div>
            {tts.voice_id && (
              <div>
                <span className="text-muted-foreground">Voice ID:</span>
                <span className="ml-2 font-medium text-foreground">{tts.voice_id}</span>
              </div>
            )}
            {tts.voice_settings && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Voice Settings:</span>
                <pre className="mt-1.5 p-1.5 bg-muted/50 rounded text-[11px] overflow-x-auto">
                  {JSON.stringify(tts.voice_settings, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompt Configuration */}
      {prompt && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-warning" />
            <h3 className="text-xs font-medium text-muted-foreground">Prompt</h3>
          </div>
          <div className="mt-1.5">
            <pre className="p-2.5 bg-muted/50 rounded-lg text-xs text-foreground whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
              {prompt}
            </pre>
          </div>
        </div>
      )}

      {/* Raw Config (for debugging) */}
      <details className="rounded-xl border border-border bg-card shadow-sm p-3">
        <summary className="cursor-pointer text-xs font-medium text-foreground flex items-center gap-2">
          <Code className="w-3.5 h-3.5" />
          Raw Configuration (JSON)
        </summary>
        <pre className="mt-2 p-2.5 bg-muted/50 rounded-lg text-[11px] overflow-x-auto max-h-96 overflow-y-auto">
          {JSON.stringify(config.full_config, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default ConfigTab

