import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { TokenVerificationResult } from '../types/logs';

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const verifyToken = async (token: string, environment: string = 'dev'): Promise<TokenVerificationResult> => {
  try {
    console.log('🔍 Verifying token:', {
      token: token ? `${token.substring(0, 10)}...` : 'null',
      environment,
      tokenLength: token?.length || 0
    });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('🔍 Token hash:', tokenHash);

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
      project_id: project.id
    };
  } catch (error) {
    console.error('❌ Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
};