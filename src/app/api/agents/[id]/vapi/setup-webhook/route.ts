// src/app/api/agents/[id]/vapi/setup-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptApiKey } from '@/lib/vapi-encryption'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    console.log('🔗 Setting up webhook for agent:', agentId)

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

    if (!agent.vapi_api_key_encrypted || !agent.vapi_project_key_encrypted || !assistantId) {
      return NextResponse.json({
        error: 'Missing required credentials',
        details: {
          hasApiKey: Boolean(agent.vapi_api_key_encrypted),
          hasAssistantId: Boolean(assistantId),
          hasProjectKey: Boolean(agent.vapi_project_key_encrypted)
        }
      }, { status: 400 })
    }

    // Decrypt the keys using utility function
    let vapiApiKey: string
    let vapiProjectKey: string
    
    try {
      vapiApiKey = decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id)
      vapiProjectKey = decryptApiKey(agent.vapi_project_key_encrypted, agent.project_id)
      console.log('🔐 Successfully decrypted Vapi keys for webhook setup')
    } catch (err) {
      console.error('❌ Failed to decrypt Vapi keys:', err)
      return NextResponse.json({
        error: 'Failed to decrypt Vapi keys'
      }, { status: 500 })
    }

    // 4. Prepare webhook configuration
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.whispey.xyz'}/api/vapi/webhook`
    
    const webhookConfig = {
      serverUrl: webhookUrl,
      serverMessages: ["end-of-call-report", "status-update"],
      metadata: {
        agentId: agentId,
        xPypeToken: vapiProjectKey
      }
    }

    console.log('🔗 Setting up webhook for assistant:', assistantId)
    console.log('📝 Webhook config:', webhookConfig)

    // 5. Call Vapi API to setup webhook
    const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookConfig)
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('❌ Vapi webhook setup error:', errorText)
      
      let errorMessage = `Vapi API error: ${vapiResponse.status}`
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        if (errorText) errorMessage = errorText
      }
      
      return NextResponse.json({
        error: 'Failed to setup webhook',
        message: errorMessage,
        details: {
          status: vapiResponse.status,
          response: errorText
        }
      }, { status: 400 })
    }

    const updatedAssistant = await vapiResponse.json()
    console.log('✅ Webhook setup successful:', updatedAssistant)

    return NextResponse.json({
      success: true,
      message: 'Webhook configured successfully',
      webhook: {
        url: webhookUrl,
        configured: true
      },
      assistant: {
        id: updatedAssistant.id,
        name: updatedAssistant.name,
        serverUrl: updatedAssistant.serverUrl
      }
    })

  } catch (error) {
    console.error('💥 Error setting up webhook:', error)
    
    return NextResponse.json({
      error: 'Failed to setup webhook',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}