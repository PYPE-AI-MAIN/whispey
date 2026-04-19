/**
 * Catch-all proxy to the pipecat backend.
 * Dashboard calls  →  /api/pipecat/<path>  →  PIPECAT_BASE_URL/v1/<path>
 *
 * e.g. GET /api/pipecat/numbers  →  GET http://127.0.0.1:7860/v1/numbers
 */
import { NextRequest, NextResponse } from 'next/server'

const BASE = (process.env.PIPECAT_BASE_URL ?? 'http://127.0.0.1:7860').replace(/\/$/, '')
const API_KEY = process.env.PYPE_API_KEY ?? ''

function upstream(path: string[], search: string): string {
  const joined = path.join('/')
  return `${BASE}/v1/${joined}${search ? `?${search}` : ''}`
}

interface ProxyRouteContext {
  params: Promise<{ path: string[] }>
}

async function proxy(req: NextRequest, { params }: ProxyRouteContext) {
  const resolvedParams = await params
  const url = upstream(resolvedParams.path, new URL(req.url).searchParams.toString())

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
  }

  const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(req.method)
  const body = isBodyMethod ? await req.text() : undefined

  try {
    const res = await fetch(url, { method: req.method, headers, body })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[pipecat proxy] error:', err)
    return NextResponse.json({ error: 'Pipecat backend unreachable' }, { status: 502 })
  }
}

export const GET    = proxy
export const POST   = proxy
export const PUT    = proxy
export const PATCH  = proxy
export const DELETE = proxy
