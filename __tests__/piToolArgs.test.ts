import { describe, it, expect } from 'vitest'
import { validateToolArgs, PI_TOOL_NAMES } from '@/lib/piToolArgs'

const A = '7e01d5b5-2af0-4644-8514-5f6bc34747f1'

describe('validateToolArgs', () => {
  it('covers every tool Pi can call', () => {
    expect([...PI_TOOL_NAMES].sort()).toEqual([
      'attach_inbound_number', 'buy_plivo_number', 'check_spam_number', 'create_agent', 'edit_agent', 'get_agent_details',
      'get_call_volume_trend', 'get_completion_insights', 'get_talk_link', 'list_agents', 'list_analytics_fields',
      'list_phone_numbers', 'open_custom_tool_form', 'open_page', 'query_analytics', 'search_field_definitions', 'search_plivo_numbers',
    ])
  })

  it.each([
    ['list_agents', {}],
    ['get_agent_details', { agent_id: A }],
    ['get_call_volume_trend', { days: 30 }],
    ['get_call_volume_trend', { days: '30', agent_id: A }],
    ['open_page', { page: 'logs', agent_id: A }],
    ['query_analytics', { spec: { spec_version: 1 } }],
    ['query_analytics', { agg: { fn: 'count' }, range: { days: 7 } }],
    ['check_spam_number', { number: '+91 79883 07935' }],
    ['create_agent', { display_name: 'Bot' }],
    ['edit_agent', { agent_id: A, prompt_patch: { old_string: 'a', new_string: 'b' }, dispositions: [{ key: 'k', description: 'd' }] }],
    ['attach_inbound_number', { agent_id: A, number: '+918065587702', krisp_enabled: true }],
    ['buy_plivo_number', { number: '+918065587702', country_iso: 'IN' }],
    ['search_plivo_numbers', { country_iso: 'IN' }],
    ['no_such_tool', { anything: 1 }],
  ])('accepts %s %j', (name, args) => {
    expect(validateToolArgs(name, args)).toBeNull()
  })

  it.each([
    ['get_agent_details', {}],
    ['get_agent_details', { agent_id: 42 }],
    ['get_agent_details', { agent_id: '../../x' }],
    ['get_agent_details', { agent_id: 'a'.repeat(65) }],
    ['search_field_definitions', { agent_id: A, term: '' }],
    ['open_page', { page: 'toString' }],
    ['check_spam_number', { number: { $ne: 1 } }],
    ['create_agent', { display_name: '' }],
    ['create_agent', { display_name: 'x', dispositions: [{ key: 'k' }] }],
    ['edit_agent', { agent_id: A, dispositions: [{ key: 'k', description: 'x'.repeat(501) }] }],
    ['edit_agent', { agent_id: A, dispositions: [{ key: 'Bad Key', description: 'd' }] }],
    ['edit_agent', { agent_id: A, dispositions_mode: 'wipe' }],
    ['edit_agent', { agent_id: A, prompt_patch: { old_string: 'a' } }],
    ['edit_agent', { agent_id: A, variables: ['x'] }],
    ['attach_inbound_number', { agent_id: A }],
    ['attach_inbound_number', { agent_id: A, number: '+91', krisp_enabled: 'yes' }],
    ['buy_plivo_number', { number: '+91' }],
    ['open_custom_tool_form', { agent_id: A, http_method: 'TRACE' }],
    ['get_call_volume_trend', { days: { x: 1 } }],
  ])('rejects %s %j', (name, args) => {
    expect(validateToolArgs(name, args)).toContain(`Invalid arguments for ${name}`)
  })
})
