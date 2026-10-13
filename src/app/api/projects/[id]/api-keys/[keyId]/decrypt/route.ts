// src/app/api/projects/[id]/api-keys/[keyId]/decrypt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'

const supabase = createServiceRoleClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, keyId } = await params

    // API keys are project secrets — require admin/owner, not just any member
    const callerRole = await getProjectRoleForApi(projectId)
    if (!callerRole || !['admin', 'owner'].includes(callerRole.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the encrypted key
    const { data: apiKey, error } = await supabase
      .from('pype_voice_api_keys')
      .select('token_hash_master, project_id')
      .eq('id', keyId)
      .eq('project_id', projectId)
      .single()

    if (error || !apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Decrypt and return
    const decryptedKey = decryptWithWhispeyKey(apiKey.token_hash_master)
    
    return NextResponse.json({ full_key: decryptedKey })
  } catch (error) {
    console.error('Error decrypting API key:', error)
    return NextResponse.json({ error: 'Failed to decrypt key' }, { status: 500 })
  }
}