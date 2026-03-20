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
    const { tags } = await request.json()

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    const cleanTags = tags
      .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)

    // Fetch current transcription_metrics so we can merge without clobbering other keys
    const { data: current, error: fetchError } = await supabase
      .from('pype_voice_call_logs')
      .select('transcription_metrics')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const updatedMetrics = {
      ...(current?.transcription_metrics || {}),
      tags: cleanTags,
    }

    const { error } = await supabase
      .from('pype_voice_call_logs')
      .update({ transcription_metrics: updatedMetrics })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true, tags: cleanTags })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log tags:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
