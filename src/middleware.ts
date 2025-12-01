import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  "/terms-of-service(.*)",
  "/privacy-policy(.*)",
  '/docs(.*)',
  // Public API routes (webhooks and token-based auth routes)
  '/api/vapi/webhook(.*)',
  '/api/send-logs(.*)',
  '/api/logs/call-logs(.*)',
  '/api/logs/failure-report(.*)',
  '/api/webhooks/clerk(.*)',
  '/api/validate-sso-token(.*)',
  '/api/logs/test-connection(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  // This runs at the edge for optimal performance
  if (!isPublicRoute(request)) {
    await auth.protect();
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