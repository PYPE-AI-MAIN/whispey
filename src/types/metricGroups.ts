export interface MetricGroup {
  id: string
  name: string
  project_id: string
  agent_id: string
  user_email: string
  metric_ids: string[]
  chart_ids: string[] // NEW: Added chart selection
  order: number
  created_at?: string
  updated_at?: string
}

// All possible metric IDs
export const METRIC_IDS = {
  TOTAL_CALLS: 'total_calls',
  TOTAL_MINUTES: 'total_minutes',
  TOTAL_BILLING_MINUTES: 'total_billing_minutes',
  TOTAL_COST: 'total_cost',
  AVG_LATENCY: 'avg_latency',
  SUCCESSFUL_CALLS: 'successful_calls',
  FAILED_CALLS: 'failed_calls',
} as const

export const METRIC_LABELS: Record<string, string> = {
  [METRIC_IDS.TOTAL_CALLS]: 'Total Calls',
  [METRIC_IDS.TOTAL_MINUTES]: 'Total Minutes',
  [METRIC_IDS.TOTAL_BILLING_MINUTES]: 'Billing Minutes',
  [METRIC_IDS.TOTAL_COST]: 'Total Cost',
  [METRIC_IDS.AVG_LATENCY]: 'Response Time',
  [METRIC_IDS.SUCCESSFUL_CALLS]: 'Successful Calls',
  [METRIC_IDS.FAILED_CALLS]: 'Failed Calls',
}

// NEW: Chart IDs and Labels
export const CHART_IDS = {
  DAILY_CALLS: 'daily_calls',
  SUCCESS_ANALYSIS: 'success_analysis',
  DAILY_MINUTES: 'daily_minutes',
  AVG_LATENCY: 'avg_latency',
} as const

export const CHART_LABELS: Record<string, string> = {
  [CHART_IDS.DAILY_CALLS]: 'Daily Call Volume',
  [CHART_IDS.SUCCESS_ANALYSIS]: 'Success Analysis',
  [CHART_IDS.DAILY_MINUTES]: 'Usage Minutes',
  [CHART_IDS.AVG_LATENCY]: 'Response Performance',
}