'use client'

/** Platform admins: where each project's data goes. Destinations, routing, audit log, kill switch. */
import { useState } from 'react'
import { DestinationsTab } from './DestinationsTab'
import { RoutingTab } from './RoutingTab'
import { AuditTab, KillSwitch } from './AuditTab'

const TABS = ['Destinations', 'Project routing', 'Audit log', 'Kill switch'] as const

export function DataDestinationsAdmin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Destinations')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data location</h1>
        <p className="text-sm text-muted-foreground">
          Choose where a project&apos;s call data, recordings, DNC and QA tickets are stored. With no route a project uses Pype. Once a route
          exists, a failure is an error: nothing falls back to Pype.
        </p>
      </div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-foreground font-medium' : 'text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Destinations' && <DestinationsTab />}
      {tab === 'Project routing' && <RoutingTab />}
      {tab === 'Audit log' && <AuditTab />}
      {tab === 'Kill switch' && <KillSwitch />}
    </div>
  )
}
