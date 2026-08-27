import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { hasValidServiceToken } from '@/lib/serviceTokenVerifier';
import { isPlatformAdmin } from '@/lib/isPlatformAdmin';

// Edge-safe: a plain REST fetch, no @supabase/supabase-js — same reasoning as
// serviceTokenVerifier.ts avoiding Node-only deps in this file. Returns
// undefined (not found) or the row's approval fields.
async function fetchApprovalStatus(clerkId: string): Promise<{ email: string | null; approval_status: string | null } | null> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(
      `${url}/rest/v1/pype_voice_users?clerk_id=eq.${encodeURIComponent(clerkId)}&select=email,approval_status`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  } catch {
    return null
  }
}

// New-domain signup-approval gate: a signed-in user whose account isn't
// 'active' yet can reach only these, regardless of what route they hit.
const isApprovalGateExemptRoute = createRouteMatcher([
  '/pending-approval(.*)',
  '/api/me/status(.*)',
]);

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  "/terms-of-service(.*)",
  "/privacy-policy(.*)",
  '/docs(.*)',
  '/playground(.*)',
  '/invite(.*)',
  // Public API routes (external callers — no Clerk session)
  '/api/webhooks(.*)',
  '/api/health(.*)',
  '/api/vapi/webhook(.*)',
  '/api/retell/webhook(.*)',
  '/api/elevenlabs/webhook(.*)',
  '/api/validate-sso-token(.*)',
  '/api/logs/call-logs(.*)',
  '/api/logs/failure-report(.*)',
  '/api/send-logs(.*)',
  // Public playground needs these without a Clerk session
  '/api/agents/status(.*)',
  '/api/agent-config(.*)',
  '/api/agents/:id/update-voice',
]);

// GET-only reads the public playground needs (PATCH/DELETE on the same path must stay protected)
const isPublicPlaygroundGet = createRouteMatcher(['/api/agents/:id']);

export default clerkMiddleware(async (auth, request) => {
  // Check if the pathname includes '/playground' (for nested routes)
  const pathname = request.nextUrl.pathname
  const isPlaygroundRoute = pathname.includes('/playground')

  // If it's a playground route, it's public - don't protect
  if (isPlaygroundRoute) {
    return
  }

  if (request.method === 'GET' && isPublicPlaygroundGet(request)) {
    return
  }

  // If it's not a public route, require either a Clerk session or a valid internal service JWT
  if (!isPublicRoute(request)) {
    const authHeader = request.headers.get('Authorization')
    // TEMP DEBUG — remove after confirming PYPE_JWT_SECRET visibility in middleware
    console.log('[middleware debug]', {
      path: pathname,
      method: request.method,
      hasAuthHeader: !!authHeader,
      hasSecret: !!process.env.PYPE_JWT_SECRET,
    })
    const isInternalCall = await hasValidServiceToken(authHeader)
    console.log('[middleware debug] isInternalCall:', isInternalCall)
    if (!isInternalCall) {
      const { userId } = await auth.protect()

      if (userId && !isApprovalGateExemptRoute(request)) {
        const caller = await fetchApprovalStatus(userId)

        // Grandfather any row that predates this gate (approval_status is
        // NULL, e.g. accounts created during earlier testing) — only an
        // explicit 'pending'/'declined' blocks. Fail closed only when no row
        // exists at all yet (e.g. webhook hasn't landed for a brand-new
        // signup) — never treated as active by default in that case.
        const status = caller?.approval_status
        const approved = isPlatformAdmin(caller?.email) || (caller !== null && status !== 'pending' && status !== 'declined')

        if (!approved) {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
          }
          return NextResponse.redirect(new URL('/pending-approval', request.url))
        }
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', // NOSONAR javascript:S7780 — String.raw breaks Next.js static analysis of config.matcher
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};