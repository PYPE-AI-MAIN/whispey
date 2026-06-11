import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isProdAuthorized } from '@/lib/prod-auth'

export const dynamic = 'force-dynamic'

// Returns whether the currently authenticated user is allowed to write to prod agents.
// Authorization is determined entirely server-side from the Clerk session — the client
// sends no email or claims. The authorized email list lives in PROD_AUTHORIZED_EMAILS
// (server-only env var, never exposed to the browser).
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ authorized: false }, { status: 401 })
  }
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  return NextResponse.json({ authorized: isProdAuthorized(email) })
}
