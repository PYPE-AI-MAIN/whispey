// Mock User Data - No Database Required!
import { auth, currentUser } from '@clerk/nextjs/server'
import { MockDataService } from './mockData'

export interface PyveVoiceUser {
  id?: number
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  profile_image_url: string | null
  created_at?: string
  updated_at?: string
}

// Server-side function to get current user's data from mock data
export async function getCurrentUserProfile(): Promise<{
  data: PyveVoiceUser | null
  error: string | null
}> {
  try {
    const { userId } = await auth()
    if (!userId) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get user from mock data service
    const mockUser = MockDataService.getUserByClerkId(userId)
    
    if (!mockUser) {
      // Return a default mock user
      const user = await currentUser()
      const mockUserData: PyveVoiceUser = {
        id: 1,
        clerk_id: userId,
        email: user?.emailAddresses?.[0]?.emailAddress || 'demo@example.com',
        first_name: user?.firstName || 'Demo',
        last_name: user?.lastName || 'User',
        profile_image_url: user?.imageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return { data: mockUserData, error: null }
    }

    return { data: mockUser, error: null }
  } catch (error) {
    console.error('Error getting user profile:', error)
    return { data: null, error: 'Failed to get user profile' }
  }
}

export async function getCurrentClerkUser() {
  return await currentUser()
}