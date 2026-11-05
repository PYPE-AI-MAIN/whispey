import { NextRequest, NextResponse } from 'next/server'
import { stripTrailingSlashes, type RayaVoice } from '@/lib/tts/raya'

// GET /v1/voices on Raya (Bakbak). The catalogue is account-scoped and rarely changes
// (Raya's own best-practices page recommends caching it), so keep it in memory and let
// the dialog's Refresh button bypass the cache with ?refresh=1.
const CACHE_TTL_MS = 10 * 60 * 1000
let cache: { at: number; voices: RayaVoice[] } | null = null

const baseUrl = () => stripTrailingSlashes(process.env.RAYA_BASE_URL || 'https://hub.getraya.app')

export async function GET(request: NextRequest) {
  const apiKey = process.env.RAYA_API_KEY
  if (!apiKey) {
    // `code` lets the dialog show setup guidance instead of a generic failure.
    return NextResponse.json(
      { error: 'RAYA_API_KEY is not configured on the server', code: 'not_configured' },
      { status: 503 },
    )
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1'
  if (!forceRefresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ voices: cache.voices, count: cache.voices.length, cached: true })
  }

  try {
    const response = await fetch(`${baseUrl()}/v1/voices`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })

    if (!response.ok) {
      const rejected = response.status === 401 || response.status === 403
      console.error('Raya voices API error:', response.status, await response.text().catch(() => ''))
      // Serve a stale catalogue rather than an empty picker when Raya has a blip.
      if (cache && !rejected) {
        return NextResponse.json({ voices: cache.voices, count: cache.voices.length, cached: true, stale: true })
      }
      return NextResponse.json(
        {
          error: rejected ? 'Raya rejected the API key' : `Raya API error: ${response.status}`,
          code: rejected ? 'invalid_key' : 'upstream_error',
        },
        { status: 502 },
      )
    }

    const data = await response.json()
    const voices: RayaVoice[] = (Array.isArray(data?.voices) ? data.voices : [])
      .filter((v: any) => v && typeof v.id === 'string' && v.id)
      .map((v: any) => ({
        id: v.id,
        name: String(v.name || v.id),
        language: String(v.language || ''),
        model: String(v.model || ''),
      }))
      .sort((a: RayaVoice, b: RayaVoice) => a.language.localeCompare(b.language) || a.name.localeCompare(b.name))

    cache = { at: Date.now(), voices }
    return NextResponse.json({ voices, count: voices.length })
  } catch (error) {
    console.error('Raya voices fetch failed:', error)
    return NextResponse.json(
      { error: 'Could not reach Raya', code: 'upstream_error' },
      { status: 502 },
    )
  }
}
