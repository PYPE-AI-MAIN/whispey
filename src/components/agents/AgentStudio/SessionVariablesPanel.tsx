'use client'

import { useEffect, useState } from 'react'

interface SessionVariablesPanelProps {
  agentId: string
  defaultVariables: Record<string, string>
  onChange?: (vars: Record<string, string>) => void
}

const storageKey = (agentId: string) => `whispey-studio-session-vars-${agentId}`

// Lets the tester fill in the agent's template variables (e.g. {{companyName}})
// before a test call. Values are remembered in sessionStorage — this browser
// tab's session only, never written back to the agent's real config.
export default function SessionVariablesPanel({
  agentId,
  defaultVariables,
  onChange,
}: SessionVariablesPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!agentId) return
    let saved: Record<string, string> = {}
    try {
      const raw = sessionStorage.getItem(storageKey(agentId))
      if (raw) saved = JSON.parse(raw)
    } catch {
      // storage blocked — fall back to defaults
    }
    const merged = { ...defaultVariables, ...saved }
    setValues(merged)
    onChange?.(merged)
    // Re-seed only when the agent or its default variable set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, JSON.stringify(defaultVariables)])

  const update = (key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val }
      try {
        sessionStorage.setItem(storageKey(agentId), JSON.stringify(next))
      } catch {
        // storage blocked — value still applies for this render
      }
      onChange?.(next)
      return next
    })
  }

  const keys = Object.keys(values)

  if (keys.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">This agent has no variables.</p>
  }

  return (
    <div className="space-y-2.5">
      {keys.map((key) => (
        <label key={key} className="block">
          <span className="mb-1 block font-mono text-[11px] text-gray-500 dark:text-gray-400">{key}</span>
          <input
            value={values[key] ?? ''}
            onChange={(e) => update(key, e.target.value)}
            placeholder="Not set"
            className="h-8 w-full rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </label>
      ))}
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Remembered for this browser session only.</p>
    </div>
  )
}
