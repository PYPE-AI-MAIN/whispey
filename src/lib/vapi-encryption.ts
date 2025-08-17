// src/lib/vapi-encryption.ts
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get master key from environment
const VAPI_MASTER_KEY = process.env.VAPI_MASTER_KEY

if (!VAPI_MASTER_KEY) {
  throw new Error('VAPI_MASTER_KEY environment variable is required')
}

/**
 * Generate project-specific encryption key using scrypt (same as crypto.ts)
 * @param projectId - The project ID to derive key from
 * @returns Buffer containing the derived key (32 bytes for AES-256)
 */
export function generateProjectEncryptionKey(projectId: string): Buffer {
  // Use scrypt like crypto.ts (not pbkdf2) for consistency
  // VAPI_MASTER_KEY is guaranteed to be defined due to check above
  return crypto.scryptSync(VAPI_MASTER_KEY!, projectId, 32)
}

/**
 * Encrypt API key with project-specific key using AES-256-GCM (same as crypto.ts)
 * @param apiKey - The API key to encrypt
 * @param projectId - The project ID for key derivation
 * @returns Encrypted string in format "iv:authTag:encrypted"
 */
export function encryptApiKey(apiKey: string, projectId: string): string {
  try {
    const key = generateProjectEncryptionKey(projectId)
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16)
    
    // Create cipher using proper GCM mode
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    
    // Encrypt the text
    let encrypted = cipher.update(apiKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag()
    
    // Return iv + authTag + encrypted data (same format as crypto.ts)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('❌ Vapi encryption error:', error)
    throw new Error('Failed to encrypt Vapi API key')
  }
}

/**
 * Decrypt API key with project-specific key using AES-256-GCM (same as crypto.ts)
 * @param encryptedData - The encrypted data in format "iv:authTag:encrypted"
 * @param projectId - The project ID for key derivation
 * @returns Decrypted API key
 * @throws Error if decryption fails or data is corrupted
 */
export function decryptApiKey(encryptedData: string, projectId: string): string {
  try {
    const key = generateProjectEncryptionKey(projectId)
    
    // Split the encrypted text into its components
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const [ivHex, authTagHex, encrypted] = parts
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    // Create decipher using proper GCM mode
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('❌ Vapi decryption error:', error)
    throw new Error('Failed to decrypt Vapi API key - invalid key or corrupted data')
  }
}

/**
 * Utility function to check if a string appears to be encrypted
 * @param text - The text to check
 * @returns True if the text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  // Check if the text matches the format: hex:hex:hex
  const parts = text.split(':')
  return parts.length === 3 && parts.every(part => /^[a-f0-9]+$/i.test(part))
}

/**
 * Safely encrypt data, handling both plain text and already encrypted data
 * @param apiKey - The API key to encrypt
 * @param projectId - The project ID for key derivation
 * @returns The encrypted text
 */
export function safeEncryptApiKey(apiKey: string, projectId: string): string {
  if (isEncrypted(apiKey)) {
    return apiKey // Already encrypted
  }
  return encryptApiKey(apiKey, projectId)
}

/**
 * Safely decrypt data, handling both encrypted and plain text
 * @param encryptedData - The data to decrypt
 * @param projectId - The project ID for key derivation
 * @returns The decrypted text
 */
export function safeDecryptApiKey(encryptedData: string, projectId: string): string {
  if (!isEncrypted(encryptedData)) {
    return encryptedData // Plain text, return as-is
  }
  return decryptApiKey(encryptedData, projectId)
}

/**
 * Helper function to decrypt Vapi keys from database for API calls
 * @param agentId - The agent ID to fetch keys for
 * @returns Object containing decrypted API keys
 * @throws Error if agent not found or keys missing
 */
export async function getDecryptedVapiKeys(agentId: string): Promise<{
  apiKey: string
  projectApiKey: string
}> {
  const { data: agent, error } = await supabase
    .from('pype_voice_agents')
    .select('vapi_api_key_encrypted, vapi_project_key_encrypted, project_id')
    .eq('id', agentId)
    .single()

  if (error || !agent) {
    throw new Error('Agent not found')
  }

  if (!agent.vapi_api_key_encrypted || !agent.vapi_project_key_encrypted) {
    throw new Error('Vapi keys not found for this agent')
  }

  try {
    return {
      apiKey: decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id),
      projectApiKey: decryptApiKey(agent.vapi_project_key_encrypted, agent.project_id)
    }
  } catch (error) {
    console.error('Decryption error details:', {
      agentId,
      projectId: agent.project_id,
      hasApiKey: Boolean(agent.vapi_api_key_encrypted),
      hasProjectKey: Boolean(agent.vapi_project_key_encrypted),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}