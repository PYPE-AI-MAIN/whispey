'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  name: string
  onSave: (v: string) => void
  forceEdit?: boolean
  onForceEditDone?: () => void
}

export function InlineNameEditor({ name, onSave, forceEdit, onForceEditDone }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (forceEdit) {
      setValue(name)
      setEditing(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [forceEdit, name])

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setValue(name)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    setEditing(false)
    onForceEditDone?.()
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) onSave(trimmed)
    else setValue(name)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setEditing(false); setValue(name); onForceEditDone?.() }
        }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 border border-violet-400 dark:border-violet-500 rounded px-2 py-0.5 text-sm font-medium text-gray-900 dark:text-gray-100 outline-none w-full max-w-xs"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      title="Click to rename"
      className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors truncate"
    >
      {name || 'Untitled session'}
    </span>
  )
}