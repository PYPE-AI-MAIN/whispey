// src/app/api/admin/sync-clerk-id/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Parse allowed emails from environment variable
const ALLOWED_EMAILS = process.env.ALLOWED_SYNC_EMAILS?.split(',').map(email => email.trim()) || []

export async function POST(request: NextRequest) {
  try {
    // Verify we have allowed emails configured
    if (ALLOWED_EMAILS.length === 0) {
      console.error('⚠️ No allowed emails configured in ALLOWED_SYNC_EMAILS')
      return NextResponse.json({ 
        error: 'Configuration error: No allowed emails configured' 
      }, { status: 500 })
    }

    // Get current user from Clerk
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clerkUser = await currentUser()
    if (!clerkUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = clerkUser.emailAddresses[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 })
    }

    // Check if email is in whitelist
    if (!ALLOWED_EMAILS.includes(userEmail)) {
      console.log(`⚠️ Sync attempted by non-whitelisted email: ${userEmail}`)
      return NextResponse.json({ 
        synced: false,
        reason: 'Email not in whitelist for migration',
        email: userEmail 
      })
    }

    console.log(`🔄 Starting Clerk ID sync for: ${userEmail}`)
    console.log(`   New Clerk ID: ${userId}`)

    // Call the PostgreSQL function
    const { data, error } = await supabase.rpc('sync_user_clerk_id', {
      p_email: userEmail,
      p_new_clerk_id: userId
    })

    if (error) {
      console.error('❌ Database error during sync:', error)
      return NextResponse.json({ 
        error: 'Sync failed', 
        details: error.message 
      }, { status: 500 })
    }

    if (!data || data.length === 0) {
      console.error('❌ No response from sync function')
      return NextResponse.json({ 
        error: 'No response from sync function' 
      }, { status: 500 })
    }

    const result = data[0]

    if (!result.success) {
      console.log(`ℹ️ Sync skipped for ${userEmail}: ${result.message}`)
      return NextResponse.json({ 
        synced: false,
        reason: result.message,
        oldClerkId: result.old_clerk_id
      })
    }

    console.log(`✅ Sync successful for ${userEmail}`)
    console.log(`   Old Clerk ID: ${result.old_clerk_id}`)
    console.log(`   New Clerk ID: ${userId}`)
    console.log(`   Updates made:`, result.updates_made)

    return NextResponse.json({ 
      synced: true,
      message: result.message,
      oldClerkId: result.old_clerk_id,
      newClerkId: userId,
      updatesMade: result.updates_made
    })

  } catch (error) {
    console.error('❌ Unexpected error during sync:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}