// src/app/api/user/create/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Clerk user details
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    const firstName = clerkUser.firstName
    const lastName = clerkUser.lastName
    const profileImageUrl = clerkUser.imageUrl

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 400 })
    }

    // Check if user already exists (by clerk_id OR email)
    const { data: existingUser } = await supabase
      .from('pype_voice_users')
      .select('id, clerk_id, email')
      .or(`clerk_id.eq.${userId},email.eq.${email}`)
      .maybeSingle()

    if (existingUser) {
      console.log('ℹ️ User already exists:', existingUser.id)
      return NextResponse.json({ 
        message: 'User already exists',
        userId: existingUser.id,
        alreadyExists: true
      }, { status: 200 })
    }

    // ✅ CHANGED: Default to USER role, not BETA
    const { data: newUser, error: createError } = await supabase
      .from('pype_voice_users')
      .insert({
        clerk_id: userId,
        email: email,
        first_name: firstName,
        last_name: lastName,
        profile_image_url: profileImageUrl,
        is_active: true,
        agent: {
          usage: {
            active_count: 0
          },
          agents: [],
          limits: {
            max_agents: 0  // ✅ User-level is now 0 (not used anymore)
          },
          last_updated: ""
        },
        roles: {
          type: "USER",      // ✅ CHANGED: Default to USER
          level: 1,
          metadata: {},
          permissions: []
        }
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Error creating user:', createError)
      return NextResponse.json({ 
        error: 'Failed to create user',
        details: createError.message 
      }, { status: 500 })
    }

    console.log('✅ New user created:', newUser.id, '-', email, '- Role: USER')

    // Auto-claim pending email invitations
    const { data: pendingInvites, error: invitesError } = await supabase
      .from('pype_voice_email_project_mapping')
      .select('id, project_id, role, permissions')
      .eq('email', email)
      .is('clerk_id', null)

    let claimedCount = 0

    if (!invitesError && pendingInvites && pendingInvites.length > 0) {
      console.log(`📨 Found ${pendingInvites.length} pending invitations for ${email}`)
      
      const { error: claimError } = await supabase
        .from('pype_voice_email_project_mapping')
        .update({ 
          clerk_id: userId,
          joined_at: new Date().toISOString()
        })
        .eq('email', email)
        .is('clerk_id', null)

      if (claimError) {
        console.error('⚠️ Error claiming invitations:', claimError)
      } else {
        claimedCount = pendingInvites.length
        console.log(`✅ Claimed ${claimedCount} project invitation(s)`)
      }
    } else if (invitesError) {
      console.error('⚠️ Error fetching pending invites:', invitesError)
    } else {
      console.log('ℹ️ No pending invitations found for', email)
    }

    return NextResponse.json({ 
      message: 'User created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        clerk_id: newUser.clerk_id,
        role: 'USER'
      },
      claimedInvitations: claimedCount,
      alreadyExists: false
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Unexpected error creating user:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}