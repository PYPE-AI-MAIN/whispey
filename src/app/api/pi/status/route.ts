// Safe LLM config probe for Pi (no secrets returned).

import { NextResponse } from 'next/server'
import { PI_MODEL_HISTORY_TURNS } from '@/lib/piPlatformSchema'
import { PI_MODEL_OPTIONS, piModels } from '@/lib/piModels'
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

  const models = piModels(process.env, hasAzure)

  return NextResponse.json({
    provider,
    model: provider === 'none' ? null : models.primary,
    fallbackModel: provider === 'none' ? null : models.fallback,
    selectableModels: provider === 'azure' ? PI_MODEL_OPTIONS : [],
    azureEndpointConfigured: !!process.env.AZURE_OPENAI_ENDPOINT,
    azureKeyConfigured: !!process.env.AZURE_OPENAI_API_KEY,
    openAiKeyConfigured: hasOpenAi,
    apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
    piSystemPromptAppendConfigured: !!process.env.PI_SYSTEM_PROMPT_APPEND?.trim(),
    modelContextTurns: PI_MODEL_HISTORY_TURNS,
  })
}
