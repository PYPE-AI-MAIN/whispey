import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('pype_voice_promptforge_sessions')
      .select('*')
      .eq('id', sessionid)
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

const ALLOWED_FIELDS = ['name', 'system_prompt', 'variables', 'tools', 'messages', 'model', 'provider', 'temperature'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  try {
    const body = await request.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const field of ALLOWED_FIELDS) {
      if (field in body) updates[field] = body[field]
    }

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('pype_voice_promptforge_sessions')
      .update(updates)
      .eq('id', sessionid)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionid: string }> },
) {
  const { sessionid } = await params
  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('pype_voice_promptforge_sessions')
      .delete()
      .eq('id', sessionid)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
