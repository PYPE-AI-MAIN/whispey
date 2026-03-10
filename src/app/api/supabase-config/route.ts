import { NextResponse } from 'next/server';

/**
 * Returns Supabase URL and anon key for client-side usage.
 * Used when env vars are SUPABASE_URL / SUPABASE_ANON_KEY (not NEXT_PUBLIC_).
 * The anon key is safe to expose (RLS protects data).
 */
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: 'Supabase config not configured' },
      { status: 503 }
    );
  }
  return NextResponse.json({ url, anonKey });
}
