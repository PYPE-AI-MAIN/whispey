// src/app/api/admin/sync-clerk-id/route.ts
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

    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: 'User not found in Clerk' }, { status: 404 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 400 })
    }

    // Check if user already has clerk_id
    const { data: existingUserWithClerkId } = await supabase
      .from('pype_voice_users')
      .select('id, clerk_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (existingUserWithClerkId) {
      return NextResponse.json({ 
        synced: true,
        message: 'User already has clerk_id',
        userId: existingUserWithClerkId.id
      }, { status: 200 })
    }

    // Find user by email without clerk_id (for migrated users)
    const { data: userByEmail, error: findError } = await supabase
      .from('pype_voice_users')
      .select('id, clerk_id, email')
      .eq('email', email)
      .is('clerk_id', null)
      .maybeSingle()

    if (findError) {
      console.error('Error finding user by email:', findError)
      return NextResponse.json({ 
        synced: false,
        error: 'Failed to find user'
      }, { status: 500 })
    }

    if (!userByEmail) {
      // No user found with this email and no clerk_id
      return NextResponse.json({ 
        synced: false,
        message: 'No user found to sync'
      }, { status: 404 })
    }

    // Update user with clerk_id
    const { data: updatedUser, error: updateError } = await supabase
      .from('pype_voice_users')
      .update({
        clerk_id: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userByEmail.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user with clerk_id:', updateError)
      return NextResponse.json({ 
        synced: false,
        error: 'Failed to sync clerk_id'
      }, { status: 500 })
    }

    console.log('✅ User synced with clerk_id:', updatedUser.email)

    return NextResponse.json({ 
      synced: true,
      message: 'User synced successfully',
      user: updatedUser
    }, { status: 200 })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ 
      synced: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

