import { describe, it, expect } from 'vitest'
import {
  validateVariables,
  extractValidVariables,
  hasVariableErrors,
} from '@/utils/variableValidator'

describe('variableValidator', () => {
  describe('validateVariables — valid inputs', () => {
    it('accepts a single valid variable', () => {
      const r = validateVariables('Hello {{patient_name}}')
      expect(r.isValid).toBe(true)
      expect(r.validVariables.has('patient_name')).toBe(true)
      expect(r.errors).toHaveLength(0)
    })

    it('accepts multiple valid variables', () => {
      const r = validateVariables('{{first}} and {{second2}}')
      expect(r.isValid).toBe(true)
      expect(r.validVariables.size).toBe(2)
    })

    it('accepts a 16-character variable name (boundary)', () => {
      const r = validateVariables('{{abcdefghijklmnp}}') // 16 chars
      expect(r.isValid).toBe(true)
    })

    it('accepts text with no variables', () => {
      const r = validateVariables('No variables here.')
      expect(r.isValid).toBe(true)
      expect(r.validVariables.size).toBe(0)
    })
  })

  describe('validateVariables — error cases', () => {
    it('detects unclosed brace', () => {
      const r = validateVariables('Hello {{unclosed')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('unclosed')
    })

    it('detects empty variable {{}}', () => {
      const r = validateVariables('{{}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('empty')
    })

    it('detects variable with spaces', () => {
      const r = validateVariables('{{has space}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('invalid_chars')
    })

    it('detects variable with special characters', () => {
      const r = validateVariables('{{bad-char!}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('invalid_chars')
    })

    it('detects variable starting with a number', () => {
      const r = validateVariables('{{1var}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('starts_with_number')
    })

    it('detects variable starting with underscore', () => {
      const r = validateVariables('{{_var}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('invalid_underscore')
    })

    it('detects variable ending with underscore', () => {
      const r = validateVariables('{{var_}}')
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('invalid_underscore')
    })

    it('detects variable exceeding 16 characters', () => {
      const r = validateVariables('{{abcdefghijklmnpqr}}') // 17 chars
      expect(r.isValid).toBe(false)
      expect(r.errors[0].type).toBe('too_long')
    })

    it('invalid variable is NOT added to validVariables', () => {
      const r = validateVariables('{{1invalid}}')
      expect(r.validVariables.size).toBe(0)
    })

    it('reports multiple errors in one string', () => {
      const r = validateVariables('{{}} {{has space}} {{ok_var}}')
      expect(r.isValid).toBe(false)
      expect(r.errors.length).toBeGreaterThanOrEqual(2)
      expect(r.validVariables.has('ok_var')).toBe(true)
    })
  })

  describe('extractValidVariables', () => {
    it('returns only valid variable names', () => {
      const vars = extractValidVariables('{{patient}} {{1bad}} {{doctor}}')
      expect(vars).toContain('patient')
      expect(vars).toContain('doctor')
      expect(vars).not.toContain('1bad')
    })

    it('returns empty array when no valid variables', () => {
      expect(extractValidVariables('{{1bad}} {{_also_bad}}')).toHaveLength(0)
    })
  })

  describe('hasVariableErrors', () => {
    it('returns false for valid text', () => {
      expect(hasVariableErrors('Hello {{name}}')).toBe(false)
    })

    it('returns true for invalid text', () => {
      expect(hasVariableErrors('{{1bad}}')).toBe(true)
    })

    it('returns false for text with no variables', () => {
      expect(hasVariableErrors('no variables here')).toBe(false)
    })
  })
})
