/**
 * The extractor prompt is the definition every disposition already depends on.
 * These fixtures are the real text from the agents in this project, trimmed —
 * so a change that stops reading them correctly fails here rather than on a
 * dashboard.
 */
import { describe, it, expect } from 'vitest'
import { parseExtractorKeys, applyDeclarations, groupOf, summarise } from '@/server/analytics/extractor'

/** Surya_JI, verbatim apart from length. */
const SURYA = JSON.stringify([
  {
    key: 'something',
    description:
      'Determine the appropriate disposition of a call based on the provided transcript by returning exactly one label from the following options: confirmed, cancellation_transfer, reschedule_transfer, unassured_transfer, user_busy, or wrong_number. Use confirmed when the appointment is clearly confirmed.',
  },
  {
    key: 'is_unassured_transfer',
    description:
      'Context: The assistant is calling a patient. **TASK**: Determine if the transfer was unassured. **INDICATORS (Score 1)**: - the patient did not commit. **NOT (Score 0)**: - the patient committed.',
  },
  { key: 'is_Conversation_hindi', description: 'if the conversation is going in hindi then "yes" other wise no' },
  { key: 'patient_full_name', description: 'Find the patient full name in hindi' },
])

describe('reading the extractor prompt', () => {
  it('reads every declared key', () => {
    expect(parseExtractorKeys(SURYA).map((d) => d.key)).toEqual([
      'something', 'is_unassured_transfer', 'is_Conversation_hindi', 'patient_full_name',
    ])
  })

  it('calls a Score 1 / Score 0 field what it is — 1 and 0, not true and false', () => {
    const d = parseExtractorKeys(SURYA).find((x) => x.key === 'is_unassured_transfer')
    expect(d?.declared).toEqual({ kind: 'boolean', encoding: 'one_zero' })
  })

  it('reads a yes/no field as yes/no', () => {
    const d = parseExtractorKeys(SURYA).find((x) => x.key === 'is_Conversation_hindi')
    expect(d?.declared).toEqual({ kind: 'boolean', encoding: 'yes_no' })
  })

  it('reads the whole declared label list, including labels nobody has produced yet', () => {
    const d = parseExtractorKeys(SURYA).find((x) => x.key === 'something')
    expect(d?.declared).toEqual({
      kind: 'enum',
      values: ['confirmed', 'cancellation_transfer', 'reschedule_transfer', 'unassured_transfer', 'user_busy', 'wrong_number'],
    })
  })

  it('claims nothing about a free-text field', () => {
    expect(parseExtractorKeys(SURYA).find((x) => x.key === 'patient_full_name')?.declared).toBeUndefined()
  })

  it('does not invent a boolean out of one word', () => {
    // 'always return true' is an instruction with one outcome, not two
    const d = parseExtractorKeys(JSON.stringify([{ key: 'k', description: 'always return true' }]))
    expect(d[0].declared).toBeUndefined()
  })

  it('refuses a label list that is really a sentence', () => {
    const d = parseExtractorKeys(JSON.stringify([{
      key: 'k',
      description: 'Pick one of: the patient clearly said they would attend the appointment, or they did not',
    }]))
    expect(d[0].declared).toBeUndefined()
  })

  it.each([null, undefined, '', 'not json at all', '{"key":"x"}', '[1,2,3]'])('survives %p', (prompt) => {
    expect(parseExtractorKeys(prompt)).toEqual([])
  })

  it('prefers the TASK line to the boilerplate before it', () => {
    expect(summarise('Context: a long preamble nobody needs. **TASK**: Determine if the patient CONFIRMED. **MORE**: x'))
      .toBe('Determine if the patient CONFIRMED.')
  })
})

