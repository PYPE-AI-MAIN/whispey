import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { data: templates, error } = await supabase
      .from('pype_voice_metrics_templates')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) {
      console.error('Error fetching metrics templates:', error)
      return NextResponse.json({ error: 'Failed to fetch metrics templates' }, { status: 500 })
    }

    return NextResponse.json(templates, { status: 200 })
  } catch (error) {
    console.error('Unexpected error fetching metrics templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

