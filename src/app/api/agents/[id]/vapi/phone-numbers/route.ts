// src/app/api/agents/[id]/vapi/phone-numbers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const MASTER_KEY = process.env.VAPI_MASTER_KEY || 'your-master-key'

// Same decryption functions as your main vapi route
function generateProjectEncryptionKey(projectId: string): Buffer {
  return crypto.pbkdf2Sync(projectId, MASTER_KEY, 100000, 32, 'sha512')
}

function decryptApiKey(encryptedData: string, projectId: string): string {
  const algorithm = 'aes-256-gcm'
  const key = generateProjectEncryptionKey(projectId)
  
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipher(algorithm, key)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  console.log('📱 GET /api/agents/[id]/vapi/phone-numbers called for agent:', agentId)
  
  try {
    const { searchParams } = new URL(request.url)
    const assistantId = searchParams.get('assistantId')
    const limit = searchParams.get('limit') || '100'

    console.log('🎯 Looking for phone numbers for assistant:', assistantId)

    // Fetch agent data from database
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('vapi_api_key_encrypted, vapi_project_key_encrypted, configuration, project_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (!agent.vapi_api_key_encrypted) {
      return NextResponse.json(
        { error: 'No Vapi API key configured for this agent' },
        { status: 400 }
      )
    }

    // Decrypt the API key
    let vapiToken: string
    try {
      vapiToken = decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id)
      console.log('🔐 Successfully decrypted Vapi API key for phone numbers')
    } catch (err) {
      console.error('❌ Failed to decrypt Vapi API key:', err)
      return NextResponse.json(
        { error: 'Failed to decrypt Vapi API key' },
        { status: 500 }
      )
    }

    // Fetch phone numbers from Vapi
    const url = `https://api.vapi.ai/phone-number?limit=${limit}`
    console.log('🔍 Fetching phone numbers from Vapi:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Vapi API error:', errorText)
      return NextResponse.json(
        { error: `Failed to fetch phone numbers: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const phoneNumbers = await response.json()
    console.log('✅ Successfully fetched phone numbers:', phoneNumbers?.length || 'unknown count')
    console.log('📋 All phone numbers:', phoneNumbers)

    // Process and filter phone numbers
    let processedNumbers = phoneNumbers.map((number: any) => ({
      id: number.id,
      number: number.number || number.phoneNumber,
      provider: number.provider || 'vapi',
      assistantId: number.assistantId || null,
      name: number.name || null,
      createdAt: number.createdAt,
      updatedAt: number.updatedAt,
    }))

    console.log('📱 Processed numbers before filtering:', processedNumbers)

    if (assistantId) {
      console.log('🎯 Filtering phone numbers for assistant:', assistantId)
      processedNumbers = processedNumbers.filter((number: any) => {
        console.log(`📞 Checking number ${number.number}: assistantId = ${number.assistantId} (matches: ${number.assistantId === assistantId})`)
        return number.assistantId === assistantId
      })
      console.log('📱 Found phone numbers for this assistant:', processedNumbers.length)
    }

    console.log('📱 Final filtered results:', processedNumbers)
    
    return NextResponse.json({ 
      success: true,
      phoneNumbers: processedNumbers,
      total: processedNumbers.length,
      assistantId: assistantId || null
    })

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}