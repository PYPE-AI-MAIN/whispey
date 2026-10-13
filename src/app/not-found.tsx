import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/50 px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button>
              Go Back Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

