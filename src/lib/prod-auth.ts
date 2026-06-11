import 'server-only'

// Server-side only. Never use NEXT_PUBLIC_ — the list must never reach the browser.
// Set PROD_AUTHORIZED_EMAILS=a@x.com,b@x.com in .env.local / deployment env vars.
export function isProdAuthorized(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.PROD_AUTHORIZED_EMAILS ?? ''
  if (!raw.trim()) return false
  return raw.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}
