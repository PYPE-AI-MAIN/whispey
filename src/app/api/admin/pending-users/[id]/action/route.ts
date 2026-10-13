// Email-clickable Approve/Decline link, landed on directly from an admin's
// inbox. Deliberately GET and deliberately still behind normal Clerk auth
// (see isPublicRoute in middleware.ts — this route is NOT in it): an
// automated email-security link-scanner has no Clerk session and can only
// ever hit the sign-in wall here, never execute the action. A real admin
// who isn't currently signed in gets bounced through sign-in and back,
// same redirect_url pattern already used by /invite/[token].
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'
import { approvePendingUser, declinePendingUser } from '@/lib/pendingUserActions'

export const runtime = 'nodejs'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function htmlPage(title: string, message: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#111827">` +
      `<h1 style="font-size:20px">${title}</h1><p style="color:#6b7280">${message}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    const redirectUrl = encodeURIComponent(request.url)
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${redirectUrl}`, request.url))
  }

  const caller = await currentUser()
  if (!isPlatformAdmin(caller?.emailAddresses?.[0]?.emailAddress)) {
    return htmlPage('Not authorized', 'Your account is not a platform admin.')
  }

  const { id: targetUserId } = await params
  const { searchParams } = new URL(request.url)
  const decision = searchParams.get('decision')
  const token = searchParams.get('token')

  if (decision !== 'approve' && decision !== 'decline') {
    return htmlPage('Invalid link', 'This link is malformed.')
  }
  if (!token) {
    return htmlPage('Invalid link', 'This link is missing its security token.')
  }

  const supabase = createServiceRoleClient()
  const { data: target, error: targetError } = await supabase
    .from('pype_voice_users')
    .select('id, email, approval_status, approval_token, created_at')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetError) {
    return htmlPage('Something went wrong', targetError.message)
  }
  if (!target) {
    return htmlPage('Request not found', 'This signup request no longer exists.')
  }
  if (target.approval_status !== 'pending') {
    return htmlPage(
      'Already handled',
      `This request was already ${target.approval_status === 'active' ? 'approved' : target.approval_status} — no action taken.`
    )
  }
  if (target.approval_token !== token) {
    return htmlPage('Invalid link', 'This link does not match an active request.')
  }
  if (Date.now() - new Date(target.created_at).getTime() > TOKEN_TTL_MS) {
    return htmlPage(
      'Link expired',
      'This approval link is more than 7 days old. Use Settings → Users → Requests to decide on this request instead.'
    )
  }

  const result =
    decision === 'approve'
      ? await approvePendingUser(supabase, targetUserId)
      : await declinePendingUser(supabase, targetUserId)

  if (!result.ok) {
    return htmlPage('Already handled', 'Someone else already acted on this request — no action taken.')
  }

  return htmlPage(
    decision === 'approve' ? 'Approved' : 'Declined',
    `${target.email} has been ${decision === 'approve' ? 'approved and notified' : 'declined and notified'}.`
  )
}
