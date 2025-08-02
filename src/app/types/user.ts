export interface PyveVoiceUser {
    id?: number
    clerk_id: string
    email: string
    first_name: string | null
    last_name: string | null
    profile_image_url: string | null
    created_at?: string
    updated_at?: string
    // Add any other existing columns you have
  }
  
  export interface UserProfileUpdate {
    email?: string
    first_name?: string | null
    last_name?: string | null
    profile_image_url?: string | null
  }
  
  export interface DatabaseResponse<T> {
    data: T | null
    error: string | null
  }