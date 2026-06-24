import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Verify a PYPE_JWT_SECRET-signed Bearer token using the Web Crypto API (Edge-compatible).
// Used for internal server-to-server calls that have no Clerk session.
async function hasValidServiceToken(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const secret = process.env.PYPE_JWT_SECRET
  if (!secret) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const sigInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, sigInput)
    if (!valid) return false
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return !payload.exp || payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

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
  '/api/vapi/webhook(.*)',
  '/api/retell/webhook(.*)',
  '/api/elevenlabs/webhook(.*)',
  '/api/validate-sso-token(.*)',
  '/api/logs/call-logs(.*)',
  '/api/logs/failure-report(.*)',
  '/api/send-logs(.*)',
  '/api/github-stars(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Check if the pathname includes '/playground' (for nested routes)
  const pathname = request.nextUrl.pathname
  const isPlaygroundRoute = pathname.includes('/playground')
  
  // If it's a playground route, it's public - don't protect
  if (isPlaygroundRoute) {
    return
  }
  
  // If it's not a public route, require either a Clerk session or a valid internal service JWT
  if (!isPublicRoute(request)) {
    const isInternalCall = await hasValidServiceToken(request.headers.get('Authorization'))
    if (!isInternalCall) await auth.protect()
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};