// src/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/DropOffCallSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Phone, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { PhoneNumber } from '@/utils/campaigns/constants'
import toast from 'react-hot-toast'

interface DropOffCallSettingsProps {
  agentId: string
  projectId?: string
}

interface DropOffSettings {
  id?: string
  enabled: boolean
  dropoff_message: string
  delay_minutes: number
  max_retries: number
  context_dropoff_prompt: string
  sip_trunk_id: string | null
  phone_number_id: string | null
}

export default function DropOffCallSettings({ agentId, projectId }: DropOffCallSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhones, setLoadingPhones] = useState(true)
  
  const [settings, setSettings] = useState<DropOffSettings>({
    enabled: false,
    dropoff_message: '',
    delay_minutes: 5,
    max_retries: 2,
    context_dropoff_prompt: '',
    sip_trunk_id: null,
    phone_number_id: null,
  })

  // Fetch existing settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!agentId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/agents/${agentId}/dropoff-settings`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch drop-off settings')
        }

        const result = await response.json()
        
        if (result.data) {
          setSettings({
            enabled: result.data.enabled !== undefined ? result.data.enabled : false,
            dropoff_message: result.data.dropoff_message || '',
            delay_minutes: result.data.delay_minutes || 5,
            max_retries: result.data.max_retries !== undefined && result.data.max_retries !== null ? result.data.max_retries : 2,
            context_dropoff_prompt: result.data.context_dropoff_prompt || '',
            sip_trunk_id: result.data.sip_trunk_id || null,
            phone_number_id: result.data.phone_number_id || null,
          })
        }
      } catch (error) {
        console.error('Error fetching drop-off settings:', error)
        toast.error('Failed to load drop-off settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [agentId])

  // Fetch phone numbers
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      if (!projectId) return

      try {
        setLoadingPhones(true)
        const response = await fetch(`/api/calls/phone-numbers/?limit=100`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch phone numbers')
        }

        const data: PhoneNumber[] = await response.json()
        
        // Filter by: project_id matching AND trunk_direction = 'outbound' AND status = 'active'
        const filteredNumbers = data.filter(phone => 
          phone.project_id === projectId && 
          phone.trunk_direction === 'outbound' &&
          phone.status === 'active'
        )
        setPhoneNumbers(filteredNumbers)
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
        toast.error('Failed to load phone numbers')
        setPhoneNumbers([])
      } finally {
        setLoadingPhones(false)
      }
    }

    if (projectId) {
      fetchPhoneNumbers()
    }
  }, [projectId])

  const handleSave = async () => {
    if (!agentId) return

    // Validate delay_minutes
    if (settings.delay_minutes < 0) {
      toast.error('Delay minutes must be non-negative')
      return
    }

    // Validate max_retries
    if (settings.max_retries < 0 || settings.max_retries > 10) {
      toast.error('Max retries must be between 0 and 10')
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/agents/${agentId}/dropoff-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          dropoff_message: settings.dropoff_message || null,
          delay_minutes: settings.delay_minutes,
          max_retries: settings.max_retries,
          context_dropoff_prompt: settings.context_dropoff_prompt || null,
          sip_trunk_id: settings.sip_trunk_id || null,
          phone_number_id: settings.phone_number_id || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save drop-off settings')
      }

      const result = await response.json()
      if (result.data) {
        setSettings({
          ...settings,
          id: result.data.id,
        })
      }

      toast.success('Drop-off call settings saved successfully')
    } catch (error: any) {
      console.error('Error saving drop-off settings:', error)
      toast.error(error.message || 'Failed to save drop-off settings')
    } finally {
      setSaving(false)
    }
  }

  const selectedPhone = phoneNumbers.find(p => p.id === settings.phone_number_id)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
        <div className="flex flex-col">
          <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Enable Drop-off Call Configuration
          </Label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Turn on drop-off call functionality for this agent
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Drop-off Message */}
          <div className="space-y-2">
            <Label htmlFor="dropoff-message" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Drop-off Message
            </Label>
            <Textarea
              id="dropoff-message"
              value={settings.dropoff_message}
              onChange={(e) => setSettings({ ...settings, dropoff_message: e.target.value })}
              placeholder="Enter the message to say when making the drop-off call..."
              className="min-h-[80px] text-sm resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This message will be spoken when the drop-off call is made. You can use {'{{wcontext_dropoff}}'} variable to include the summary.
            </p>
          </div>

          {/* Context Drop-off Prompt */}
          <div className="space-y-2">
            <Label htmlFor="context-dropoff-prompt" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Context Drop-off Prompt
            </Label>
            <Textarea
              id="context-dropoff-prompt"
              value={settings.context_dropoff_prompt}
              onChange={(e) => setSettings({ ...settings, context_dropoff_prompt: e.target.value })}
              placeholder="Enter the prompt for generating the context summary..."
              className="min-h-[100px] text-sm resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This prompt will be used to generate a summary that will be available as the {'{{wcontext_dropoff}}'} variable in your drop-off message.
            </p>
            <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 mt-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Important:</strong> Make sure the <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded text-xs">call_retry_required</code> metric is enabled in your agent configuration for drop-off calls to work properly.
              </AlertDescription>
            </Alert>
          </div>

          {/* Delay Minutes */}
          <div className="space-y-2">
            <Label htmlFor="delay-minutes" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Minutes After Which to Call
            </Label>
            <Input
              id="delay-minutes"
              type="number"
              min="0"
              value={settings.delay_minutes}
              onChange={(e) => setSettings({ ...settings, delay_minutes: parseInt(e.target.value) || 0 })}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Number of minutes to wait after a call drops before making the drop-off call.
            </p>
          </div>

          {/* Max Retries */}
          <div className="space-y-2">
            <Label htmlFor="max-retries" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Max Retries
            </Label>
            <Input
              id="max-retries"
              type="number"
              min="0"
              max="10"
              value={settings.max_retries}
              onChange={(e) => setSettings({ ...settings, max_retries: parseInt(e.target.value) || 0 })}
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Maximum number of retry attempts if the drop-off call fails (0-10). If a drop-off call fails, it will be retried up to this many times.
            </p>
          </div>

          {/* Outbound Phone Number Selection */}
          <div className="space-y-2">
            <Label htmlFor="phone-number" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Outbound Phone Number
            </Label>
            {loadingPhones ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-xs text-gray-500">Loading phone numbers...</span>
              </div>
            ) : phoneNumbers.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
                No outbound phone numbers available. Please configure phone numbers in SIP Management.
              </div>
            ) : (
              <Select
                value={settings.phone_number_id || undefined}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setSettings({
                      ...settings,
                      phone_number_id: null,
                      sip_trunk_id: null,
                    })
                  } else {
                    const selectedPhone = phoneNumbers.find(p => p.id === value)
                    setSettings({
                      ...settings,
                      phone_number_id: value || null,
                      sip_trunk_id: selectedPhone?.trunk_id || null,
                    })
                  }
                }}
              >
                <SelectTrigger id="phone-number" className="text-sm">
                  <SelectValue placeholder="Select outbound phone number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {phoneNumbers.map((phone) => (
                    <SelectItem key={phone.id} value={phone.id}>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono text-xs">{phone.phone_number}</span>
                        {phone.provider && (
                          <span className="text-gray-500 text-xs">({phone.provider})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedPhone && (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>
                  Selected: <span className="font-mono">{selectedPhone.phone_number}</span>
                </p>
                {selectedPhone.trunk_id && (
                  <p>
                    SIP Trunk ID: <span className="font-mono">{selectedPhone.trunk_id}</span>
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select the phone number (and its associated SIP trunk) to use for drop-off calls.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !projectId}
              size="sm"
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Drop-off Settings
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Save Button - Always visible to save enabled state */}
      {!settings.enabled && (
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || !projectId}
            size="sm"
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
