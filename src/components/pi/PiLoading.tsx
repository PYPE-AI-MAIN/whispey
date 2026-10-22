export default function PiLoading({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <div className={compact
      ? 'flex items-center justify-center gap-2 px-2 py-6 text-[12px] text-muted-foreground'
      : 'flex h-full items-center justify-center gap-2 text-sm text-muted-foreground'}>
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-gray-600 dark:border-t-gray-300" />
      <span>Loading…</span>
    </div>
  )
}
