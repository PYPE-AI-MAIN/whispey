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
): Promise<{ email: string; clerk_id: string } | null> {
  const { data, error } = await supabase
    .from('pype_voice_users')
    .update({ approval_status: to, approval_token: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('approval_status', 'pending')
    .select('email, clerk_id')
    .maybeSingle()

  if (error) throw error
  return data
}

// Carries over project access from any other account sharing this email
// (typically an old-domain account under a different clerk_id) onto the
// newly-approved clerk_id — insert only, never touches the source rows, so
// that other account's own access is never modified. Best-effort: a failure
// here doesn't fail the approval itself, since the account is already
// approved and usable regardless of whether this convenience copy succeeds.
async function copyExistingProjectAccess(
  supabase: SupabaseClient,
  email: string,
  newClerkId: string
): Promise<void> {
  const { data: otherMappings, error: otherMappingsError } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('project_id, role, permissions')
    .eq('email', email)
    .eq('is_active', true)
    .not('clerk_id', 'is', null)
    .neq('clerk_id', newClerkId)

  if (otherMappingsError) {
    console.error('[pending-users] Failed to read existing project access for', email, otherMappingsError)
    return
  }
  if (!otherMappings || otherMappings.length === 0) return

  // One row per project — a person may have accumulated more than one prior
  // mapping row for the same project across different old clerk_ids.
  const byProject = new Map(otherMappings.map(m => [m.project_id, m]))

  const { data: alreadyGranted } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('project_id')
    .eq('clerk_id', newClerkId)
    .in('project_id', Array.from(byProject.keys()))

  const alreadyGrantedIds = new Set((alreadyGranted ?? []).map(m => m.project_id))
  const toInsert = Array.from(byProject.values())
    .filter(m => !alreadyGrantedIds.has(m.project_id))
    .map(m => ({
      clerk_id: newClerkId,
      email,
      project_id: m.project_id,
      role: m.role,
      permissions: m.permissions,
      added_by_clerk_id: newClerkId,
      is_active: true,
      granted_via: 'new_domain',
    }))

  if (toInsert.length === 0) return

  const { error: insertError } = await supabase.from('pype_voice_email_project_mapping').insert(toInsert)
  if (insertError) {
    console.error('[pending-users] Failed to copy project access for', email, insertError)
  } else {
    console.log(`[pending-users] Copied access to ${toInsert.length} project(s) for`, email)
  }
}

export async function approvePendingUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingUserActionResult> {
  const updated = await transitionStatus(supabase, userId, 'active')
  if (!updated) return { ok: false, reason: 'already_handled' }

  try {
    await copyExistingProjectAccess(supabase, updated.email, updated.clerk_id)
  } catch (err) {
    console.error('[pending-users] Error copying existing project access:', err)
  }

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
