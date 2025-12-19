// src/components/agents/AgentConfig/PasteConfigDialog.tsx
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
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { validateConfigSchema, deserializeConfig, DeserializedConfig } from '@/utils/agentConfigSerializer'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PasteConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyConfig: (config: DeserializedConfig) => void
  isFormDirty: boolean
}

export default function PasteConfigDialog({
  open,
  onOpenChange,
  onApplyConfig,
  isFormDirty
}: PasteConfigDialogProps) {
  const [pastedJson, setPastedJson] = useState<string>('')
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: string[]
  } | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // Validate JSON whenever it changes
  useEffect(() => {
    if (!pastedJson.trim()) {
      setValidationResult(null)
      return
    }

    setIsValidating(true)
    
    // Debounce validation
    const timeoutId = setTimeout(() => {
      try {
        const result = validateConfigSchema(pastedJson)
        setValidationResult(result)
      } catch (error) {
        setValidationResult({
          valid: false,
          errors: ['Failed to validate configuration']
        })
      } finally {
        setIsValidating(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [pastedJson])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPastedJson('')
      setValidationResult(null)
      setIsApplying(false)
    }
  }, [open])

  const handleApply = async () => {
    if (!validationResult?.valid || isFormDirty) {
      return
    }

    setIsApplying(true)

    try {
      const deserializedConfig = deserializeConfig(pastedJson)
      onApplyConfig(deserializedConfig)
      
      // Close dialog after successful application
      setTimeout(() => {
        onOpenChange(false)
        setIsApplying(false)
      }, 500)
    } catch (error) {
      console.error('Failed to apply configuration:', error)
      setValidationResult({
        valid: false,
        errors: ['Failed to apply configuration. Please check the JSON format.']
      })
      setIsApplying(false)
    }
  }

  const canApply = validationResult?.valid && !isFormDirty && pastedJson.trim() && !isApplying

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Paste Agent Configuration</DialogTitle>
          <DialogDescription>
            Paste a configuration JSON from another agent to apply it here
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Warning if form is dirty */}
          {isFormDirty && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have unsaved changes. Please save or discard them before pasting a configuration.
              </AlertDescription>
            </Alert>
          )}

          {/* JSON Textarea */}
          <Textarea
            value={pastedJson}
            onChange={(e) => setPastedJson(e.target.value)}
            placeholder="Paste your configuration JSON here..."
            className="flex-1 min-h-[400px] font-mono text-xs resize-none"
            disabled={isFormDirty}
          />

          {/* Validation Status */}
          {isValidating && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Validating configuration...</span>
            </div>
          )}

          {validationResult && !isValidating && (
            <>
              {validationResult.valid ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    Configuration is valid and ready to apply
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">Configuration errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-gray-500">
              {pastedJson.length.toLocaleString()} characters
            </span>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isApplying}
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleApply}
                disabled={!canApply}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply Configuration'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}