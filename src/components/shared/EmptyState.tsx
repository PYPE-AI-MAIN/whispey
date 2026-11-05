import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Empty list or panel: say what is missing, why it is fine, and offer the one next step. */
export function EmptyState({ icon: Icon, title, description, action, className }: Readonly<EmptyStateProps>) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
