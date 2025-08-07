import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase';
import { sendResponse } from '../../../../lib/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendResponse(res, 405, null, 'Method not allowed');
  }

  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('pype_voice_projects')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.error('Supabase connection error:', error);
      return sendResponse(res, 500, null, `Failed to connect to Supabase: ${error.message}`);
    }

    return sendResponse(res, 200, {
      message: 'Connection successful',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development'
    });

  } catch (error) {
    console.error('Test connection error:', error);
    return sendResponse(res, 500, null, 'Internal server error');
  }
}