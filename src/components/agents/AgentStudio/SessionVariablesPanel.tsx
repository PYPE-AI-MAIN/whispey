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
}: Readonly<SessionVariablesPanelProps>) {
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
    // onChange must not run inside a setState updater: React calls updaters
    // during render, so the parent's setState fired mid-render of this component
    // ("Cannot update StudioWorkspace while rendering SessionVariablesPanel").
    const next = { ...values, [key]: val }
    setValues(next)
    try {
      sessionStorage.setItem(storageKey(agentId), JSON.stringify(next))
    } catch {
      // storage blocked — value still applies for this render
    }
    onChange?.(next)
  }

  const keys = Object.keys(values)

  if (keys.length === 0) {
    return <p className="text-xs text-muted-foreground">This agent has no variables.</p>
  }

  return (
    <div className="space-y-2.5">
      {keys.map((key) => (
        <label key={key} className="block">
          <span className="mb-1 block font-mono text-[11px] text-muted-foreground">{key}</span>
          <input
            value={values[key] ?? ''}
            onChange={(e) => update(key, e.target.value)}
            placeholder="Not set"
            className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </label>
      ))}
      <p className="text-[11px] text-muted-foreground">Changes are saved to the agent when you press Update and start.</p>
    </div>
  )
}
