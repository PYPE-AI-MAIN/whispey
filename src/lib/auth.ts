// src/lib/auth.ts
import crypto from 'crypto';
import { supabase } from './supabase';
import { updateKeyLastUsed } from './api-key-management';
import { TokenVerificationResult } from '../types/logs';

export const verifyToken = async (token: string, environment: string = 'dev'): Promise<TokenVerificationResult> => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // First, check the new API keys table
    const { data: newApiKey, error: newError } = await supabase
      .from('pype_voice_api_keys')
      .select('project_id, last_used')
      .eq('token_hash', tokenHash)
      .single();

    if (!newError && newApiKey) {
      // Update last used timestamp asynchronously
      updateKeyLastUsed(tokenHash).catch(err => 
        console.error('Failed to update key last used:', err)
      );

      return { 
        valid: true, 
        token: { id: newApiKey.project_id },
        project_id: newApiKey.project_id,
        source: 'new_system'
      };
    }

    // Fallback to old system
    const { data: authToken, error } = await supabase
      .from('pype_voice_projects')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !authToken) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    return { 
      valid: true, 
      token: authToken,
      project_id: authToken.id,
      source: 'old_system'
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
};