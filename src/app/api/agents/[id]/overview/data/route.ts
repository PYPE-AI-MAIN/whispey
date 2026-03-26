import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: agentId } = await params
  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'dateFrom and dateTo required' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: refreshError } = await supabase.rpc('refresh_call_summary')
  if (refreshError) {
    return NextResponse.json({ error: refreshError.message }, { status: 500 })
  }

  const { data: dailyStats, error: queryError } = await supabase
    .from('call_summary_materialized')
    .select(
      `
      call_date,
      calls,
      total_minutes,
      avg_latency,
      unique_customers,
      successful_calls,
      success_rate,
      total_cost,
      total_billing_minutes,
      total_billing_seconds
    `
    )
    .eq('agent_id', agentId)
    .gte('call_date', dateFrom)
    .lte('call_date', dateTo)
    .order('call_date', { ascending: true })

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const rows = dailyStats || []
  const totalCalls = rows.reduce((sum: number, day: any) => sum + (day.calls || 0), 0)
  const successfulCalls = rows.reduce((sum: number, day: any) => sum + (day.successful_calls || 0), 0)
  const totalCost = rows.reduce((sum: number, day: any) => sum + (day.total_cost || 0), 0)
  const totalMinutes = rows.reduce((sum: number, day: any) => sum + (day.total_minutes || 0), 0)
  const totalBillingMinutes = rows.reduce((sum: number, day: any) => sum + (day.total_billing_minutes || 0), 0)
  const uniqueCustomers = rows.reduce((sum: number, day: any) => sum + (day.unique_customers || 0), 0)

  const averageLatency =
    rows.length > 0 ? rows.reduce((sum: number, day: any) => sum + (day.avg_latency || 0), 0) / rows.length : 0

  const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0

  const dailyData = rows.map((day: any) => ({
    date: day.call_date,
    dateKey: day.call_date,
    calls: day.calls,
    minutes: day.total_minutes,
    avg_latency: day.avg_latency,
  }))

  return NextResponse.json({
    data: {
      totalCalls,
      totalMinutes,
      totalBillingMinutes,
      successfulCalls,
      successRate,
      averageLatency,
      totalCost,
      uniqueCustomers,
      dailyData,
    },
  })
}
