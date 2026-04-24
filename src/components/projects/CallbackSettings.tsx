'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Phone, AlertCircle, ArrowRight } from 'lucide-react'
import { PhoneNumber } from '@/utils/campaigns/constants'
import toast from 'react-hot-toast'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
]

interface CallbackSettingsData {
  enabled: boolean
  timeWindow: { startTime: string; endTime: string }
  allowedDays: string[]
  timezone: string
  phoneNumberId: string | null
  sipTrunkId: string | null
  maxFutureDays: number
  maxCallbacksPerContact: number
  defaultDelayMinutes: number
  minDelayMinutes: number
}

const DEFAULT_SETTINGS: CallbackSettingsData = {
  enabled: false,
  timeWindow: { startTime: '09:00', endTime: '18:00' },
  allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  timezone: 'UTC',
  phoneNumberId: null,
  sipTrunkId: null,
  maxFutureDays: 7,
  maxCallbacksPerContact: 3,
  defaultDelayMinutes: 30,
  minDelayMinutes: 2,
}

function formatTime12h(t: string): string {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return t
  const [hStr, m] = t.split(':')
  const h = parseInt(hStr, 10)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${period}`
}

function minutesFromTime(t: string): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 0
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  return h * 60 + m
}

type UnifiedPhoneNumber = {
  id: string
  phone_number: string
  provider: string | null
  trunk_id: string | null
  source: 'livekit' | 'pipecat'
}

interface CallbackSettingsProps {
  projectId: string
  /** When provided, surfaces Pipecat/Acefone numbers attached to this agent. */
  agentRuntime?: 'livekit' | 'pipecat'
  pipecatAgentId?: string
}

export default function CallbackSettings({ projectId, agentRuntime, pipecatAgentId }: CallbackSettingsProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CallbackSettingsData>(DEFAULT_SETTINGS)

  const { data: settings, isLoading } = useQuery<CallbackSettingsData>({
    queryKey: ['callback-settings', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/callback-settings`)
      if (!res.ok) return DEFAULT_SETTINGS
      return res.json()
    },
    enabled: !!projectId,
  })

  // LiveKit / Plivo SIP trunks (from Supabase)
  const { data: livekitPhones = [], isLoading: loadingLivekit } = useQuery<UnifiedPhoneNumber[]>({
    queryKey: ['callback-livekit-phones', projectId],
    queryFn: async () => {
      const res = await fetch('/api/calls/phone-numbers/?limit=100')
      if (!res.ok) return []
      const data: PhoneNumber[] = await res.json()
      return data
        .filter(
          (p) =>
            p.project_id === projectId && p.trunk_direction === 'outbound' && p.status === 'active'
        )
        .map((p) => ({
          id: p.id,
          phone_number: p.phone_number,
          provider: p.provider,
          trunk_id: p.trunk_id,
          source: 'livekit' as const,
        }))
    },
    enabled: !!projectId,
  })

  // Pipecat numbers (Acefone, Plivo, etc.) — agent-scoped, only relevant for pipecat agents
  const { data: pipecatPhones = [], isLoading: loadingPipecat } = useQuery<UnifiedPhoneNumber[]>({
    queryKey: ['callback-pipecat-phones', pipecatAgentId],
    queryFn: async () => {
      const res = await fetch(`/api/pipecat/numbers?agent_id=${pipecatAgentId}`)
      if (!res.ok) return []
      const data: Array<{ number: string; provider: string | null; call_types: string }> =
        await res.json()
      return data
        .filter((n) => (n.call_types || '').includes('outbound'))
        .map((n) => ({
          id: n.number,
          phone_number: n.number,
          provider: n.provider,
          trunk_id: null,
          source: 'pipecat' as const,
        }))
    },
    enabled: agentRuntime === 'pipecat' && !!pipecatAgentId,
  })

  const phoneNumbers: UnifiedPhoneNumber[] =
    agentRuntime === 'pipecat' ? [...pipecatPhones, ...livekitPhones] : livekitPhones
  const loadingPhones = loadingLivekit || (agentRuntime === 'pipecat' && loadingPipecat)

  useEffect(() => {
    if (settings) setForm({ ...DEFAULT_SETTINGS, ...settings })
  }, [settings])

  const mutation = useMutation({
    mutationFn: async (data: CallbackSettingsData) => {
      const res = await fetch(`/api/projects/${projectId}/callback-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['callback-settings', projectId], data)
      toast.success('Callback settings saved')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      allowedDays: prev.allowedDays.includes(day)
        ? prev.allowedDays.filter((d) => d !== day)
        : [...prev.allowedDays, day],
    }))
  }

  const handleSave = () => {
    if (form.enabled) {
      if (form.allowedDays.length === 0) {
        toast.error('Select at least one allowed day')
        return
      }
      if (minutesFromTime(form.timeWindow.endTime) <= minutesFromTime(form.timeWindow.startTime)) {
        toast.error('"To" time must be after "From" time')
        return
      }
      if (form.maxFutureDays < 1 || form.maxFutureDays > 365) {
        toast.error('Max future days must be between 1 and 365')
        return
      }
      if (form.maxCallbacksPerContact < 1 || form.maxCallbacksPerContact > 20) {
        toast.error('Max callbacks per contact must be between 1 and 20')
        return
      }
      if (form.defaultDelayMinutes < form.minDelayMinutes) {
        toast.error('Default delay must be ≥ minimum delay')
        return
      }
    }
    mutation.mutate(form)
  }

  const selectedPhone = phoneNumbers.find((p) => p.id === form.phoneNumberId)
  const crossesMidnight =
    minutesFromTime(form.timeWindow.endTime) <= minutesFromTime(form.timeWindow.startTime)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Call-back Window Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Allowed Call-back Window
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Callbacks requested outside this window are deferred to the next available slot. 24-hour format.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="cb-start" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Start (From)
            </Label>
            <Input
              id="cb-start"
              type="time"
              value={form.timeWindow.startTime}
              onChange={(e) =>
                setForm((p) => ({ ...p, timeWindow: { ...p.timeWindow, startTime: e.target.value } }))
              }
              className="text-sm"
            />
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 mb-2.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <Label htmlFor="cb-end" className="text-xs font-medium text-gray-700 dark:text-gray-300">
              End (To)
            </Label>
            <Input
              id="cb-end"
              type="time"
              value={form.timeWindow.endTime}
              onChange={(e) =>
                setForm((p) => ({ ...p, timeWindow: { ...p.timeWindow, endTime: e.target.value } }))
              }
              className="text-sm"
            />
          </div>
        </div>

        <div className="text-xs px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          Callbacks allowed from{' '}
          <span className="font-mono font-semibold">{formatTime12h(form.timeWindow.startTime)}</span>{' '}
          to{' '}
          <span className="font-mono font-semibold">{formatTime12h(form.timeWindow.endTime)}</span>{' '}
          ({form.timezone})
        </div>

        {crossesMidnight && (
          <div className="flex items-start gap-2 text-xs px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>End time must be after start time. Overnight windows are not supported.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Allowed Days</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.allowedDays.includes(day)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                }`}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phone Number Configuration Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Outbound Phone Number
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Number used to place callbacks. Leave as &quot;None&quot; to reuse the original call&apos;s number.
          </p>
        </div>

        {loadingPhones ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Loading phone numbers...</span>
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 py-2 px-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
            No outbound phone numbers available. Configure phone numbers in SIP Management.
          </div>
        ) : (
          <Select
            value={
              form.phoneNumberId
                ? `${phoneNumbers.find((p) => p.id === form.phoneNumberId)?.source ?? 'livekit'}:${form.phoneNumberId}`
                : 'none'
            }
            onValueChange={(value) => {
              if (value === 'none') {
                setForm((p) => ({ ...p, phoneNumberId: null, sipTrunkId: null }))
              } else {
                const [, id] = value.split(':')
                const sp = phoneNumbers.find((p) => p.id === id)
                setForm((prev) => ({
                  ...prev,
                  phoneNumberId: id,
                  sipTrunkId: sp?.trunk_id || null,
                }))
              }
            }}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select outbound phone number" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (use original call&apos;s number)</SelectItem>
              {phoneNumbers.map((phone) => (
                <SelectItem key={`${phone.source}-${phone.id}`} value={`${phone.source}:${phone.id}`}>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-mono text-xs">{phone.phone_number}</span>
                    {phone.provider && (
                      <span className="text-gray-500 text-xs">({phone.provider})</span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {phone.source}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedPhone && (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
            <p>
              <span className="font-medium">Selected:</span>{' '}
              <span className="font-mono">{selectedPhone.phone_number}</span>
            </p>
            {selectedPhone.trunk_id && (
              <p>
                <span className="font-medium">SIP Trunk ID:</span>{' '}
                <span className="font-mono">{selectedPhone.trunk_id}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Limits Section */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Limits &amp; Defaults</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bounds that protect against abusive or malformed callback requests.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Max Future Days</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={form.maxFutureDays}
              onChange={(e) =>
                setForm((p) => ({ ...p, maxFutureDays: parseInt(e.target.value) || 7 }))
              }
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Rejects requests beyond this horizon (e.g. &quot;call me in 5 years&quot;).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Max Callbacks / Contact
            </Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={form.maxCallbacksPerContact}
              onChange={(e) =>
                setForm((p) => ({ ...p, maxCallbacksPerContact: parseInt(e.target.value) || 3 }))
              }
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prevents infinite callback loops for the same phone number.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Min Delay (min)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={form.minDelayMinutes}
              onChange={(e) =>
                setForm((p) => ({ ...p, minDelayMinutes: parseInt(e.target.value) || 2 }))
              }
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Floor for every callback (processor runs every 1 min).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Default Delay (min)</Label>
            <Input
              type="number"
              min={form.minDelayMinutes}
              max={1440}
              value={form.defaultDelayMinutes}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultDelayMinutes: parseInt(e.target.value) || 30 }))
              }
              className="text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Used when the caller&apos;s timing is vague.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable + Save (matches DropOffCallSettings) */}
      <div className="pt-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col">
            <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Enable Callback Scheduling
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Auto-schedule callbacks when a caller asks to be called back.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => setForm((p) => ({ ...p, enabled: checked }))}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={mutation.isPending || !projectId}
          size="sm"
          className="w-full"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Configuration...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
