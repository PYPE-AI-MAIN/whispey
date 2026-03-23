import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { tags, tagComments } = body as {
      tags?: unknown
      tagComments?: unknown
    }

    // At least one of tags or tagComments must be present
    if (tags === undefined && tagComments === undefined) {
      return NextResponse.json({ error: 'tags or tagComments required' }, { status: 400 })
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    if (tagComments !== undefined && (typeof tagComments !== 'object' || Array.isArray(tagComments) || tagComments === null)) {
      return NextResponse.json({ error: 'tagComments must be an object' }, { status: 400 })
    }

    // Fetch current transcription_metrics so we can merge without clobbering other keys
    const { data: current, error: fetchError } = await supabase
      .from('pype_voice_call_logs')
      .select('transcription_metrics')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const updatedMetrics: Record<string, unknown> = { ...(current?.transcription_metrics || {}) }

    if (tags !== undefined) {
      const cleanTags = (tags as unknown[])
        .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
      updatedMetrics.tags = cleanTags
    }

    if (tagComments !== undefined) {
      // Sanitize: only string values, strip empty comments
      const cleanComments: Record<string, string> = {}
      for (const [k, v] of Object.entries(tagComments as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) {
          cleanComments[k] = v.trim()
        }
      }
      updatedMetrics.tagComments = cleanComments
    }

    const { error } = await supabase
      .from('pype_voice_call_logs')
      .update({ transcription_metrics: updatedMetrics })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log tags:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
