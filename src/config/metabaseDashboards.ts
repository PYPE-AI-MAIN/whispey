export const METABASE_BASE_URL = 'http://analytics.pypeai.com'

const DYNAMIC_DASHBOARD_UUID = 'b049aa11-bcfa-497f-9c74-e4566cd75950'

export function getPublicDashboardUrl(projectId: string): string | null {
  return `${METABASE_BASE_URL}/public/dashboard/${DYNAMIC_DASHBOARD_UUID}`
}