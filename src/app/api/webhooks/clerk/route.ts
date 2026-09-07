// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'
import { sendPendingApprovalNotice } from '@/lib/sendApprovalEmail'

interface ClerkWebhookEvent {
  data: {
    id: string
    email_addresses: Array<{
      email_address: string
      id: string
    }>
    first_name: string | null
    last_name: string | null
    image_url: string | null
    username: string | null
  }
  type: string
}


export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('🎯 Webhook received')
  
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ Missing CLERK_WEBHOOK_SIGNING_SECRET')
    return new NextResponse('Missing webhook secret', { status: 500 })
  }

  const supabase = createServiceRoleClient()
  
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('❌ Missing svix headers')
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  console.log('📝 Webhook payload type:', payload.type)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: ClerkWebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error('❌ Error verifying webhook:', err)
    return new NextResponse('Error occurred during verification', {
      status: 400,
    })
  }

  const { id } = evt.data
  const eventType = evt.type

  console.log(`🔄 Processing ${eventType} for user ${id}`)

  try {
    if (eventType === 'user.created') {
      const { email_addresses, first_name, last_name, image_url } = evt.data
      const userEmail = email_addresses[0]?.email_address || ''

      // Svix retries user.created on any transient failure — without this
      // guard a retry would insert a second row for the same clerk_id
      // (this is exactly what produced 10 duplicate rows for one signup
      // during testing). Idempotent no-op if this event already landed.
      const { data: existingRow, error: existingLookupError } = await supabase
        .from('pype_voice_users')
        .select('id')
        .eq('clerk_id', id)
        .maybeSingle()

      if (existingLookupError) {
        console.error('❌ Error checking for existing clerk_id:', existingLookupError)
        return new NextResponse('Error checking for existing user', { status: 500 })
      }

      if (existingRow) {
        console.log(`⏭️ user.created retry for already-processed clerk_id ${id} — skipping`)
        return new NextResponse('Webhook processed successfully', { status: 200 })
      }

      console.log('✅ Creating new user in database')

      const isAdmin = isPlatformAdmin(userEmail)

      // Pre-existing (old-domain) account for this email — approval_status is
      // NULL only for rows that predate this feature entirely, never for a
      // row this flow itself created (those are always 'pending'/'active'/'declined').
      // Confirmed design: this account is a NEW, separate row for the new
      // domain's clerk_id — the legacy row and its clerk_id are never
      // touched, so old-domain access for this person keeps working.
      const { data: legacyRow, error: legacyLookupError } = await supabase
        .from('pype_voice_users')
        .select('id, clerk_id')
        .eq('email', userEmail)
        .is('approval_status', null)
        .maybeSingle()

      if (legacyLookupError) {
        console.error('❌ Error checking for legacy user:', legacyLookupError)
        return new NextResponse('Error checking for legacy user', { status: 500 })
      }

      const isRecognizedExistingUser = !!legacyRow

      const { data, error } = await supabase.from('pype_voice_users').insert({
        clerk_id: id,
        email: userEmail,
        first_name: first_name,
        last_name: last_name,
        profile_image_url: image_url,
        // Recognized existing users and PYPE_ADMINS skip the queue outright;
        // everyone else starts pending until a platform admin decides.
        approval_status: isAdmin || isRecognizedExistingUser ? 'active' : 'pending',
        approval_token: isAdmin || isRecognizedExistingUser ? null : crypto.randomUUID(),
      }).select().single()

      if (error) {
        console.error('❌ Error creating user in Supabase:', error)
        return new NextResponse('Error creating user', { status: 500 })
      }

      console.log('🎉 User created successfully:', data)

      if (isRecognizedExistingUser && legacyRow!.clerk_id) {
        // Copy their existing org access onto the new clerk_id — insert only,
        // never update the legacy rows, so old-domain access is untouched.
        const { data: oldMappings, error: oldMappingsError } = await supabase
          .from('pype_voice_email_project_mapping')
          .select('project_id, role, permissions, is_active')
          .eq('clerk_id', legacyRow!.clerk_id)

        if (oldMappingsError) {
          console.error('⚠️ Failed to read legacy project mappings for', userEmail, oldMappingsError)
        } else if (oldMappings && oldMappings.length > 0) {
          const { error: copyError } = await supabase.from('pype_voice_email_project_mapping').insert(
            oldMappings.map((m) => ({
              clerk_id: id,
              email: userEmail,
              project_id: m.project_id,
              role: m.role,
              permissions: m.permissions,
              is_active: m.is_active,
              added_by_clerk_id: id,
              granted_via: 'existing_user_migrated',
            }))
          )
          if (copyError) {
            console.error('⚠️ Failed to copy project mappings for', userEmail, copyError)
          } else {
            console.log(`🔗 Copied ${oldMappings.length} project mapping(s) for`, userEmail)
          }
        }
      } else if (!isAdmin) {
        try {
          const adminEmails = process.env.PYPE_ADMINS?.split(',').map(e => e.trim()).filter(Boolean) || []
          if (adminEmails.length > 0) {
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')
            await sendPendingApprovalNotice({
              adminEmails,
              userEmail,
              userName: `${first_name ?? ''} ${last_name ?? ''}`.trim() || userEmail,
              approveLink: `${appUrl}/api/admin/pending-users/${data.id}/action?decision=approve&token=${data.approval_token}`,
              declineLink: `${appUrl}/api/admin/pending-users/${data.id}/action?decision=decline&token=${data.approval_token}`,
            })
          } else {
            console.warn('⚠️ PYPE_ADMINS not configured — skipping pending-approval notice')
          }
        } catch (notifyErr) {
          console.error('⚠️ Failed to notify admins of pending signup:', notifyErr)
        }
      }

      // Link and consume any pending invite mapping for this email — clearing
      // invite_token makes the invite link single-use (it stops resolving to
      // anything the moment it's claimed), on top of its own 7-day expiry.
      // Non-fatal — user still has access via clerk_id even if this fails.
      try {
        const { error: linkError } = await supabase
          .from('pype_voice_email_project_mapping')
          .update({ clerk_id: id, invite_token: null })
          .eq('email', userEmail)
          .is('clerk_id', null)
          .eq('is_active', true)

        if (linkError) {
          console.error('⚠️ Failed to link pending invites for', userEmail, linkError)
        } else {
          console.log('🔗 Linked pending invites for', userEmail)
        }
      } catch (linkErr) {
        console.error('⚠️ Error linking pending invites for', userEmail, linkErr)
      }
    }

    if (eventType === 'user.updated') {
      const { email_addresses, first_name, last_name, image_url } = evt.data

      console.log('📝 Updating user in database')

      const { data, error } = await supabase
        .from('pype_voice_users')
        .update({
          email: email_addresses[0]?.email_address || '',
          first_name: first_name,
          last_name: last_name,
          profile_image_url: image_url,
          updated_at: new Date().toISOString(),
        })
        .eq('clerk_id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating user in Supabase:', error)
        return new NextResponse('Error updating user', { status: 500 })
      }

      console.log('📝 User updated successfully:', data)
    }

    if (eventType === 'user.deleted') {
      console.log('🗑️ Deleting user from database')

      const { error } = await supabase
        .from('pype_voice_users')
        .delete()
        .eq('clerk_id', id)

      if (error) {
        console.error('❌ Error deleting user from Supabase:', error)
        return new NextResponse('Error deleting user', { status: 500 })
      }

      console.log('🗑️ User deleted successfully')
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }

  console.log('✅ Webhook processed successfully')
  return new NextResponse('Webhook processed successfully', { status: 200 })
}