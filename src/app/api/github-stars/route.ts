// src/app/api/github-stars/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.github.com/repos/PYPE-AI-MAIN/whispey', {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      next: { revalidate: 300 } // Cache for 5 minutes
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      stars: data.stargazers_count,
      cached_at: new Date().toISOString()
    });
  } catch (error) {
    // Fail gracefully so the app works offline or when GitHub is unreachable
    console.warn('GitHub stars unavailable:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { stars: 0, cached_at: new Date().toISOString() },
      { status: 200 }
    );
  }
}