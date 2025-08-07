import crypto from 'crypto';
import { supabase } from './supabase';
import { TokenVerificationResult } from '../types/logs';

export const verifyToken = async (token: string, environment: string = 'dev'): Promise<TokenVerificationResult> => {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

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
      project_id: authToken.id
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
};
