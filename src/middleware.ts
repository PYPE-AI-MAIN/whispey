// src/middleware.ts

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Define which routes are public (don't require authentication)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms-of-service(.*)',
  '/privacy-policy(.*)',
  '/docs(.*)',
  '/api(.*)',
])

// Define admin routes (only SUPERADMIN can access)
const isAdminRoute = createRouteMatcher(['/admin(.*)'])

const isProjectRoute = (pathname: string) => {
  const knownRoutes = ['dashboard', 'settings', 'profile', 'unauthorized', 'admin', 'api', '_next', 'sign-in', 'sign-up', 'terms-of-service', 'privacy-policy', 'docs']
  const firstSegment = pathname.split('/')[1]
  
  if (!firstSegment || knownRoutes.includes(firstSegment)) {
    return false  // ✅ Should skip 'admin'
  }
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidPattern.test(firstSegment)
}

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()

  // ============================================
  // 1. PUBLIC ROUTES - Allow everyone
  // ============================================
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // ============================================
  // 2. REQUIRE AUTHENTICATION for all other routes
  // ============================================
  if (!userId) {
    await auth.protect()
    return
  }

  // ============================================
  // 3. ADMIN ROUTES - Only SUPERADMIN
  // ============================================
  if (isAdminRoute(request)) {
    try {
      const { data: user } = await supabase
        .from('pype_voice_users')
        .select('roles')
        .eq('clerk_id', userId)
        .single()

      if (!user || user.roles?.type !== 'SUPERADMIN') {
        console.log(`❌ Access denied: User ${userId} is not SUPERADMIN`)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      console.log(`✅ SUPERADMIN access granted: ${userId}`)
    } catch (error) {
      console.error('Error checking admin access:', error)
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // ============================================
  // 4. PROJECT ROUTES - Only project members
  // ============================================
  if (isProjectRoute(request.nextUrl.pathname)) {
    try {
      // Extract projectId from URL - handles /abc123/agents, /abc123/settings, etc.
      const pathname = request.nextUrl.pathname
      const projectIdMatch = pathname.match(/^\/([^\/]+)/)
      const projectId = projectIdMatch ? projectIdMatch[1] : null

      // Skip if it's a known non-project route (dashboard, settings, profile, etc.)
      const knownRoutes = ['dashboard', 'settings', 'profile', 'unauthorized', 'admin']
      if (!projectId || knownRoutes.includes(projectId)) {
        return NextResponse.next()
      }

      console.log(`🔍 Checking access for project: ${projectId}`)

      // Get user's email from users table
      const { data: user, error: userError } = await supabase
        .from('pype_voice_users')
        .select('email, roles')
        .eq('clerk_id', userId)
        .single()

      if (userError || !user) {
        console.log(`❌ User not found: ${userId}`)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      // Check if user has access to this project
      const { data: projectAccess, error: accessError } = await supabase
        .from('pype_voice_email_project_mapping')
        .select('role, is_active, clerk_id, email')
        .eq('project_id', projectId)
        .or(`clerk_id.eq.${userId},email.ilike.${user.email}`)
        .maybeSingle()

      if (accessError) {
        console.error('Error checking project access:', accessError)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      // Check if user has active access
      const hasAccess = projectAccess && 
        (projectAccess.is_active === true || projectAccess.is_active === null)

      if (!hasAccess) {
        console.log(`❌ Access denied: User ${userId} (${user.email}) does not have access to project ${projectId}`)
        return NextResponse.redirect(new URL('/unauthorized', request.url))
      }

      console.log(`✅ Project access granted: User ${userId} → Project ${projectId} (role: ${projectAccess.role})`)
    } catch (error) {
      console.error('Error in project access check:', error)
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // ============================================
  // 5. All other authenticated routes - Allow
  // ============================================
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}