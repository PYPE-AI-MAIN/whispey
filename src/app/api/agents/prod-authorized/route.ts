import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCallerGlobalRole } from '@/lib/prod-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ authorized: false }, { status: 401 })
  const role = await getCallerGlobalRole(userId)
  return NextResponse.json({ authorized: role === 'superadmin' })
}
