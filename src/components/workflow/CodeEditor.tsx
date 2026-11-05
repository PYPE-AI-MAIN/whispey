'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <p className="p-3 text-xs text-muted-foreground">Loading editor...</p>,
})

const THEMES = { light: 'workflow-code-light', dark: 'workflow-code-dark' }

/** A real code editor (line numbers, colours, indentation, no wrapping) for a Code step's source. */
export function CodeEditor({ value, onChange, language }: Readonly<{ value: string; onChange: (value: string) => void; language: 'python' | 'javascript' }>) {
  const { resolvedTheme } = useTheme()
  return (
    <div className="h-[280px] overflow-hidden rounded-lg border border-border bg-card">
      <Editor
        height="100%"
        language={language}
        theme={resolvedTheme === 'dark' ? THEMES.dark : THEMES.light}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        beforeMount={(monaco) => {
          // transparent background: the card colour behind it stays the editor's colour in every theme
          monaco.editor.defineTheme(THEMES.light, { base: 'vs', inherit: true, rules: [], colors: { 'editor.background': '#00000000' } })
          monaco.editor.defineTheme(THEMES.dark, { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#00000000' } })
        }}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          folding: true,
          wordWrap: 'off',
          tabSize: 4,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontSize: 12.5,
          fontFamily: 'ui-monospace, SF Mono, Monaco, Cascadia Code, Courier New, monospace',
          renderLineHighlight: 'line',
          padding: { top: 10, bottom: 10 },
          scrollbar: { useShadows: false },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  )
}
