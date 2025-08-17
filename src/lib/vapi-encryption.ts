// src/lib/vapi-encryption.ts
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Master encryption key from environment (for deriving user-specific keys)
const MASTER_KEY = process.env.VAPI_MASTER_KEY || 'your-secure-master-key-here'

// Generate project-specific encryption key
export function generateProjectEncryptionKey(projectId: string): Buffer {
  // Derive a unique key for each project
  return crypto.pbkdf2Sync(projectId, MASTER_KEY, 100000, 32, 'sha512')
}

// Encrypt API key with project-specific key
export function encryptApiKey(apiKey: string, projectId: string): string {
  const algorithm = 'aes-256-gcm'
  const key = generateProjectEncryptionKey(projectId)
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipher(algorithm, key)
  let encrypted = cipher.update(apiKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return iv + authTag + encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

// Decrypt API key with project-specific key
export function decryptApiKey(encryptedData: string, projectId: string): string {
  const algorithm = 'aes-256-gcm'
  const key = generateProjectEncryptionKey(projectId)
  
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }
  
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipher(algorithm, key)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Helper function to decrypt Vapi keys when needed for API calls
export async function getDecryptedVapiKeys(agentId: string) {
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

  return {
    apiKey: decryptApiKey(agent.vapi_api_key_encrypted, agent.project_id),
    projectApiKey: decryptApiKey(agent.vapi_project_key_encrypted, agent.project_id)
  }
}