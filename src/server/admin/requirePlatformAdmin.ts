import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

/** Platform admins only (the PYPE_ADMINS emails). Returns the admin's email, or the response to send. */
export async function requirePlatformAdmin(): Promise<{ email: string } | { response: NextResponse }> {
  const { userId } = await auth()
  if (!userId) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const email = (await currentUser())?.emailAddresses?.[0]?.emailAddress ?? ''
  if (!isPlatformAdmin(email)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { email }
}
