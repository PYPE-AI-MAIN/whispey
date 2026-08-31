"use client"

import React, { useEffect, useState } from 'react'
import { Save, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { BASIC_COLUMNS, EXTRA_RESTRICTABLE_COLUMNS } from '@/hooks/useCallLogsColumns'

interface DownloadSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentId: string
  allColumns: { key: string; label: string }[]
  initialEnabled: boolean
  initialSuperadminOnlyColumns: string[]
  onSaved: () => void
}

const BASIC_COLUMN_KEYS = new Set<string>(BASIC_COLUMNS.map(c => c.key))
const EXTRA_COLUMN_KEYS = new Set<string>(EXTRA_RESTRICTABLE_COLUMNS.map(c => c.key))

export default function DownloadSettingsDialog({
  open, onOpenChange, agentId, allColumns, initialEnabled, initialSuperadminOnlyColumns, onSaved,
}: DownloadSettingsDialogProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [restricted, setRestricted] = useState<Set<string>>(new Set(initialSuperadminOnlyColumns))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEnabled(initialEnabled)
      setRestricted(new Set(initialSuperadminOnlyColumns))
    }
  }, [open, initialEnabled, initialSuperadminOnlyColumns])

  const toggle = (col: string) => {
    setRestricted(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col)
      else next.add(col)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/download-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, superadmin_only_columns: Array.from(restricted) }),
      })
      if (res.ok) {
        onSaved()
        onOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const basicCols = allColumns.filter(c => BASIC_COLUMN_KEYS.has(c.key))
  const extraCols = allColumns.filter(c => EXTRA_COLUMN_KEYS.has(c.key))
  const otherCols = allColumns.filter(c => !BASIC_COLUMN_KEYS.has(c.key) && !EXTRA_COLUMN_KEYS.has(c.key))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Download settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                Allow non-superadmins to download call logs
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                When off, only superadmins can download or configure this agent&apos;s export.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} className="flex-shrink-0 mt-0.5" />
          </div>

          <div className={`rounded-lg border border-gray-200 dark:border-gray-800 p-3 transition-opacity ${!enabled ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-2 mb-2">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-600 dark:text-gray-400">
                {enabled
                  ? <>These columns are hidden from anyone who isn&apos;t a superadmin, both on-screen and in downloads. This is an access-control decision, not a display preference.</>
                  : <>Downloads are off for non-superadmins, so column restrictions don&apos;t apply right now. Turn on the switch above to configure them.</>}
              </p>
            </div>

            <div
              aria-disabled={!enabled}
              className={`rounded-lg border border-gray-200 dark:border-gray-800 max-h-56 overflow-y-auto p-2 space-y-2 ${!enabled ? 'pointer-events-none' : ''}`}
            >
              {basicCols.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Basic columns</p>
                  {basicCols.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                      <Checkbox checked={restricted.has(col.key)} onCheckedChange={() => toggle(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}

              {extraCols.length > 0 && (
                <div className="space-y-1">
                  {basicCols.length > 0 && <div className="border-t border-gray-100 dark:border-gray-800 pt-1.5" />}
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 px-1">Sensitive columns</p>
                  {extraCols.map(col => (
                    <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                      <Checkbox checked={restricted.has(col.key)} onCheckedChange={() => toggle(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}

              {otherCols.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
                  <Checkbox checked={restricted.has(col.key)} onCheckedChange={() => toggle(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full gap-1.5">
            <Save className="h-3 w-3" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
