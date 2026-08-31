// Single source of truth for "approve" / "decline" on a pending signup.
// Used by both the admin-UI route (/api/admin/pending-users/[id]) and the
// email-link route (/api/admin/pending-users/[id]/action) so the two entry
// points can never drift out of sync (DRY — one place owns the state
// transition, its atomicity guarantee, and the outcome email).
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendAccountApprovedEmail, sendAccountDeclinedEmail } from '@/lib/sendApprovalEmail'

export type PendingUserActionResult =
  | { ok: true }
  | { ok: false; reason: 'already_handled' }

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')

// Atomic conditional update — WHERE approval_status = 'pending' in the same
// statement as the write, not a separate SELECT-then-UPDATE. This is what
// makes "approved can't later be declined, declined can't later be approved,
// and simultaneous clicks can't both succeed" true without a race window.
async function transitionStatus(
  supabase: SupabaseClient,
  userId: string,
  to: 'active' | 'declined'
): Promise<{ email: string } | null> {
  const { data, error } = await supabase
    .from('pype_voice_users')
    .update({ approval_status: to, approval_token: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('approval_status', 'pending')
    .select('email')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function approvePendingUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingUserActionResult> {
  const updated = await transitionStatus(supabase, userId, 'active')
  if (!updated) return { ok: false, reason: 'already_handled' }

  try {
    await sendAccountApprovedEmail({ email: updated.email, appLink: `${APP_URL}/onboarding` })
  } catch (err) {
    console.error('[pending-users] Failed to send approval email:', err)
  }

  return { ok: true }
}

export async function declinePendingUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingUserActionResult> {
  const updated = await transitionStatus(supabase, userId, 'declined')
  if (!updated) return { ok: false, reason: 'already_handled' }

  try {
    await sendAccountDeclinedEmail({ email: updated.email })
  } catch (err) {
    console.error('[pending-users] Failed to send decline email:', err)
  }

  return { ok: true }
}
