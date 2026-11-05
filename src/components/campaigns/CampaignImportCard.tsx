'use client'

import { useCampaignImport } from '@/hooks/useCampaignExtras'

/** Import progress and the rows the scheduler rejected. Renders nothing when there is no import to show. */
export function CampaignImportCard({ campaignId }: { campaignId: string }) {
  const { data } = useCampaignImport(campaignId)
  const rejects = data?.rejects ?? []
  if (!data || (data.status === 'done' && rejects.length === 0 && !data.rejected)) return null

  const pct = data.total > 0 ? Math.min(100, Math.round((data.processed / data.total) * 100)) : 0
  return (
    <div className="rounded-lg border p-4 space-y-3" data-testid="import-card">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {data.status === 'processing' ? 'Importing contacts…' : data.status === 'failed' ? 'Import failed' : 'Import finished'}
        </span>
        <span className="text-muted-foreground">
          {data.processed.toLocaleString()} / {data.total.toLocaleString()}
          {data.rejected ? ` · ${data.rejected.toLocaleString()} rejected` : ''}
        </span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {rejects.length > 0 && (
        <div className="max-h-56 overflow-auto text-xs">
          <table className="w-full">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1 pr-3">Row</th><th className="pr-3">Phone</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {rejects.map((r) => (
                <tr key={`${r.row}-${r.phone ?? ''}`} className="border-t">
                  <td className="py-1 pr-3">{r.row}</td>
                  <td className="pr-3">{r.phone ?? '—'}</td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
