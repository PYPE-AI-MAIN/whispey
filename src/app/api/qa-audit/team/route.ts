import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'

/** QA team only: the prompt engineers a flag can be assigned to. */
export async function GET(request: NextRequest) {
  const access = await resolveAgentAccess(request.nextUrl.searchParams.get('agentId') ?? '')
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can see this' }, { status: 403 })
  const { data, error } = await qaDb.from('qa_team_members').select('name, email').eq('role', 'prompt_engineer').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ engineers: data ?? [] })
}
