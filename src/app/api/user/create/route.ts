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