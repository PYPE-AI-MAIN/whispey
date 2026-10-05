import { describe, it, expect, vi, beforeEach } from 'vitest'

// Characterization tests for POST /api/pi/chat: the real handler runs against a scripted model and an
// in-memory session store, so refactors of the route can be checked against today's behaviour.
const state = vi.hoisted(() => ({
  sessions: new Map<string, any>(),
  agents: [] as any[],
  llm: [] as any[],
  llmCalls: [] as any[],
  authUser: 'user-1' as string | null,
  role: 'admin' as string | null,
  title: 'Quick Chat',
  seq: 0,
  createImpl: async (_args: any): Promise<any> => ({}),
  updates: [] as any[],
  deployCalls: [] as any[],
  deployResult: { ok: true } as any,
  assistant: {} as any,
  configOk: true,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/deployAgentConfig', () => ({ deployAgentConfig: async (...args: any[]) => { state.deployCalls.push(args); return state.deployResult } }))
vi.mock('@/server/mcpAgentDb', () => ({ resolveWhispeyKeyFields: async () => ({}) }))
vi.mock('@/lib/serviceToken', () => ({ serviceAuthHeaders: () => ({}) }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: state.authUser }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'u@x.com' }] }),
}))
vi.mock('@/lib/getProjectRoleForApi', () => ({
  getProjectRoleForApi: async () => (state.role ? { role: state.role } : null),
  getDeploymentTargetFromAgentBackendName: async () => 'classic',
}))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from(table: string) {
      if (table === 'pi_sessions') {
        return {
          select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: state.sessions.get(id) ?? null, error: null }) }) }),
          insert: (row: any) => ({ select: () => ({ single: async () => { const id = `s${++state.seq}`; state.sessions.set(id, { id, ...row }); return { data: { id }, error: null } } }) }),
          update: (patch: any) => ({ eq: async (_c: string, id: string) => { state.sessions.set(id, { ...state.sessions.get(id), ...patch }); return { error: null } } }),
        }
      }
      const chain: any = {
        select: () => chain, eq: () => chain, order: () => chain, in: () => chain, limit: () => chain,
        update: (patch: any) => { state.updates.push(patch); return chain },
        maybeSingle: async () => ({ data: state.agents[0] ?? null, error: null }),
        then: (resolve: any) => resolve({ data: state.agents, error: null }),
      }
      return chain
    },
  }),
}))
vi.mock('openai', () => {
  class OpenAI {
    chat = { completions: { create: (args: any) => state.createImpl(args) } }
  }
  return { default: OpenAI, AzureOpenAI: OpenAI }
})

const defaultCreate = async (args: any) => {
  state.llmCalls.push({ ...args, messages: JSON.parse(JSON.stringify(args.messages)) })
  if (!args.stream) return { choices: [{ message: { content: state.title } }] }
  const next = state.llm.shift()
  if (!next) throw new Error('no scripted completion left')
  if (next instanceof Error) throw next
  return (async function* () { for (const c of next) yield c })()
}
state.createImpl = defaultCreate

const text = (t: string) => ({ choices: [{ delta: { content: t }, finish_reason: null }] })
const stop = { choices: [{ delta: {}, finish_reason: 'stop' }] }
const usage = (p: number, c: number) => ({ choices: [], usage: { prompt_tokens: p, completion_tokens: c } })
const toolCall = (id: string, name: string, args: object) => [
  { choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args).slice(0, 8) } }] }, finish_reason: null }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args).slice(8) } }] }, finish_reason: null }] }, // arguments arrive in pieces
  { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
]

const P = '11111111-1111-1111-1111-111111111111'
async function post(body: unknown) {
  const { POST } = await import('@/app/api/pi/chat/route')
  return POST(new Request('http://x/api/pi/chat', { method: 'POST', body: JSON.stringify(body) }) as any)
}
async function sse(body: unknown) {
  const res = await post(body)
  const raw = await res.text()
  const frames = raw.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).map((p) => (p === '[DONE]' ? '[DONE]' : JSON.parse(p)))
  return { res, frames }
}
const stored = (id: string) => state.sessions.get(id)

