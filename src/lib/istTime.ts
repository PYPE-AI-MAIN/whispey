// Times shown in IST, for teams reading call times in India.

/** A call's time in IST, e.g. "13 Oct, 10:32 am IST" (with the year when it isn't this year). */
export function formatIstTimestamp(dateStr: string, now = new Date()): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const year = (x: Date) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(x)
  const text = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    ...(year(d) === year(now) ? {} : { year: 'numeric' as const }),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
  return `${text} IST`
}
