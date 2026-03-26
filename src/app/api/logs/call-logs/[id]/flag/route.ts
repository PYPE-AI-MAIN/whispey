import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { flag } = await request.json() as {
      // null clears the flag; object sets it
      flag: { text: string } | null
    }

    // Fetch current transcription_metrics to merge safely
    const { data: current, error: fetchError } = await supabase
      .from('pype_voice_call_logs')
      .select('transcription_metrics')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    const updatedMetrics: Record<string, unknown> = { ...(current?.transcription_metrics || {}) }

    if (flag === null) {
      delete updatedMetrics.flag
    } else {
      updatedMetrics.flag = {
        text: flag.text.trim(),
        flagged_at: new Date().toISOString(),
      }
    }

    const { error } = await supabase
      .from('pype_voice_call_logs')
      .update({ transcription_metrics: updatedMetrics })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log flag:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
