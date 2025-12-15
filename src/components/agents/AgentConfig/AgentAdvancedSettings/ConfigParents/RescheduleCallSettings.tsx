// src/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/RescheduleCallSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Phone } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { PhoneNumber } from '@/utils/campaigns/constants'
import toast from 'react-hot-toast'

interface RescheduleCallSettingsProps {
  agentId: string
  projectId?: string
}

interface RescheduleSettings {
  id?: string
  enabled: boolean
  reschedule_message: string
  reschedule_criteria: string
  sip_trunk_id: string | null
  phone_number_id: string | null
}

export default function RescheduleCallSettings({ agentId, projectId }: RescheduleCallSettingsProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhones, setLoadingPhones] = useState(true)
  
  const [settings, setSettings] = useState<RescheduleSettings>({
    enabled: false,
    reschedule_message: '',
    reschedule_criteria: '',
    sip_trunk_id: null,
    phone_number_id: null,
  })

  // Fetch existing settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!agentId) return

      try {
        setLoading(true)
        const response = await fetch(`/api/agents/${agentId}/reschedule-settings`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch reschedule settings')
        }

        const result = await response.json()
        
        if (result.data) {
          setSettings({
            enabled: result.data.enabled !== undefined ? result.data.enabled : false,
            reschedule_message: result.data.reschedule_message || '',
            reschedule_criteria: result.data.reschedule_criteria || '',
            sip_trunk_id: result.data.sip_trunk_id || null,
            phone_number_id: result.data.phone_number_id || null,
          })
        }
      } catch (error) {
        console.error('Error fetching reschedule settings:', error)
        toast.error('Failed to load reschedule settings')
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

    try {
      setSaving(true)
      const response = await fetch(`/api/agents/${agentId}/reschedule-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: settings.enabled,
          reschedule_message: settings.reschedule_message || null,
          reschedule_criteria: settings.reschedule_criteria || null,
          sip_trunk_id: settings.sip_trunk_id || null,
          phone_number_id: settings.phone_number_id || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save reschedule settings')
      }

      const result = await response.json()
      if (result.data) {
        setSettings({
          ...settings,
          id: result.data.id,
        })
      }

      toast.success('Reschedule settings saved successfully')
    } catch (error: any) {
      console.error('Error saving reschedule settings:', error)
      toast.error(error.message || 'Failed to save reschedule settings')
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
            Enable Reschedule Configuration
          </Label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Turn on reschedule functionality for this agent
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Reschedule Message */}
          <div className="space-y-2">
            <Label htmlFor="reschedule-message" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Reschedule Message
            </Label>
            <Textarea
              id="reschedule-message"
              value={settings.reschedule_message}
              onChange={(e) => setSettings({ ...settings, reschedule_message: e.target.value })}
              placeholder="Enter the message to say when making the reschedule call..."
              className="min-h-[80px] text-sm resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This message will be spoken when the reschedule call is made.
            </p>
          </div>

          {/* Reschedule Criteria */}
          <div className="space-y-2">
            <Label htmlFor="reschedule-criteria" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Reschedule Criteria
            </Label>
            <Textarea
              id="reschedule-criteria"
              value={settings.reschedule_criteria}
              onChange={(e) => setSettings({ ...settings, reschedule_criteria: e.target.value })}
              placeholder="Enter criteria for rescheduling calls..."
              className="min-h-[80px] text-sm resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Specify the criteria that should be used when determining if a call should be rescheduled.
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
              Select the phone number (and its associated SIP trunk) to use for reschedule calls.
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
                  Save Reschedule Settings
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

