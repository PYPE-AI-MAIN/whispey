// src/lib/crypto.ts
import crypto from 'crypto'

// Get encryption key from environment variable
const VAPI_MASTER_KEY = process.env.VAPI_MASTER_KEY

if (!VAPI_MASTER_KEY) {
  throw new Error('VAPI_MASTER_KEY environment variable is required')
}

// Ensure the key is 32 bytes (256 bits) for AES-256
const key = crypto.scryptSync(VAPI_MASTER_KEY, 'salt', 32)

/**
 * Encrypts a string using AES-256-GCM
 * @param text - The text to encrypt
 * @returns The encrypted text with IV and auth tag (format: iv:authTag:encryptedData)
 */
export function encrypt(text: string): string {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16)
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag()
    
    // Combine IV, auth tag, and encrypted data
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('❌ Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedText - The encrypted text (format: iv:authTag:encryptedData)
 * @returns The decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    // Split the encrypted text into its components
    const parts = encryptedText.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }
    
    const [ivHex, authTagHex, encrypted] = parts
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('❌ Decryption error:', error)
    throw new Error('Failed to decrypt data - invalid key or corrupted data')
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
 * @param text - The text to encrypt
 * @returns The encrypted text
 */
export function safeEncrypt(text: string): string {
  if (isEncrypted(text)) {
    return text // Already encrypted
  }
  return encrypt(text)
}

/**
 * Safely decrypt data, handling both encrypted and plain text
 * @param text - The text to decrypt
 * @returns The decrypted text
 */
export function safeDecrypt(text: string): string {
  if (!isEncrypted(text)) {
    return text // Plain text, return as-is
  }
  return decrypt(text)
}