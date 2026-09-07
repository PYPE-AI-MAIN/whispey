// New-domain signup-approval gate: an email in PYPE_ADMINS bypasses the
// approval gate entirely (auto-active on signup, sole authority to
// approve/decline others) and keeps the old, unrestricted email-based org
// access match — same experience they had before this gate existed.
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const admins = process.env.PYPE_ADMINS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) || []
  return admins.includes(email.toLowerCase())
}
