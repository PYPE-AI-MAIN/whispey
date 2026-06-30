import { describe, it, expect } from 'vitest'

// Pure function extracted from MetricsTab in settings/users/page.tsx
// Derives metric_id from a human-readable name
const deriveMetricId = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30)

describe('deriveMetricId', () => {
  describe('basic transformation', () => {
    it('lowercases the name', () => {
      expect(deriveMetricId('Call Quality')).toBe('call_quality')
    })

    it('replaces spaces with underscores', () => {
      expect(deriveMetricId('task complete')).toBe('task_complete')
    })

    it('collapses multiple spaces into a single underscore', () => {
      expect(deriveMetricId('is  task  complete')).toBe('is_task_complete')
    })

    it('converts leading/trailing spaces to underscores', () => {
      expect(deriveMetricId('  call quality  ')).toBe('_call_quality_')
    })
  })

  describe('special character stripping', () => {
    it('strips hyphens', () => {
      expect(deriveMetricId('call-quality')).toBe('callquality')
    })

    it('strips punctuation', () => {
      expect(deriveMetricId('call quality!')).toBe('call_quality')
    })

    it('strips slashes', () => {
      expect(deriveMetricId('task/complete')).toBe('taskcomplete')
    })

    it('keeps underscores', () => {
      expect(deriveMetricId('call_quality')).toBe('call_quality')
    })

    it('keeps numbers', () => {
      expect(deriveMetricId('metric 2')).toBe('metric_2')
    })

    it('strips unicode characters', () => {
      expect(deriveMetricId('café quality')).toBe('caf_quality')
    })
  })

  describe('30 character limit', () => {
    it('truncates to 30 characters', () => {
      const long = 'this is a very long metric name that exceeds the limit'
      expect(deriveMetricId(long).length).toBeLessThanOrEqual(30)
    })

    it('exactly 30 character name is not truncated', () => {
      const exact = 'abcdefghij_abcdefghij_abcdefgh' // 30 chars
      expect(deriveMetricId(exact)).toBe(exact)
      expect(deriveMetricId(exact).length).toBe(30)
    })

    it('31 character name is truncated to 30', () => {
      const over = 'abcdefghij_abcdefghij_abcdefghi' // 31 chars
      expect(deriveMetricId(over).length).toBe(30)
    })
  })

  describe('real world examples', () => {
    it('derives is_task_complete from "Is Task Complete"', () => {
      expect(deriveMetricId('Is Task Complete')).toBe('is_task_complete')
    })

    it('derives call_quality from "Call Quality"', () => {
      expect(deriveMetricId('Call Quality')).toBe('call_quality')
    })

    it('derives sentiment_score from "Sentiment Score"', () => {
      expect(deriveMetricId('Sentiment Score')).toBe('sentiment_score')
    })

    it('derives resolution_rate from "Resolution Rate"', () => {
      expect(deriveMetricId('Resolution Rate')).toBe('resolution_rate')
    })
  })

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(deriveMetricId('')).toBe('')
    })

    it('returns empty string for all special characters', () => {
      expect(deriveMetricId('!@#$%^&*()')).toBe('')
    })

    it('handles single word', () => {
      expect(deriveMetricId('quality')).toBe('quality')
    })

    it('handles already lowercase input unchanged', () => {
      expect(deriveMetricId('call_quality')).toBe('call_quality')
    })
  })
})