beforeEach(() => {
  state.sessions.clear(); state.agents = []; state.llm = []; state.llmCalls = []; state.authUser = 'user-1'; state.role = 'admin'; state.seq = 0; state.createImpl = defaultCreate; state.updates = []; state.deployCalls = []; state.deployResult = { ok: true }; state.assistant = { prompt: 'Hello world', llm: { temperature: 0.5 } }; state.configOk = true
  vi.stubEnv('OPENAI_API_KEY', 'test-key')
  vi.stubEnv('AZURE_OPENAI_API_KEY', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('PYPEAI_API_URL', 'http://backend.test')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: state.configOk, json: async () => ({ agent: { assistant: [state.assistant] } }) })))
})

describe('request validation', () => {
  it('rejects a missing project, a missing message, a signed-out user and a non-member', async () => {
    expect((await post({ message: 'hi' })).status).toBe(400)
    expect((await post({ projectId: P })).status).toBe(400)
    state.authUser = null
    expect((await post({ projectId: P, message: 'hi' })).status).toBe(401)
    state.authUser = 'user-1'; state.role = null
    expect((await post({ projectId: P, message: 'hi' })).status).toBe(403)
  })

  it('fails clearly when no model provider is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const res = await post({ projectId: P, message: 'hi' })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('No LLM provider configured')
  })
})

describe('a normal chat turn', () => {
  it('creates a session, streams the text, names the chat, reports usage and saves the turn', async () => {
    state.llm.push([text('Hello'), text(' there'), stop, usage(100, 20)])
    const { res, frames } = await sse({ projectId: P, message: 'hi' })
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    expect(frames[0]).toEqual({ sessionId: 's1' })
    expect(frames.filter((f: any) => f.text).map((f: any) => f.text)).toEqual(['Hello', ' there'])
    expect(frames).toContainEqual({ title: 'Quick Chat' })
    const used = frames.find((f: any) => f.usage)
    expect(used.usage.used).toBe(120); expect(used.usage.limit).toBeGreaterThan(0)
    expect(frames.at(-1)).toBe('[DONE]')
    expect(stored('s1')).toMatchObject({ project_id: P, user_id: 'user-1', title: 'Quick Chat' })
    expect(stored('s1').messages).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Hello there' }])
    const firstCall = state.llmCalls[0]
    expect(firstCall).toMatchObject({ model: 'gpt-4o-mini', stream: true, tool_choice: 'auto' })
    expect(firstCall.messages[0].role).toBe('system'); expect(firstCall.messages.at(-1)).toEqual({ role: 'user', content: 'hi' })
    expect(firstCall.tools.map((t: any) => t.function.name)).toEqual(expect.arrayContaining(['create_agent', 'list_phone_numbers', 'buy_plivo_number', 'attach_inbound_number']))
  })

  it('continues an existing session without renaming it, and keeps the earlier turns', async () => {
    state.sessions.set('s9', { id: 's9', project_id: P, user_id: 'user-1', title: 'Old', messages: [{ role: 'user', content: 'first' }, { role: 'assistant', content: 'answer' }] })
    state.llm.push([text('again'), stop])
    const { frames } = await sse({ projectId: P, sessionId: 's9', message: 'more' })
    expect(frames[0]).toEqual({ sessionId: 's9' })
    expect(frames.some((f: any) => f.title)).toBe(false)
    expect(stored('s9').title).toBe('Old')
    expect(stored('s9').messages.map((m: any) => m.content)).toEqual(['first', 'answer', 'more', 'again'])
    const sent = state.llmCalls[0].messages
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'more' })
    expect(sent.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => m.content)).toEqual(['first', 'answer', 'more'])
  })

  it('nudges the model to re-search when its last answer said a field was not found', async () => {
    const withLast = (content: string) => state.sessions.set('s8', { id: 's8', project_id: P, user_id: 'user-1', title: 't', messages: [{ role: 'user', content: 'q' }, { role: 'assistant', content }] })
    withLast('Sorry, this agent does not have a disposition called foo.')
    state.llm.push([text('ok'), stop])
    await sse({ projectId: P, sessionId: 's8', message: 'foo again' })
    const last = state.llmCalls[0].messages.at(-1)
    expect(last.role).toBe('system'); expect(last.content).toContain('Your previous reply concluded a field/disposition could not be found')
    expect(state.llmCalls[0].messages.at(-2)).toEqual({ role: 'user', content: 'foo again' })
    withLast('Here are your numbers.')
    state.llm.push([text('ok'), stop])
    await sse({ projectId: P, sessionId: 's8', message: 'thanks' })
    expect(state.llmCalls.at(-1).messages.at(-1)).toEqual({ role: 'user', content: 'thanks' })
  })

  it('refuses a session that belongs to someone else, or does not exist', async () => {
    state.sessions.set('s9', { id: 's9', project_id: P, user_id: 'someone-else', messages: [] })
    expect((await post({ projectId: P, sessionId: 's9', message: 'hi' })).status).toBe(403)
    expect((await post({ projectId: P, sessionId: 'nope', message: 'hi' })).status).toBe(404)
  })
})

