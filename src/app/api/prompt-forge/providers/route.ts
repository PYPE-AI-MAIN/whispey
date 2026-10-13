import { NextRequest, NextResponse } from 'next/server'
import { requireForgeUser } from '@/server/promptForge/access'
import { allProviderAvailability } from '@/server/promptForge/llm'

export const runtime = 'nodejs'

// Which Agent Config LLM providers Prompt Forge can run on this server (it has their key).
export async function GET(request: NextRequest) {
  const access = await requireForgeUser(new URL(request.url).searchParams.get('project_id'))
  if ('response' in access) return access.response
  return NextResponse.json(allProviderAvailability())
}
