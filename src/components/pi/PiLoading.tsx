export default function PiLoading({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <div className={compact
      ? 'flex items-center justify-center gap-2 px-2 py-6 text-[12px] text-gray-400'
      : 'flex h-full items-center justify-center gap-2 text-sm text-gray-400'}>
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-300" />
      Loading…
    </div>
  )
}
