import { describe, expect, it } from 'vitest'
import { MAX_REANALYZE_LOG_IDS, parseLogIds, runLimited } from '@/lib/reprocessSelection'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('parseLogIds', () => {
  it('keeps unique valid ids', () => {
    expect(parseLogIds([id(1), id(2), id(1)])).toEqual({ ids: [id(1), id(2)] })
  })
  it('rejects empty, non-arrays and junk', () => {
    expect(parseLogIds([])).toHaveProperty('error')
    expect(parseLogIds('abc')).toHaveProperty('error')
    expect(parseLogIds([id(1), 'not-an-id'])).toHaveProperty('error')
    expect(parseLogIds([id(1), 5])).toHaveProperty('error')
  })
  it('caps how many calls go at once', () => {
    const many = Array.from({ length: MAX_REANALYZE_LOG_IDS + 1 }, (_, i) => id(i))
    expect(parseLogIds(many)).toEqual({ error: `Reanalyze at most ${MAX_REANALYZE_LOG_IDS} calls at a time` })
  })
})

describe('runLimited', () => {
  it('keeps results in order and never runs more than the limit at once', async () => {
    let running = 0
    let peak = 0
    const results = await runLimited([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, n))
      running--
      return n * 10
    })
    expect(results).toEqual([50, 10, 40, 20, 30, 60, 70])
    expect(peak).toBe(3)
  })
  it('handles no items', async () => {
    expect(await runLimited([], 5, async () => 1)).toEqual([])
  })
})
