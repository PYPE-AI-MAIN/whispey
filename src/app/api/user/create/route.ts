// src/app/api/user/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

const supabase = createServiceRoleClient()

// Links any pending invite mappings (clerk_id = null) for this email to the
// current clerk userId. Safe to call multiple times — only updates null rows.
// This runs here because the Clerk webhook may not fire in dev or may fail,
// so /api/user/create is the reliable fallback that always runs after signup.
async function linkPendingInvites(userId: string, email: string) {
  try {
    const { error } = await supabase
      .from('pype_voice_email_project_mapping')
      .update({ clerk_id: userId })
      .eq('email', email)
      .is('clerk_id', null)
      .eq('is_active', true)

    if (error) {
      console.error('⚠️ Failed to link pending invites:', error)
    } else {
      console.log('🔗 Linked pending invites for', email)
    }
  } catch (err) {
    console.error('⚠️ Error linking pending invites:', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 400 })
    }

    // Atomic upsert — a plain select-then-insert here raced with itself in
    // local dev (React Strict Mode double-invokes the effect that calls this
    // route), producing two rows for the same clerk_id. `ignoreDuplicates`
    // makes this insert-if-not-exists in one DB round trip: if the row
    // already exists (from the webhook or a prior call), this is a no-op —
    // it never overwrites an admin's approval decision on an existing row.
    const isAdmin = isPlatformAdmin(email)
    const { data: upsertedRows, error: upsertError } = await supabase
      .from('pype_voice_users')
      .upsert(
        {
          clerk_id: userId,
          email: email,
          first_name: clerkUser.firstName,
          last_name: clerkUser.lastName,
          profile_image_url: clerkUser.imageUrl,
          is_active: true,
          // Same policy as the webhook — every non-admin signup starts
          // pending, so a local dev signup can't bypass the approval gate.
          approval_status: isAdmin ? 'active' : 'pending',
          approval_token: isAdmin ? null : crypto.randomUUID(),
          roles: {
            type: "USER",
            level: 1,
            metadata: {},
            permissions: []
          }
        },
        { onConflict: 'clerk_id', ignoreDuplicates: true }
      )
      .select()

    if (upsertError) {
      console.error('Error creating user:', upsertError)
      return NextResponse.json({
        error: 'Failed to create user',
        details: upsertError.message
      }, { status: 500 })
    }

    // Link any pending invite mappings regardless of whether this call
    // created the row or the row already existed (webhook fired but
    // linking failed previously, etc).
    await linkPendingInvites(userId, email)

    const newUser = upsertedRows?.[0]
    if (!newUser) {
      // Row already existed (upsert was a no-op) — look it up for the response.
      const { data: existingUser } = await supabase
        .from('pype_voice_users')
        .select('id')
        .eq('clerk_id', userId)
        .maybeSingle()

      return NextResponse.json({
        message: 'User already exists',
        userId: existingUser?.id,
        alreadyExists: true
      }, { status: 200 })
    }

    console.log('✅ User created:', newUser.email)

    return NextResponse.json({
      message: 'User created successfully',
      user: newUser,
      alreadyExists: false
    }, { status: 201 })

  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}