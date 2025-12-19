import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  "/terms-of-service(.*)",
  "/privacy-policy(.*)",
  '/docs(.*)',
  '/playground(.*)', // Explicit playground route pattern
  // '/api/webhooks(.*)', // if you have public API routes
  '/api(.*)'
  // Add other public routes here
]);

export default clerkMiddleware(async (auth, request) => {
  // Check if the pathname includes '/playground' (for nested routes)
  const pathname = request.nextUrl.pathname
  const isPlaygroundRoute = pathname.includes('/playground')
  
  // If it's a playground route, it's public - don't protect
  if (isPlaygroundRoute) {
    return
  }
  
  // If it's not a public route and user is not authenticated, redirect to sign-in
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