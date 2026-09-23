'use client'

import { useEffect, useState } from 'react'
import { Variable } from 'lucide-react'

interface SessionVariablesPanelProps {
  agentId: string
  defaultVariables: Record<string, string>
  onChange?: (vars: Record<string, string>) => void
}

const storageKey = (agentId: string) => `whispey-studio-session-vars-${agentId}`

// Lets the tester fill in the agent's template variables (e.g. {{companyName}})
// before placing a test call. Values are remembered in sessionStorage — this
// browser tab's session only, never written back to the agent's real config.
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
      // ignore — private mode / storage blocked
    }
    const merged = { ...defaultVariables, ...saved }
    setValues(merged)
    onChange?.(merged)
    // Only re-seed when the agent or its default variable set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, JSON.stringify(defaultVariables)])

  const update = (key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val }
      try {
        sessionStorage.setItem(storageKey(agentId), JSON.stringify(next))
      } catch {
        // ignore
      }
      onChange?.(next)
      return next
    })
  }

  const keys = Object.keys(values)

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        <Variable className="h-3 w-3" /> Session variables
      </p>
      {keys.length === 0 ? (
        <p className="text-[11px] text-gray-500">This agent has no template variables.</p>
      ) : (
        keys.map((key) => (
          <div key={key}>
            <label className="mb-1 block text-[10px] text-gray-500">{key}</label>
            <input
              value={values[key] ?? ''}
              onChange={(e) => update(key, e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-transparent px-2.5 py-1.5 text-[12px] text-gray-800 outline-none focus:border-gray-400 dark:border-gray-800 dark:text-gray-200"
            />
          </div>
        ))
      )}
    </div>
  )
}
