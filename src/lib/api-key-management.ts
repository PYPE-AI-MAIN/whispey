// src/lib/api-key-management.ts
import crypto from 'crypto'
import { encryptWithWhispeyKey } from './whispey-crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Generate a secure API token with pype prefix
 */
export function generateApiToken(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `pype_${randomBytes}`
}

/**
 * Hash a token using SHA-256 for authentication
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Create masked version of token for display
 */
export function maskToken(token: string): string {
  if (token.length < 16) return token
  const prefix = token.substring(0, 8)
  const suffix = token.substring(token.length - 8)
  return `${prefix}...${suffix}`
}

/**
 * Create a new API key entry in the enhanced table
 */
export async function createProjectApiKey(
  projectId: string,
  userClerkId: string,
  apiToken: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const tokenHash = hashToken(apiToken)
    const tokenHashMaster = encryptWithWhispeyKey(apiToken)
    const maskedKey = maskToken(apiToken)

    const { data, error } = await supabase
      .from('pype_voice_api_keys')
      .insert({
        project_id: projectId,
        user_clerk_id: userClerkId,
        token_hash: tokenHash,
        token_hash_master: tokenHashMaster,
        masked_key: maskedKey,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating project API key:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('Unexpected error creating project API key:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get API keys for a project
 */
export async function getProjectApiKeys(projectId: string) {
    try {
      console.log('Getting API keys for project:', projectId)
      
      const { data, error } = await supabase
        .from('pype_voice_api_keys')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
  
      console.log('Supabase response:', { data, error })
  
      if (error) {
        console.error('Error fetching project API keys:', error)
        return { success: false, error: error.message }
      }
  
      console.log('Returning data:', data || [])
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('Unexpected error fetching project API keys:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

/**
 * Update last_used timestamp for an API key
 */
export async function updateKeyLastUsed(tokenHash: string): Promise<void> {
  try {
    await supabase
      .from('pype_voice_api_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('token_hash', tokenHash)
  } catch (error) {
    console.error('Error updating key last used:', error)
    // Don't throw - this is not critical for authentication
  }
}