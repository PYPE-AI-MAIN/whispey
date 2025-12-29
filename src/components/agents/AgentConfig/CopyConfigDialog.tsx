// src/components/agents/AgentConfig/CopyConfigDialog.tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckIcon, CopyIcon, Loader2 } from 'lucide-react'
import { serializeConfig, prettyPrintConfig, SerializedAgentConfig } from '@/utils/agentConfigSerializer'

interface CopyConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formikValues: any
  ttsConfig: any
  sttConfig: any
  azureConfig: any
  selfHostedLLMConfig?: any
}

export default function CopyConfigDialog({
  open,
  onOpenChange,
  formikValues,
  ttsConfig,
  sttConfig,
  azureConfig,
  selfHostedLLMConfig
}: CopyConfigDialogProps) {
  const [configJson, setConfigJson] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (open) {
      setIsGenerating(true)
      setIsCopied(false)
      
      // Generate config JSON
      try {
        const serialized = serializeConfig(
          formikValues,
          ttsConfig,
          sttConfig,
          azureConfig,
          selfHostedLLMConfig
        )
        const prettyJson = prettyPrintConfig(serialized)
        setConfigJson(prettyJson)
      } catch (error) {
        console.error('Failed to serialize config:', error)
        setConfigJson('Error generating configuration')
      } finally {
        setIsGenerating(false)
      }
    }
  }, [open, formikValues, ttsConfig, sttConfig, azureConfig, selfHostedLLMConfig])

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(configJson)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = configJson
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } catch (err2) {
        console.error('Fallback copy failed:', err2)
      }
      document.body.removeChild(textArea)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Copy Agent Configuration</DialogTitle>
          <DialogDescription>
            Copy this configuration JSON to paste into another agent
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {isGenerating ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <Textarea
                value={configJson}
                readOnly
                className="flex-1 min-h-[400px] font-mono text-xs resize-none"
                placeholder="Configuration JSON will appear here..."
              />

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-gray-500">
                  {configJson.length.toLocaleString()} characters
                </span>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                  
                  <Button
                    onClick={handleCopyToClipboard}
                    disabled={!configJson || configJson.includes('Error')}
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}