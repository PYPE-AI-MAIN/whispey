import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { hasValidServiceToken } from '@/lib/serviceTokenVerifier';

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
    const isInternalCall = await hasValidServiceToken(request.headers.get('Authorization'))
    if (!isInternalCall) await auth.protect()
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