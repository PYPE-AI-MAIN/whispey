import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'

interface CheckboxRowProps {
  checked: boolean
  onToggle: () => void
  label: React.ReactNode
}

// Shared `<label><Checkbox/>...</label>` row used by the download column
// checklists (DownloadDialog, DownloadSettingsDialog) — extracted so the
// markup/classes stay in exactly one place instead of being copy-pasted
// per column group.
export default function CheckboxRow({ checked, onToggle, label }: Readonly<CheckboxRowProps>) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer px-1 py-0.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </label>
  )
}
