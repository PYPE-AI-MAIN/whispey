'use client'

import React, { useMemo, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Copy, Check, Loader2, PhoneIncoming } from 'lucide-react'

export interface InboundVariablesConfig {
  enabled: boolean
  url: string
  authHeader: string
  timeoutMs: number
  cacheTtlS: number
}

export const INBOUND_VARIABLES_DEFAULTS: InboundVariablesConfig = {
  enabled: false,
  url: '',
  authHeader: '',
  timeoutMs: 1000,
  cacheTtlS: 90,
}

interface InboundVariablesSettingsProps extends InboundVariablesConfig {
  /** Variable names used in this agent's prompt and greeting — the names the API must return. */
  promptVariables?: string[]
  agentName?: string
  onFieldChange: (field: string, value: any) => void
}

/** The request/response the customer has to build, written with THIS agent's variable names. */
export function buildSpec(url: string, promptVariables: string[], timeoutMs: number): string {
  const names = promptVariables.length > 0 ? promptVariables : ['patient_name', 'appointment_date']
  const sample = names.map((n) => `    "${n}": "..."`).join(',\n')
  return `POST ${url || 'https://your-system.example.com/voice/lookup'}
Content-Type: application/json

WE SEND
{
  "phone_number": "9876543210",
  "agent_id": "..."
}
phone_number is always 10 digits.

YOU RETURN, within ${timeoutMs} ms
{
  "variables": {
${sample}
  }
}

Caller not in your records:
{ "variables": {} }

Any error, or slower than ${timeoutMs} ms:
we greet using the saved default values.`
}

function InboundVariablesSettings({
  enabled,
  url,
  authHeader,
  timeoutMs,
  cacheTtlS,
  promptVariables = [],
  agentName,
  onFieldChange,
}: Readonly<InboundVariablesSettingsProps>) {
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; variables: Record<string, string>; latency_ms?: number; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const spec = useMemo(() => buildSpec(url, promptVariables, timeoutMs || 1000), [url, promptVariables, timeoutMs])

  const applyChange = (patch: Partial<InboundVariablesConfig>) => {
    onFieldChange('advancedSettings.inboundVariables', {
      enabled, url, authHeader, timeoutMs, cacheTtlS, ...patch,
    })
  }

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(spec)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the spec is on screen to copy by hand */
    }
  }

  const runTest = async () => {
    if (!testPhone.trim() || !agentName) return
    setTesting(true)
    setResult(null)
    try {
      const response = await fetch('/api/agents/inbound-variables/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName,
          phone_number: testPhone.trim(),
          url,
          auth_header: authHeader,
          timeout_ms: timeoutMs,
        }),
      })
      const data = await response.json()
      setResult({ ok: !!data.ok, variables: data.variables || {}, latency_ms: data.latency_ms, error: data.error })
    } catch (error) {
      setResult({ ok: false, variables: {}, error: error instanceof Error ? error.message : 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const returned = Object.keys(result?.variables || {})
  const missing = promptVariables.filter((name) => !returned.includes(name))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="pr-3">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fetch variables on inbound calls</Label>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            When someone calls in, look them up by their number and fill the prompt and greeting before the agent speaks. Off = nothing is called.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={(checked) => applyChange({ enabled: checked })} />
      </div>

      {enabled && (
        <>
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-600 dark:text-gray-400">Endpoint URL</Label>
            <Input
              value={url}
              onChange={(e) => applyChange({ url: e.target.value })}
              placeholder="https://your-system.example.com/voice/lookup"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-gray-600 dark:text-gray-400">Authorization header (optional)</Label>
            <Input
              value={authHeader}
              onChange={(e) => applyChange({ authHeader: e.target.value })}
              placeholder="Bearer ..."
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-gray-600 dark:text-gray-400">Max wait (ms)</Label>
              <Input
                type="number"
                min={100}
                max={3000}
                value={timeoutMs}
                onChange={(e) => applyChange({ timeoutMs: Number(e.target.value) || 1000 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-gray-600 dark:text-gray-400">Cache (seconds)</Label>
              <Input
                type="number"
                min={0}
                max={600}
                value={cacheTtlS}
                onChange={(e) => applyChange({ cacheTtlS: Number(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            The caller is on the line, so we wait at most {timeoutMs || 1000} ms. Slower than that and the agent greets with the default values below.
          </p>

          {/* The names the API must return — read straight from the prompt. */}
          <div className="rounded border border-gray-200 dark:border-gray-700 p-2">
            <Label className="text-[11px] text-gray-600 dark:text-gray-400">Variables this agent uses</Label>
            {promptVariables.length === 0 ? (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                No <code>{'{{variables}}'}</code> in the prompt or greeting yet. Add some, and set a default value for each — the default is used when the API returns nothing for that name.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 mt-1">
                  {promptVariables.map((name) => (
                    <span key={name} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  The API must return these exact names. A value from the API always replaces the default; the default is only used when the API returns nothing for that name.
                </p>
              </>
            )}
          </div>

          {/* Copy-paste spec for the customer's developer. */}
          <div className="rounded border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <Label className="text-[11px] text-gray-600 dark:text-gray-400">What their developer builds</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={copySpec}>
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="text-[10px] leading-relaxed font-mono p-2 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{spec}</pre>
          </div>

          {/* Test against the real endpoint. */}
          <div className="space-y-1">
            <Label className="text-[11px] text-gray-600 dark:text-gray-400">Test with a phone number</Label>
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9876543210"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs select-none shrink-0"
                disabled={testing || !testPhone.trim() || !url.trim()}
                onClick={runTest}
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneIncoming className="w-3 h-3" />}
                <span className="ml-1">{testing ? 'Testing' : 'Test'}</span>
              </Button>
            </div>
            {!url.trim() && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">Add the endpoint URL above to enable the test.</p>
            )}
          </div>

          {result && (
            <div className={`rounded border p-2 text-[11px] ${result.ok ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-500/10' : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-500/10'}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {result.ok ? `${returned.length} variable(s) returned` : 'Nothing usable came back'}
                </span>
                {result.latency_ms !== undefined && (
                  <span className={result.latency_ms > (timeoutMs || 1000) ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                    {result.latency_ms} ms
                  </span>
                )}
              </div>
              {returned.length > 0 && (
                <div className="mt-1 space-y-0.5 font-mono text-[10px] text-gray-700 dark:text-gray-300">
                  {returned.map((name) => (
                    <div key={name}>
                      {name}: {String(result.variables[name]).slice(0, 60)}
                      {promptVariables.length > 0 && !promptVariables.includes(name) && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">(not used in the prompt)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {missing.length > 0 && (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  Not returned, will use the default: {missing.join(', ')}
                </p>
              )}
              {result.error && <p className="mt-1 text-gray-600 dark:text-gray-400">{result.error}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default InboundVariablesSettings
