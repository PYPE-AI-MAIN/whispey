import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== API Route Hit: GET /api/projects/[id]/api-keys ===')
  
  try {
    const { userId } = await auth()
    console.log('User ID from auth:', userId)
    
    if (!userId) {
      console.log('No user ID, returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const projectId = resolvedParams.id
    console.log('Project ID from params:', projectId)

    if (!projectId) {
      console.log('No project ID, returning 400')
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    // First, query the new API keys table
    console.log('Querying new API keys table...')
    const { data: apiKeys, error } = await supabase
      .from('pype_voice_api_keys')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error on new table:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log('New API keys found:', apiKeys?.length || 0)

    // Format keys from new system
    let formattedKeys = (apiKeys || []).map((key: any) => ({
      id: key.id,
      name: key.name || 'Project API Key',
      masked_key: key.masked_key,
      token_hash_master: key.token_hash_master,
      created_at: key.created_at,
      last_used: key.last_used,
      is_active: key.is_active !== false,
      user_clerk_id: key.user_clerk_id,
      legacy: false // This is a new system key
    }))

    // If no keys in new system, check for legacy key in projects table
    if (formattedKeys.length === 0) {
      console.log('No new keys found, checking for legacy key...')
      
      const { data: project, error: projectError } = await supabase
        .from('pype_voice_projects')
        .select('token_hash, created_at, name')
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('Error checking legacy project:', projectError)
        // Don't fail - just continue with empty keys
      } else if (project?.token_hash) {
        console.log('Legacy key found in projects table')
        
        // Add legacy key with masked display
        formattedKeys.push({
          id: 'legacy-key',
          name: 'Legacy Project Key',
          masked_key: '••••••••••••••••••••••••',
          token_hash_master: project.token_hash,
          created_at: project.created_at,
          last_used: null,
          is_active: true,
          user_clerk_id: userId,
          legacy: true
        })
      } else {
        console.log('No legacy key found either')
      }
    }

    console.log('Total formatted keys:', formattedKeys.length)
    console.log('Formatted keys for frontend:', formattedKeys)
    console.log('=== API Route Success ===')

    return NextResponse.json({ 
      success: true,
      keys: formattedKeys 
    })

  } catch (error) {
    console.error('=== API Route Error ===', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}