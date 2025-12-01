'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface WebhookSettingsProps {
  triggerOnCallLog: boolean
  webhookUrl: string
  httpMethod: string
  headers: Record<string, string>
  isActive: boolean
  onFieldChange: (field: string, value: any) => void
  agentId?: string
  projectId?: string
}

function WebhookSettings({
  triggerOnCallLog,
  webhookUrl,
  httpMethod,
  headers,
  isActive,
  onFieldChange,
  agentId,
  projectId
}: WebhookSettingsProps) {
  const [headerEntries, setHeaderEntries] = useState<Array<{ key: string; value: string }>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [initialState, setInitialState] = useState<{
    triggerOnCallLog: boolean
    webhookUrl: string
    httpMethod: string
    headers: Record<string, string>
    isActive: boolean
  } | null>(null)
  // Local state for display - populated from database, separate from form state
  const [displayState, setDisplayState] = useState<{
    triggerOnCallLog: boolean
    webhookUrl: string
    httpMethod: string
    headers: Record<string, string>
    isActive: boolean
  } | null>(null)
  const currentAgentId = agentId || ''
  const currentProjectId = projectId || ''
  
  // Use display state if available, otherwise use props
  const effectiveTriggerOnCallLog = displayState?.triggerOnCallLog ?? triggerOnCallLog
  const effectiveWebhookUrl = displayState?.webhookUrl ?? webhookUrl
  const effectiveHttpMethod = displayState?.httpMethod ?? httpMethod
  const effectiveHeaders = displayState?.headers ?? headers
  const effectiveIsActive = displayState?.isActive ?? isActive

  // Load existing webhook config on mount
  useEffect(() => {
    if (currentAgentId && currentProjectId) {
      loadWebhookConfig()
    }
  }, [currentAgentId, currentProjectId])

  // Check if there are changes compared to initial state
  // Use effective values (from displayState or props) for comparison
  const hasChanges = () => {
    if (!initialState) return false
    
    // Compare all fields using effective values
    if (initialState.triggerOnCallLog !== effectiveTriggerOnCallLog) return true
    if (initialState.webhookUrl !== effectiveWebhookUrl) return true
    if (initialState.httpMethod !== effectiveHttpMethod) return true
    if (initialState.isActive !== effectiveIsActive) return true
    
    // Compare headers
    const currentHeaders = effectiveHeaders || {}
    const initialHeaders = initialState.headers || {}
    const currentKeys = Object.keys(currentHeaders).sort()
    const initialKeys = Object.keys(initialHeaders).sort()
    
    if (currentKeys.length !== initialKeys.length) return true
    
    for (const key of currentKeys) {
      if (currentHeaders[key] !== initialHeaders[key]) return true
    }
    
    return false
  }
  
  // Sync display state to parent form when user makes changes
  const syncToParent = (field: string, value: any) => {
    // Update display state
    setDisplayState(prev => prev ? { ...prev, [field]: value } : null)
    // Update parent form
    onFieldChange(field, value)
  }

  // Initialize header entries from effective headers
  useEffect(() => {
    const headersToUse = effectiveHeaders || {}
    if (headersToUse && typeof headersToUse === 'object') {
      const entries = Object.entries(headersToUse).map(([key, value]) => ({ key, value }))
      setHeaderEntries(entries.length > 0 ? entries : [{ key: '', value: '' }])
    } else {
      setHeaderEntries([{ key: '', value: '' }])
    }
  }, [effectiveHeaders])

  const loadWebhookConfig = async () => {
    if (!currentAgentId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/webhooks/config?agent_id=${currentAgentId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          const config = data.data[0] // Get first active config
          const loadedState = {
            triggerOnCallLog: config.trigger_events?.includes('call_log') || false,
            webhookUrl: config.webhook_url || '',
            httpMethod: config.http_method || 'POST',
            headers: config.headers || {},
            isActive: config.is_active || false
          }
          
          // Store initial state for comparison
          setInitialState(loadedState)
          
          // Store in display state so component can show loaded values
          // WITHOUT calling onFieldChange (which would mark form as dirty)
          setDisplayState(loadedState)
          
          // CRITICAL: Don't call onFieldChange during initial load to prevent marking form as dirty
          // The loaded values are stored in displayState and initialState
          // The component will display from displayState, and only sync to parent when user makes changes
          // This prevents the "Update Config" button from being enabled when just opening the section
          
          setHasLoadedOnce(true)
        } else {
          // No existing config, set initial state to current props
          setInitialState({
            triggerOnCallLog: triggerOnCallLog || false,
            webhookUrl: webhookUrl || '',
            httpMethod: httpMethod || 'POST',
            headers: headers || {},
            isActive: isActive || false
          })
          setHasLoadedOnce(true)
        }
      }
    } catch (error) {
      console.error('Error loading webhook config:', error)
      // On error, set initial state to current props
      setInitialState({
        triggerOnCallLog: triggerOnCallLog || false,
        webhookUrl: webhookUrl || '',
        httpMethod: httpMethod || 'POST',
        headers: headers || {},
        isActive: isActive || false
      })
      setHasLoadedOnce(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Update headers object when header entries change
  const updateHeaders = (newEntries: Array<{ key: string; value: string }>) => {
    const headersObj: Record<string, string> = {}
    newEntries.forEach(entry => {
      if (entry.key.trim()) {
        headersObj[entry.key.trim()] = entry.value.trim()
      }
    })
    // Update display state and sync to parent
    setDisplayState(prev => prev ? { ...prev, headers: headersObj } : null)
    onFieldChange('advancedSettings.webhook.headers', headersObj)
  }

  const addHeaderEntry = () => {
    setHeaderEntries([...headerEntries, { key: '', value: '' }])
  }

  const removeHeaderEntry = (index: number) => {
    const newEntries = headerEntries.filter((_, i) => i !== index)
    setHeaderEntries(newEntries)
    updateHeaders(newEntries)
  }

  const updateHeaderEntry = (index: number, field: 'key' | 'value', value: string) => {
    const newEntries = [...headerEntries]
    newEntries[index] = { ...newEntries[index], [field]: value }
    setHeaderEntries(newEntries)
    updateHeaders(newEntries)
  }

  const saveWebhookConfig = async (silent = false) => {
    if (!currentAgentId || !currentProjectId) {
      if (!silent) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
      return
    }

    setIsSaving(true)
    if (!silent) {
      setSaveStatus('idle')
    }

    try {
      const webhookConfig = {
        project_id: currentProjectId,
        agent_id: currentAgentId,
        webhook_name: 'Call Log Webhook',
        webhook_url: effectiveWebhookUrl,
        http_method: effectiveHttpMethod,
        headers: effectiveHeaders || {},
        trigger_events: effectiveTriggerOnCallLog ? ['call_log'] : [],
        is_active: effectiveIsActive && effectiveTriggerOnCallLog && effectiveWebhookUrl.trim() !== ''
      }

      const response = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookConfig)
      })

      if (!response.ok) {
        throw new Error('Failed to save webhook configuration')
      }

      if (!silent) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
      
      // Update initial state after successful save
      setInitialState({
        triggerOnCallLog: effectiveTriggerOnCallLog,
        webhookUrl: effectiveWebhookUrl,
        httpMethod: effectiveHttpMethod,
        headers: effectiveHeaders || {},
        isActive: effectiveIsActive
      })
      
      // Also update display state to match
      setDisplayState({
        triggerOnCallLog: effectiveTriggerOnCallLog,
        webhookUrl: effectiveWebhookUrl,
        httpMethod: effectiveHttpMethod,
        headers: effectiveHeaders || {},
        isActive: effectiveIsActive
      })
    } catch (error) {
      console.error('Error saving webhook config:', error)
      if (!silent) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500 mr-2" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading webhook configuration...</span>
        </div>
      )}
      
      {!isLoading && (
        <>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Configure webhooks to receive call log data in real-time. When enabled, call logs will be sent to your specified endpoint.
          </div>

              {/* Trigger on Call Log Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Trigger API on Call Logs
              </Label>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Send webhook when a call log is created
              </div>
            </div>
        <Switch
          checked={effectiveTriggerOnCallLog}
          onCheckedChange={(checked) => {
            setDisplayState(prev => prev ? { ...prev, triggerOnCallLog: checked } : { triggerOnCallLog: checked, webhookUrl: '', httpMethod: 'POST', headers: {}, isActive: false })
            onFieldChange('advancedSettings.webhook.triggerOnCallLog', checked)
          }}
          className="scale-75"
        />
          </div>

          {effectiveTriggerOnCallLog && (
            <>
              {/* Webhook URL */}
              <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Webhook URL
            </Label>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              The endpoint URL where call log data will be sent
            </div>
                <Input
                  type="url"
                  placeholder="https://your-api.com/webhook"
                  value={effectiveWebhookUrl}
                  onChange={(e) => {
                    setDisplayState(prev => prev ? { ...prev, webhookUrl: e.target.value } : { triggerOnCallLog: false, webhookUrl: e.target.value, httpMethod: 'POST', headers: {}, isActive: false })
                    onFieldChange('advancedSettings.webhook.webhookUrl', e.target.value)
                  }}
                  className="h-8 text-xs"
                />
              </div>

              {/* HTTP Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  HTTP Method
                </Label>
                <Select
                  value={effectiveHttpMethod}
                  onValueChange={(value) => {
                    setDisplayState(prev => prev ? { ...prev, httpMethod: value } : { triggerOnCallLog: false, webhookUrl: '', httpMethod: value, headers: {}, isActive: false })
                    onFieldChange('advancedSettings.webhook.httpMethod', value)
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Headers */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Headers
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Custom headers to include in the webhook request (e.g., Authorization, Content-Type)
                </div>
                <div className="space-y-2">
                  {headerEntries.map((entry, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Header name (e.g., Authorization)"
                        value={entry.key}
                        onChange={(e) => updateHeaderEntry(index, 'key', e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        type="text"
                        placeholder="Header value"
                        value={entry.value}
                        onChange={(e) => updateHeaderEntry(index, 'value', e.target.value)}
                        className="h-8 text-xs flex-1"
                      />
                      {headerEntries.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeHeaderEntry(index)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHeaderEntry}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Header
                  </Button>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Active
                  </Label>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Enable or disable this webhook
                  </div>
                </div>
                <Switch
                  checked={effectiveIsActive}
                  onCheckedChange={(checked) => {
                    setDisplayState(prev => prev ? { ...prev, isActive: checked } : { triggerOnCallLog: false, webhookUrl: '', httpMethod: 'POST', headers: {}, isActive: checked })
                    onFieldChange('advancedSettings.webhook.isActive', checked)
                  }}
                  className="scale-75"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => saveWebhookConfig()}
                  disabled={isSaving || !effectiveWebhookUrl.trim() || !hasChanges()}
                  className="h-8 text-xs w-full"
                  variant={saveStatus === 'success' ? 'default' : saveStatus === 'error' ? 'destructive' : 'default'}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : saveStatus === 'success' ? (
                    'Saved!'
                  ) : saveStatus === 'error' ? (
                    'Error - Try Again'
                  ) : (
                    'Save Webhook Configuration'
                  )}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default WebhookSettings

