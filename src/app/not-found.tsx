import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="text-2xl font-semibold text-foreground">We couldn&apos;t find that page</h1>
        <p className="text-muted-foreground">
          The link may be old, or the agent or project may have been deleted. Check the address, or head back to your
          workspace.
        </p>
        <div className="flex justify-center gap-2 pt-4">
          <Button asChild>
            <Link href="/projects">Go to your workspace</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="/docs" target="_blank" rel="noopener noreferrer">Read the docs</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
