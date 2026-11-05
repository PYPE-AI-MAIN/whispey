import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/server/admin/requirePlatformAdmin'

/** Does the signed-in user get the Data destinations admin panel? Same check as the page and its API. */
export async function GET() {
  const admin = await requirePlatformAdmin()
  return NextResponse.json({ isDataAdmin: !('response' in admin) })
}
