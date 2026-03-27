// src/app/api/agents/[id]/vapi/phone-numbers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { decryptApiKey } from '@/lib/vapi-encryption'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

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

    // Decrypt the API key using unified utility
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