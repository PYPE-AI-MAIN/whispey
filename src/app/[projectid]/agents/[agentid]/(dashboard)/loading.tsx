import { DashboardSkeleton } from '@/components/analytics/DashboardSkeleton'

/**
 * Shown while the agent page loads. It draws the same shape the canvas draws,
 * from the same component — the previous version was a hand-copied skeleton of
 * the old Overview and went on showing six light-grey metric tiles long after
 * that page was gone.
 */
export default function AgentDashboardLoading() {
  return (
    <div className="h-screen bg-white dark:bg-gray-950">
      <DashboardSkeleton withHeader />
    </div>
  )
}
