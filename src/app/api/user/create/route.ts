// src/app/api/user/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

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

    // Check if already exists
    const { data: existingUser } = await supabase
      .from('pype_voice_users')
      .select('id, clerk_id')
      .or(`clerk_id.eq.${userId},email.eq.${email}`)
      .maybeSingle()

    if (existingUser) {
      // User already exists — still try to link pending invites in case
      // the Clerk webhook fired but the linking step failed
      await linkPendingInvites(userId, email)

      return NextResponse.json({ 
        message: 'User already exists',
        userId: existingUser.id,
        alreadyExists: true
      }, { status: 200 })
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('pype_voice_users')
      .insert({
        clerk_id: userId,
        email: email,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        profile_image_url: clerkUser.imageUrl,
        is_active: true,
        roles: {
          type: "USER",
          level: 1,
          metadata: {},
          permissions: []
        }
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating user:', createError)
      return NextResponse.json({ 
        error: 'Failed to create user',
        details: createError.message 
      }, { status: 500 })
    }

    console.log('✅ User created:', newUser.email)

    // Link any pending invite mappings for this newly created user
    await linkPendingInvites(userId, email)

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