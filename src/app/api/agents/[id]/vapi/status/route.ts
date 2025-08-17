// src/app/api/agents/[id]/vapi/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const MASTER_KEY = process.env.VAPI_MASTER_KEY || 'your-master-key'

// Decryption functions
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
  try {
    const { id: agentId } = await params
    console.log('🔍 Checking Vapi status for agent:', agentId)

    // 1. Get agent data from database
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted, project_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      console.error('❌ Agent not found:', agentError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // 2. Check if this is a Vapi agent
    const isVapiAgent = agent.agent_type === 'vapi' || 
                       Boolean(agent.configuration?.vapi?.assistantId) ||
                       Boolean(agent.vapi_api_key_encrypted)

    if (!isVapiAgent) {
      return NextResponse.json(
        { error: 'Not a Vapi agent' },
        { status: 400 }
      )
    }

    // 3. Get required credentials and decrypt
    const assistantId = agent.configuration?.vapi?.assistantId

    if (!agent.vapi_api_key_encrypted || !assistantId) {
      return NextResponse.json({
        connected: false,
        status: 'missing_credentials',
        message: 'Missing Vapi API key or assistant ID',
        details: {
          hasApiKey: Boolean(agent.vapi_api_key_encrypted),
          hasAssistantId: Boolean(assistantId)
        }
      })
    }

    // Decrypt the API key
    let vapiApiKey: string
    try {
      vapiApiKey = decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id)
      console.log('🔐 Successfully decrypted Vapi API key for status check')
    } catch (err) {
      console.error('❌ Failed to decrypt Vapi API key:', err)
      return NextResponse.json({
        connected: false,
        status: 'decryption_error',
        message: 'Failed to decrypt Vapi API key'
      })
    }

    // 4. Call Vapi API to check webhook configuration
    const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('❌ Vapi API error:', errorText)
      
      return NextResponse.json({
        connected: false,
        status: 'api_error',
        message: `Vapi API error: ${vapiResponse.status}`,
        details: {
          status: vapiResponse.status,
          error: errorText
        }
      })
    }

    const assistantData = await vapiResponse.json()

    // 5. Check webhook configuration
    const expectedWebhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.whispey.xyz'}/api/vapi/webhook`
    const hasWebhook = Boolean(assistantData.serverUrl)
    const webhookMatches = assistantData.serverUrl === expectedWebhookUrl
    const hasMetadata = Boolean(assistantData.metadata)
    const hasAgentId = assistantData.metadata?.agentId === agentId
    const hasProjectToken = Boolean(assistantData.metadata?.xPypeToken)

    const isFullyConnected = hasWebhook && 
                           webhookMatches && 
                           hasMetadata && 
                           hasAgentId && 
                           hasProjectToken

    return NextResponse.json({
      connected: isFullyConnected,
      status: isFullyConnected ? 'connected' : 'needs_setup',
      message: isFullyConnected ? 'Webhook properly configured' : 'Webhook setup required',
      details: {
        webhook: {
          configured: hasWebhook,
          url: assistantData.serverUrl,
          matches: webhookMatches,
          expected: expectedWebhookUrl
        },
        metadata: {
          present: hasMetadata,
          agentId: assistantData.metadata?.agentId,
          hasAgentId: hasAgentId,
          hasProjectToken: hasProjectToken
        },
        assistant: {
          id: assistantData.id,
          name: assistantData.name
        }
      }
    })

  } catch (error) {
    console.error('💥 Error checking Vapi status:', error)
    
    return NextResponse.json({
      connected: false,
      status: 'error',
      message: 'Failed to check connection status',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}