describe('applying the declaration to the catalog', () => {
  const row = (over: Record<string, unknown>) => ({
    col: 'transcription_metrics', path: ['x'], value_type: 'enum', boolean_encoding: null,
    enum_values: null, type_confirmed: false, ...over,
  })

  it('overrules a sampled guess with what the prompt declared', () => {
    const [out] = applyDeclarations(
      [row({ path: ['is_unassured_transfer'], value_type: 'enum', enum_values: ['1'] })],
      SURYA, { includeDescription: true }
    )
    expect(out.value_type).toBe('boolean')
    expect(out.boolean_encoding).toBe('one_zero')
  })

  it('adds the labels the sample never saw, declared order first', () => {
    const [out] = applyDeclarations(
      [row({ path: ['something'], enum_values: ['confirmed', 'user_busy', 'something_new'] })],
      SURYA, { includeDescription: true }
    )
    expect(out.enum_values).toEqual([
      'confirmed', 'cancellation_transfer', 'reschedule_transfer', 'unassured_transfer', 'user_busy', 'wrong_number',
      'something_new',
    ])
  })

  it('lets a person who confirmed the type keep it', () => {
    const [out] = applyDeclarations(
      [row({ path: ['is_unassured_transfer'], value_type: 'enum', type_confirmed: true })],
      SURYA, { includeDescription: true }
    )
    expect(out.value_type).toBe('enum')
  })

  it('withholds the prompt from anyone not allowed to read it', () => {
    const [out] = applyDeclarations([row({ path: ['is_unassured_transfer'] })], SURYA, { includeDescription: false })
    expect(out.description).toBeNull()
    // the type it implies is not secret — it is derivable from the data anyway
    expect(out.boolean_encoding).toBe('one_zero')
  })

  it('leaves a field the prompt never mentions alone', () => {
    const [out] = applyDeclarations(
      [row({ path: ['final_disposition'], enum_values: ['confirmed'] })],
      SURYA, { includeDescription: true }
    )
    expect(out.declared).toBe(false)
    expect(out.enum_values).toEqual(['confirmed'])
  })
})

describe('grouping', () => {
  it.each([
    ['call_ended_reason', [], 'call'],
    ['transcription_metrics', ['final_disposition'], 'extracted'],
    ['metrics', ['hi', 'score'], 'metrics'],
    ['metadata', ['campaignId'], 'metadata'],
    ['dynamic_variables', ['x'], 'metadata'],
  ] as const)('puts %s.%s under %s', (col, path, group) => {
    expect(groupOf(col, [...path])).toBe(group)
  })
})

/**
 * Tinkal declares `DoctorName`, `Count` and `Interruption_occurred`; the
 * pipeline writes `doctorName`, `count` and `interruption_occurred`. Matching
 * the declared spelling exactly found none of them, and the agent looked to the
 * catalog as though it had declared nothing — silently.
 */
describe('matching a declared name to the name actually written', () => {
  const TINKAL = JSON.stringify([
    { key: 'DoctorName', description: 'Doctor by which user is taking the appointment' },
    { key: 'Interruption_occurred', description: 'An interruption is counted when the agent starts speaking. Return true or false.' },
  ])
  const row = (leaf: string) => ({
    col: 'transcription_metrics', path: [leaf], value_type: 'text',
    boolean_encoding: null, enum_values: null, type_confirmed: false,
  })

  it.each(['doctorName', 'DoctorName', 'doctor_name', 'Doctor_Name'])('matches %s', (leaf) => {
    const [out] = applyDeclarations([row(leaf)], TINKAL, { includeDescription: true })
    expect(out.declared).toBe(true)
    expect(out.description).toContain('Doctor by which')
  })

  it('carries the declared type across the spelling change too', () => {
    const [out] = applyDeclarations([row('interruption_occurred')], TINKAL, { includeDescription: true })
    expect(out.value_type).toBe('boolean')
    expect(out.boolean_encoding).toBe('true_false')
  })

  it('still matches nothing that is genuinely a different field', () => {
    const [out] = applyDeclarations([row('doctor_notes')], TINKAL, { includeDescription: true })
    expect(out.declared).toBe(false)
  })

  it('refuses to guess between two declarations that collide', () => {
    const colliding = JSON.stringify([
      { key: 'user_busy', description: 'the first one' },
      { key: 'userBusy', description: 'the second one' },
    ])
    const [out] = applyDeclarations([row('user_Busy')], colliding, { includeDescription: true })
    expect(out.declared).toBe(false)
  })

  it('but an exactly spelled key still wins over the collision', () => {
    const colliding = JSON.stringify([
      { key: 'user_busy', description: 'the first one' },
      { key: 'userBusy', description: 'the second one' },
    ])
    const [out] = applyDeclarations([row('userBusy')], colliding, { includeDescription: true })
    expect(out.description).toBe('the second one')
  })
})