describe('tool calls', () => {
  it('holds create_agent behind a Confirm (pending result) and tells the model so', async () => {
    state.llm.push(toolCall('call_1', 'create_agent', { display_name: 'Bot' }), [text('I will create it once you confirm.'), stop])
    const { frames } = await sse({ projectId: P, message: 'make a bot' })
    expect(frames).toContainEqual({ toolCall: { id: 'call_1', name: 'create_agent', arguments: { display_name: 'Bot' } } })
    const result = frames.find((f: any) => f.toolResult).toolResult
    expect(result).toMatchObject({ id: 'call_1', success: true, result: { __pending: true, action: 'create_agent', args: { display_name: 'Bot' } } })
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
    const second = state.llmCalls.find((c) => c.stream && c.messages.some((m: any) => m.role === 'tool'))
    const assistantWithCall = second.messages.find((m: any) => m.tool_calls)
    expect(assistantWithCall.tool_calls[0]).toEqual({ id: 'call_1', type: 'function', function: { name: 'create_agent', arguments: '{"display_name":"Bot"}' } })
    expect(second.messages.find((m: any) => m.role === 'tool')).toMatchObject({ tool_call_id: 'call_1' })
    expect(second.messages.find((m: any) => m.role === 'tool').content).toContain('__pending')
    const saved = stored('s1').messages.at(-1)
    expect(saved.content).toBe('I will create it once you confirm.')
    expect(saved.toolCalls[0]).toMatchObject({ id: 'call_1', name: 'create_agent', success: true, result: { __pending: true } })
  })

  it('runs a normal read tool straight away and feeds the result back', async () => {
    state.agents = [{ id: 'a1', display_name: 'Receptionist', is_active: true, field_extractor: false, field_extractor_prompt: null }]
    state.llm.push(toolCall('call_2', 'list_agents', {}), [text('You have one agent.'), stop])
    const { frames } = await sse({ projectId: P, message: 'list agents' })
    const result = frames.find((f: any) => f.toolResult).toolResult
    expect(result).toMatchObject({ success: true, result: { agents: [{ id: 'a1', display_name: 'Receptionist' }] } })
    expect(state.llmCalls.at(-2).messages.find((m: any) => m.role === 'tool').content).toContain('Receptionist')
  })

  it('does not let a viewer run write tools', async () => {
    state.role = 'viewer'
    state.llm.push(toolCall('call_3', 'create_agent', { display_name: 'Bot' }), [text('Not allowed.'), stop])
    const { frames } = await sse({ projectId: P, message: 'make a bot' })
    const result = frames.find((f: any) => f.toolResult).toolResult
    expect(result.success).toBe(false); expect(result.result.error).toContain('Viewer access')
    expect(state.llmCalls[0].tools.map((t: any) => t.function.name)).not.toContain('create_agent')
  })

  it('reports an unknown tool instead of crashing', async () => {
    state.llm.push(toolCall('call_4', 'mystery', {}), [text('ok'), stop])
    const { frames } = await sse({ projectId: P, message: 'x' })
    expect(frames).toContainEqual({ toolCall: { id: 'call_4', name: 'mystery', arguments: {} } })
    expect(frames.find((f: any) => f.toolResult).toolResult).toMatchObject({ success: false, result: { error: 'Unknown tool "mystery"' } })
  })

  it.each(['{not json', '[1,2]', 'null', '"text"'])('fails malformed tool arguments (%s) explicitly instead of running the tool with {}', async (raw) => {
    state.llm.push([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_5', function: { name: 'list_agents', arguments: raw } }] }, finish_reason: null }] }, { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }], [text('ok'), stop])
    const { frames } = await sse({ projectId: P, message: 'x' })
    expect(frames.find((f: any) => f.toolResult).toolResult).toMatchObject({ success: false, result: { error: expect.stringContaining('JSON') } })
    expect(frames.at(-1)).toBe('[DONE]')
  })

  it('stops after the maximum number of tool round trips', async () => {
    for (let i = 0; i < 12; i++) state.llm.push(toolCall(`c${i}`, 'list_agents', {}))
    const { frames } = await sse({ projectId: P, message: 'loop' })
    expect(frames.filter((f: any) => f.toolCall).length).toBe(8)
    expect(frames.at(-1)).toBe('[DONE]')
  })
})

describe('failures while streaming', () => {
  it('sends an error frame; text streamed before the break is NOT persisted (current behaviour)', async () => {
    state.createImpl = async (args: any) => {
      state.llmCalls.push({ ...args, messages: JSON.parse(JSON.stringify(args.messages)) })
      if (!args.stream) return { choices: [{ message: { content: 'T' } }] }
      return (async function* () { yield text('partial'); throw new Error('boom') })()
    }
    const { frames } = await sse({ projectId: P, message: 'hi' })
    expect(frames.find((f: any) => f.error).error).toContain('boom')
    expect(frames).not.toContain('[DONE]')
    // the route adds a reply's text to what it saves only after the stream ends, so an interrupted reply is lost on reload
    expect(stored('s1').messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('saves just the user turn when the model fails before saying anything', async () => {
    state.llm.push(new Error('down'))
    const { frames } = await sse({ projectId: P, message: 'hi' })
    expect(frames.find((f: any) => f.error).error).toContain('down')
    expect(stored('s1').messages).toEqual([{ role: 'user', content: 'hi' }])
  })
})

describe('Confirm / Cancel', () => {
  const pendingSession = (over: Record<string, unknown> = {}) => state.sessions.set('s5', {
    id: 's5', project_id: P, user_id: 'user-1', title: 't',
    messages: [{ role: 'user', content: 'attach' }, { role: 'assistant', content: 'ok', toolCalls: [{ id: 'call_9', name: 'attach_inbound_number', arguments: { agent_id: '', number: '' }, result: { __pending: true }, success: true }] }],
    ...over,
  })
  const resolve = (decision: string, extra: Record<string, unknown> = {}) => post({ projectId: P, sessionId: 's5', resolveAction: { toolCallId: 'call_9', decision }, ...extra })

  it('cancel records the cancellation without running anything', async () => {
    pendingSession()
    const res = await resolve('cancel')
    expect(await res.json()).toEqual({ result: { __cancelled: true }, success: true, toolCallId: 'call_9' })
    expect(stored('s5').messages[1].toolCalls[0].result).toEqual({ __cancelled: true })
    expect(state.llmCalls).toHaveLength(0)
  })

  it('confirm runs the STORED action (not anything from the request) and saves its outcome', async () => {
    pendingSession()
    const res = await resolve('confirm', { tool: 'buy_plivo_number', arguments: { number: '+911' } }) // tampered extras must be ignored
    const body = await res.json()
    expect(body).toMatchObject({ success: false, toolCallId: 'call_9', result: { error: 'agent_id and number are required' } })
    expect(stored('s5').messages[1].toolCalls[0]).toMatchObject({ name: 'attach_inbound_number', success: false, result: { error: 'agent_id and number are required' } })
  })

  it('rejects bad requests, other people\'s sessions, unknown and already-resolved actions', async () => {
    expect((await post({ projectId: P, resolveAction: { toolCallId: 'call_9', decision: 'confirm' } })).status).toBe(400)
    pendingSession()
    expect((await resolve('maybe')).status).toBe(400)
    expect((await post({ projectId: P, sessionId: 's5', resolveAction: { toolCallId: 'nope', decision: 'confirm' } })).status).toBe(404)
    expect((await post({ projectId: P, sessionId: 'missing', resolveAction: { toolCallId: 'call_9', decision: 'confirm' } })).status).toBe(404)
    pendingSession({ user_id: 'someone-else' })
    expect((await resolve('confirm')).status).toBe(403)
    state.sessions.set('s5', { ...stored('s5'), user_id: 'user-1', messages: [{ role: 'assistant', content: '', toolCalls: [{ id: 'call_9', name: 'x', arguments: {}, result: { done: true }, success: true }] }] })
    expect((await resolve('confirm')).status).toBe(409)
  })
})

describe('open_page tool', () => {
  const open = async (args: object) => {
    state.llm.push(toolCall('op', 'open_page', args), [text('done'), stop])
    const { frames } = await sse({ projectId: P, message: 'open it' })
    return frames.find((f: any) => f.toolResult).toolResult
  }
  const agent = (over: Record<string, unknown> = {}) => { state.agents = [{ display_name: 'Bot', agent_type: 'other', configuration: {}, ...over }] }

  it('links the fixed pages, and rejects unknown ones (including names from Object.prototype)', async () => {
    expect((await open({ page: 'agents' })).result).toEqual({ href: `/${P}/agents`, label: 'Agent list' })
    expect((await open({ page: 'analytics' })).result).toEqual({ href: `/${P}/analytics`, label: 'Org overview' })
    expect((await open({ page: 'campaigns' })).result).toEqual({ href: `/${P}/campaigns`, label: 'Campaigns' })
    expect((await open({ page: 'settings' })).result).toEqual({ href: `/${P}/settings`, label: 'Settings' })
    expect((await open({ page: 'phone_settings' })).result).toEqual({ href: `/${P}/agents/sip-management`, label: 'Phone settings' })
    expect((await open({ page: 'api_keys' })).result).toEqual({ href: `/${P}/agents/api-keys`, label: 'Project API key' })
    for (const page of ['bogus', 'toString', 'constructor', '']) expect(await open({ page })).toMatchObject({ success: false, result: { error: 'Unknown page' } })
  })

  it('refuses a campaign_id that could change the link path', async () => {
    expect((await open({ page: 'campaign', campaign_id: 'abc-123' })).result).toEqual({ href: `/${P}/campaigns/abc-123`, label: 'Campaign' })
    for (const campaign_id of ['../agents', 'a/b', 'a?x=1', ' ']) expect(await open({ page: 'campaign', campaign_id })).toMatchObject({ success: false })
  })

  it('needs a campaign id for a campaign page', async () => {
    expect(await open({ page: 'campaign' })).toMatchObject({ success: false, result: { error: 'campaign_id is required' } })
    expect((await open({ page: 'campaign', campaign_id: 'c1' })).result).toEqual({ href: `/${P}/campaigns/c1`, label: 'Campaign' })
  })

  it('needs an existing agent for agent pages', async () => {
    expect(await open({ page: 'logs' })).toMatchObject({ success: false, result: { error: 'agent_id is required' } })
    expect(await open({ page: 'logs', agent_id: 'a1' })).toMatchObject({ success: false, result: { error: 'No such agent in this project' } })
  })

  it('builds each agent page link', async () => {
    agent()
    const base = `/${P}/agents/a1`
    expect((await open({ page: 'logs', agent_id: 'a1' })).result).toEqual({ href: `${base}?tab=logs`, label: 'Bot call logs' })
    expect((await open({ page: 'overview', agent_id: 'a1' })).result).toEqual({ href: `${base}?tab=overview`, label: 'Bot overview' })
    expect((await open({ page: 'campaign_logs', agent_id: 'a1' })).result).toEqual({ href: `${base}?tab=campaign-logs`, label: 'Bot campaign logs' })
    expect((await open({ page: 'phone_calls', agent_id: 'a1' })).result).toEqual({ href: `${base}/phone-call-config`, label: 'Bot phone calls' })
    expect((await open({ page: 'qa', agent_id: 'a1' })).result).toEqual({ href: `${base}/qa`, label: 'Bot QA' })
    expect((await open({ page: 'knowledge', agent_id: 'a1' })).result).toEqual({ href: `${base}/knowledge`, label: 'Bot knowledge base' })
  })

  it('picks the right config page for the agent type', async () => {
    const base = `/${P}/agents/a1`
    const config = async (over: Record<string, unknown>) => { agent(over); return (await open({ page: 'config', agent_id: 'a1' })).result }
    expect(await config({})).toEqual({ href: `${base}/config`, label: 'Bot config' })
    expect((await config({ agent_type: 'livekit' })).href).toBe(`${base}/config/livekit`)
    expect((await config({ configuration: { workflow: {} } })).href).toBe(`${base}/workflow`)
    expect((await config({ configuration: { workflowMode: true } })).href).toBe(`${base}/workflow`)
    expect((await config({ agent_type: 'pipecat_agent' })).href).toBe(`${base}/config/pipecat`)
    expect((await config({ configuration: { pipecat_agent_id: 'p1' }, agent_type: 'livekit' })).href).toBe(`${base}/config/pipecat`) // pipecat wins over livekit
    agent({ agent_type: 'pipecat_agent' })
    expect((await open({ page: 'knowledge', agent_id: 'a1' })).result).toEqual({ href: `${base}/config/pipecat/knowledgebase`, label: 'Bot knowledge base' })
  })

  it('names an agent without a display name "Agent"', async () => {
    agent({ display_name: null })
    expect((await open({ page: 'qa', agent_id: 'a1' })).result.label).toBe('Agent QA')
  })
})

describe('edit_agent (confirmed)', () => {
  const A = 'a1'
  const edit = async (args: Record<string, unknown>) => {
    state.sessions.set('s7', {
      id: 's7', project_id: P, user_id: 'user-1', title: 't',
      messages: [{ role: 'assistant', content: '', toolCalls: [{ id: 'e1', name: 'edit_agent', arguments: { agent_id: A, ...args }, result: { __pending: true }, success: true }] }],
    })
    const res = await post({ projectId: P, sessionId: 's7', resolveAction: { toolCallId: 'e1', decision: 'confirm' } })
    return res.json() as Promise<{ success: boolean; result: any }>
  }
  beforeEach(() => { state.agents = [{ id: A, name: 'bot', display_name: 'Bot', field_extractor_prompt: null }] })
  const deployed = () => state.deployCalls[0][1].agent.assistant[0]

  it('refuses an agent that is not in this project', async () => {
    state.agents = []
    expect(await edit({ prompt: 'x' })).toMatchObject({ success: false, result: { error: 'No such agent in this project' } })
  })

  it('updates extractor variables without touching the voice backend', async () => {
    const out = await edit({ extractor_variables: { name: 'metadata.name' } })
    expect(out).toEqual({ success: true, result: { agent_id: A, updated: { extractor_variables: true } }, toolCallId: 'e1' })
    expect(state.updates[0]).toMatchObject({ field_extractor_variables: { name: 'metadata.name' } })
    expect(state.deployCalls).toHaveLength(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('validates extractor variables', async () => {
    expect((await edit({ extractor_variables: ['x'] })).result.error).toBe('extractor_variables must be an object of string column paths')
    expect((await edit({ extractor_variables: { a: 3 } })).result.error).toBe('extractor_variables.a must be a string column path')
    expect(state.updates).toHaveLength(0)
  })

  it('saves dispositions (replace) and rejects invalid ones', async () => {
    const ok = await edit({ dispositions: [{ key: 'interested', description: 'Wants a callback' }], dispositions_mode: 'replace' })
    expect(ok).toMatchObject({ success: true, result: { updated: { dispositions: true } } })
    expect(state.updates).toHaveLength(1)
    state.updates = []
    const bad = await edit({ dispositions: [{ key: 'Not A Key!', description: 'x' }], dispositions_mode: 'replace' })
    expect(bad.success).toBe(false); expect(typeof bad.result.error).toBe('string'); expect(state.updates).toHaveLength(0)
  })

  it('merges new dispositions into the existing list by default', async () => {
    const ok = await edit({ dispositions: [{ key: 'interested', description: 'Wants a callback' }] })
    expect(ok.success).toBe(true)
    expect(state.updates).toHaveLength(1)
  })

  it('replaces the whole prompt and deploys it', async () => {
    const out = await edit({ prompt: 'You are Bot.' })
    expect(out.success).toBe(true)
    expect(out.result).toMatchObject({ agent_id: A, backend_name: 'bot_a1', display_name: 'Bot', updated: { prompt: true, greeting: false, voice: false, variables: false } })
    expect(state.deployCalls).toHaveLength(1)
    expect(state.deployCalls[0][0]).toBe('bot_a1')
    expect(deployed().prompt).toBe('You are Bot.')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://backend.test/agent_config/bot_a1')
  })

  it('patches part of the prompt: exact, unique matches only (and String.replace semantics are kept)', async () => {
    state.assistant = { prompt: 'Hello world', llm: {} }
    expect((await edit({ prompt_patch: { old_string: 'Hello', new_string: 'Hi' } })).success).toBe(true)
    expect(deployed().prompt).toBe('Hi world')
    state.deployCalls = []
    await edit({ prompt_patch: { old_string: 'Hello', new_string: 'Hi $&' } })
    expect(deployed().prompt).toBe('Hi Hello world')
    expect((await edit({ prompt_patch: { old_string: 'nope', new_string: 'x' } })).result.error).toContain('was not found in the current prompt')
    state.assistant = { prompt: 'aa aa', llm: {} }
    expect((await edit({ prompt_patch: { old_string: 'aa', new_string: 'b' } })).result.error).toBe('prompt_patch.old_string matches 2 places in the current prompt — include more surrounding text to make it unique')
  })

  it('rejects a prompt whose {{variable}} names the Studio would refuse', async () => {
    const out = await edit({ prompt: 'Hi {{1bad}}' })
    expect(out.success).toBe(false); expect(out.result.error).toContain('Prompt has invalid {{variable}} name(s)')
    expect(state.deployCalls).toHaveLength(0)
  })

  it('switches the conversation model only to the supported Sarvam models', async () => {
    const bad = await edit({ llm_model: 'gpt-4' })
    expect(bad.result.error).toBe('Unknown LLM "gpt-4". Use sarvam-105b-conversations (Sarvam 105) or sarvam-105b.')
    const ok = await edit({ llm_model: 'sarvam-105b' })
    expect(ok.result.updated.llm).toBe(true) // the route means to report the model name, but `...updated` overwrites it with true (current behaviour)
    expect(deployed().llm).toEqual({ name: 'sarvam', provider: 'sarvam', model: 'sarvam-105b', temperature: 0.5 })
  })

  it('changes the voice only to one in the Studio list', async () => {
    const { MCP_VOICES } = await import('@/config/mcpAgentVoices')
    expect((await edit({ voice_provider: 'nope', voice_id: 'x' })).result.error).toBe('Voice nope/x is not in the Agent Studio voice list')
    const ok = await edit({ voice_provider: MCP_VOICES[0].provider, voice_id: MCP_VOICES[0].voice_id })
    expect(ok.result.updated.voice).toBe(true)
    expect(state.deployCalls).toHaveLength(1)
  })

  it('does not touch the assistant for a greeting-less, prompt-less edit but deploys for greeting/variables', async () => {
    expect((await edit({ greeting: 'Hello!' })).result.updated.greeting).toBe(true)
    state.deployCalls = []
    expect((await edit({ variables: [] })).result.updated.variables).toBe(true)
    expect(state.deployCalls).toHaveLength(1)
  })

  it('reports backend problems clearly', async () => {
    state.configOk = false
    expect((await edit({ prompt: 'x' })).result.error).toBe('Failed to load current agent config')
    state.configOk = true; state.deployResult = { ok: false, errorText: 'quota exceeded' }
    expect((await edit({ prompt: 'x' })).result.error).toBe('quota exceeded')
    state.deployResult = { ok: false }
    expect((await edit({ prompt: 'x' })).result.error).toBe('Failed to deploy updated config')
    vi.stubEnv('PYPEAI_API_URL', ''); vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', '')
    expect((await edit({ prompt: 'x' })).result.error).toBe('Voice backend URL is not configured')
  })
})
