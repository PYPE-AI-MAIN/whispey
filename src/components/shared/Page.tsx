import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
} as const

interface PageProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  width?: keyof typeof WIDTHS
  children: ReactNode
}

/**
 * The one page frame for list and settings screens: same width, gutter, title size and action row,
 * so moving between Campaigns, API keys, Settings and the rest does not shift the page around.
 */
export function Page({ title, description, actions, width = 'default', children }: Readonly<PageProps>) {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className={cn('wp-enter mx-auto px-4 py-6 sm:px-8 sm:py-8', WIDTHS[width])}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
