// src/app/api/github-stars/route.ts

import { NextResponse } from 'next/server';

const FALLBACK = { stars: null as number | null, cached_at: new Date().toISOString() };

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN?.trim();
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('https://api.github.com/repos/PYPE-AI-MAIN/whispey', {
      headers,
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      // 401/403 = missing or invalid token; 404 = repo not found. Return fallback instead of 500.
      if (response.status === 401 || response.status === 403) {
        console.warn('GitHub stars: token missing or invalid (401/403), returning fallback');
      }
      return NextResponse.json(FALLBACK, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json({
      stars: data.stargazers_count ?? null,
      cached_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to fetch GitHub stars:', error);
    return NextResponse.json(FALLBACK, { status: 200 });
  }
}