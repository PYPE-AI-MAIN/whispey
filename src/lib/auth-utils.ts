// src/lib/auth-utils.ts
import { auth } from '@clerk/nextjs/server'

/**
 * Gets the current authenticated user ID.
 * Since middleware already protects routes, this is a lightweight helper.
 * If middleware protection is working correctly, userId should always be present.
 * 
 * @returns The authenticated user's ID, or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

/**
 * Wrapper for API route handlers that require authentication.
 * Automatically handles authentication and passes userId to the handler.
 * 
 * @param handler - The route handler function that receives (request, context, userId)
 * @returns The route handler with authentication built-in
 */
export function withAuth<T extends any[]>(
  handler: (request: Request, ...args: [...T, string]) => Promise<Response>
) {
  return async (request: Request, ...args: T): Promise<Response> => {
    const { userId, errorResponse } = await requireAuth()
    
    if (!userId || errorResponse) {
      return errorResponse!
    }

    return handler(request, ...args, userId)
  }
}

