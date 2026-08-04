import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('knowledgeProxy', () => {
  afterEach(() => vi.unstubAllEnvs())

  describe('knowledgeBackendHeaders', () => {
    it('includes x-api-key and a Bearer service token', async () => {
      const { knowledgeBackendHeaders } = await import('@/lib/knowledgeProxy')
      const headers = knowledgeBackendHeaders()
      expect(headers['x-api-key']).toBe('pype-api-v1')
      expect(headers.Authorization).toMatch(/^Bearer .+/)
    })

    it('uses NEXT_PUBLIC_X_API_KEY when set', async () => {
      vi.stubEnv('NEXT_PUBLIC_X_API_KEY', 'custom-key')
      const { knowledgeBackendHeaders } = await import('@/lib/knowledgeProxy')
      expect(knowledgeBackendHeaders()['x-api-key']).toBe('custom-key')
    })

    it('merges in extra headers without dropping the standard ones', async () => {
      const { knowledgeBackendHeaders } = await import('@/lib/knowledgeProxy')
      const headers = knowledgeBackendHeaders({ 'Content-Type': 'application/json' })
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['x-api-key']).toBeDefined()
    })
  })

  describe('handleKnowledgeBackendResponse', () => {
    const notImplemented = { body: { error: 'not implemented' }, status: 503 }

    it('returns null when the response is ok', async () => {
      const { handleKnowledgeBackendResponse } = await import('@/lib/knowledgeProxy')
      const response = new Response(null, { status: 200 })
      const result = await handleKnowledgeBackendResponse(response, '[Test]', 1, 'failed', notImplemented)
      expect(result).toBeNull()
    })

    it('maps a 404 to the notImplemented response', async () => {
      const { handleKnowledgeBackendResponse } = await import('@/lib/knowledgeProxy')
      const response = new Response('not found', { status: 404 })
      const result = await handleKnowledgeBackendResponse(response, '[Test]', 1, 'failed', notImplemented)
      expect(result?.status).toBe(503)
      const body = await result?.json()
      expect(body).toEqual({ error: 'not implemented' })
    })

    it('maps a 501 to the notImplemented response', async () => {
      const { handleKnowledgeBackendResponse } = await import('@/lib/knowledgeProxy')
      const response = new Response('not implemented', { status: 501 })
      const result = await handleKnowledgeBackendResponse(response, '[Test]', 1, 'failed', notImplemented)
      expect(result?.status).toBe(503)
    })

    it('passes through the backend error text and status for other failures', async () => {
      const { handleKnowledgeBackendResponse } = await import('@/lib/knowledgeProxy')
      const response = new Response('bad request body', { status: 400 })
      const result = await handleKnowledgeBackendResponse(response, '[Test]', 1, 'fallback message', notImplemented)
      expect(result?.status).toBe(400)
      const body = await result?.json()
      expect(body.error).toBe('bad request body')
    })

    it('falls back to the fallback message when the error body is empty', async () => {
      const { handleKnowledgeBackendResponse } = await import('@/lib/knowledgeProxy')
      const response = new Response('', { status: 400 })
      const result = await handleKnowledgeBackendResponse(response, '[Test]', 1, 'fallback message', notImplemented)
      const body = await result?.json()
      expect(body.error).toBe('fallback message')
    })
  })

  describe('withKnowledgeErrorHandling', () => {
    it('invokes the handler and returns its response', async () => {
      const { withKnowledgeErrorHandling } = await import('@/lib/knowledgeProxy')
      const { NextResponse } = await import('next/server')
      const wrapped = withKnowledgeErrorHandling('[Test]', async () =>
        NextResponse.json({ ok: true })
      )
      const request = new NextRequest('http://localhost/api/knowledge/documents')
      const response = await wrapped(request)
      const body = await response.json()
      expect(body).toEqual({ ok: true })
    })

    it('catches a thrown error and returns a 500', async () => {
      const { withKnowledgeErrorHandling } = await import('@/lib/knowledgeProxy')
      const wrapped = withKnowledgeErrorHandling('[Test]', async () => {
        throw new Error('boom')
      })
      const request = new NextRequest('http://localhost/api/knowledge/documents')
      const response = await wrapped(request)
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Internal server error')
    })
  })

  describe('withKnowledgeErrorHandlingCtx', () => {
    it('passes the context object through to the handler', async () => {
      const { withKnowledgeErrorHandlingCtx } = await import('@/lib/knowledgeProxy')
      const { NextResponse } = await import('next/server')
      const wrapped = withKnowledgeErrorHandlingCtx<{ params: Promise<{ id: string }> }>(
        '[Test]',
        async (_req, ctx) => {
          const { id } = await ctx.params
          return NextResponse.json({ id })
        }
      )
      const request = new NextRequest('http://localhost/api/knowledge/documents/abc')
      const response = await wrapped(request, { params: Promise.resolve({ id: 'abc' }) })
      const body = await response.json()
      expect(body).toEqual({ id: 'abc' })
    })
  })
})
