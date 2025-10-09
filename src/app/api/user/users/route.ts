//Fetch data from pype_voice_users table

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

//use auth to get the user id

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRow, error: fetchError } = await supabase
      .from('pype_voice_users')
      .select('id, agent, roles')
      .eq('clerk_id', userId)
      .single()

    if (fetchError || !userRow) {
      console.error('Error fetching user:', fetchError)
      
      // Handle specific Supabase errors
      if (fetchError?.code === 'PGRST116') {
        // No rows found - user doesn't exist in our database
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }
    console.log('User row:', userRow);

    return NextResponse.json({ data: userRow }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}