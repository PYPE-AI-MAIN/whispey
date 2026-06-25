import { describe, it, expect, vi } from 'vitest'
import { createResponse, sendResponse } from '@/lib/response'

describe('response helpers', () => {
  describe('createResponse', () => {
    it('marks success for 2xx status codes', () => {
      expect(createResponse(200, { id: 1 }).json.success).toBe(true)
      expect(createResponse(201, {}).json.success).toBe(true)
      expect(createResponse(204, null).json.success).toBe(true)
    })

    it('marks failure for 4xx status codes', () => {
      expect(createResponse(400, null, 'Bad request').json.success).toBe(false)
      expect(createResponse(401, null, 'Unauthorized').json.success).toBe(false)
      expect(createResponse(404, null, 'Not found').json.success).toBe(false)
    })

    it('marks failure for 5xx status codes', () => {
      expect(createResponse(500, null, 'Server error').json.success).toBe(false)
    })

    it('sets data to null when error is provided', () => {
      const r = createResponse(400, { id: 1 }, 'Validation failed')
      expect(r.json.data).toBeNull()
      expect(r.json.error).toBe('Validation failed')
    })

    it('sets data correctly when no error', () => {
      const payload = { users: ['alice', 'bob'] }
      const r = createResponse(200, payload)
      expect(r.json.data).toEqual(payload)
      expect(r.json.error).toBeNull()
    })

    it('includes a timestamp', () => {
      const r = createResponse(200, {})
      expect(r.json.timestamp).toBeTruthy()
      expect(() => new Date(r.json.timestamp)).not.toThrow()
    })

    it('returns the correct status code', () => {
      expect(createResponse(404, null, 'Not found').status).toBe(404)
    })
  })

  describe('sendResponse', () => {
    it('calls res.status().json() with correct values', () => {
      const json = vi.fn()
      const status = vi.fn().mockReturnValue({ json })
      const res = { status } as any

      sendResponse(res, 200, { ok: true })

      expect(status).toHaveBeenCalledWith(200)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { ok: true } })
      )
    })

    it('sends error response correctly', () => {
      const json = vi.fn()
      const status = vi.fn().mockReturnValue({ json })
      const res = { status } as any

      sendResponse(res, 422, null, 'Invalid input')

      expect(status).toHaveBeenCalledWith(422)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Invalid input', data: null })
      )
    })
  })
})
