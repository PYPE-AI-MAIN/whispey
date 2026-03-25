// src/lib/auth.ts
import crypto from 'crypto';
import { updateKeyLastUsed } from './api-key-management';
import { TokenVerificationResult } from '../types/logs';
import { createServiceRoleClient } from '@/lib/supabase-server'

// Create server-side Supabase client
const supabase = createServiceRoleClient();

export const verifyToken = async (token: string, environment: string = 'dev'): Promise<TokenVerificationResult> => {
  try {
    console.log('🔍 Verifying token:', {
      token: token ? `${token.substring(0, 10)}...` : 'null',
      environment,
      tokenLength: token?.length || 0
    });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('🔍 Token hash:', tokenHash);

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
      .eq('token_hash', tokenHash);

    // Handle both single object and array responses (like Lambda)
    const project = Array.isArray(authToken) ? authToken[0] : authToken;
    
    console.log('🔍 Database query result:', {
      found: !!project,
      error: error?.message,
      projectId: project?.id,
      projectName: project?.name
    });

    if (error) {
      console.error('❌ Database error during token verification:', error);
      return { valid: false, error: `Database error: ${error.message}` };
    }

    if (!project) {
      console.error('❌ No project found with token hash:', tokenHash);
      return { valid: false, error: 'Invalid or expired token' };
    }

    console.log('✅ Token verification successful for project:', project.name);
    return { 
      valid: true, 
      token: project, 
      project_id: project.id, 
      source: 'old_system'
    };
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
};