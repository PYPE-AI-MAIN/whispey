// src/app/api/admin/sync-clerk-id/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, currentUser } from '@clerk/nextjs/server'

// Parse allowed emails from environment variable
const getAllowedEmails = () => {
  return process.env.ALLOWED_SYNC_EMAILS?.split(',').map(email => email.trim()) || []
}

// Create Supabase client lazily (only when needed)
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing')
  }

  return createClient(supabaseUrl, supabaseKey)
}

export async function POST(request: NextRequest) {
  try {
    // Get Supabase client inside the function (runtime, not build time)
    const supabase = getSupabaseClient()
    
    // Verify we have allowed emails configured
    const ALLOWED_EMAILS = getAllowedEmails()
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