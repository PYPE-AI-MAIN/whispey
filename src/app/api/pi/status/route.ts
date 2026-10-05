// Safe LLM config probe for Pi (no secrets returned).

import { NextResponse } from 'next/server'
import { PI_MODEL_HISTORY_TURNS } from '@/lib/piPlatformSchema'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const hasAzure = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
  const hasOpenAi = !!process.env.OPENAI_API_KEY
  let provider = 'none'
  if (hasAzure) provider = 'azure'
  else if (hasOpenAi) provider = 'openai'

  return NextResponse.json({
    provider,
    model: process.env.AZURE_DEPLOYMENT_NAME || (hasOpenAi ? 'gpt-4o-mini' : null),
    azureEndpointConfigured: !!process.env.AZURE_OPENAI_ENDPOINT,
    azureKeyConfigured: !!process.env.AZURE_OPENAI_API_KEY,
    openAiKeyConfigured: hasOpenAi,
    apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
    piSystemPromptAppendConfigured: !!process.env.PI_SYSTEM_PROMPT_APPEND?.trim(),
    modelContextTurns: PI_MODEL_HISTORY_TURNS,
  })
}
