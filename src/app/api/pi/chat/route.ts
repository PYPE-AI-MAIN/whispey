// src/app/api/pi/chat/route.ts
//
// "Pi" — the org-level chat assistant. Creates agents via /api/askpi/agents
// (studio secret), not /api/mcp. Streaming + tool-calling loop
// is copied from /api/prompt-forge/chat, with one difference: tools here are
// a fixed server-side registry scoped to the caller's project_id, not an
// arbitrary client-supplied list — Pi can't be asked to act on another project.

import { NextRequest, NextResponse } from 'next/server'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import OpenAI, { AzureOpenAI } from 'openai'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { MCP_VOICES, findMcpVoice, buildMcpTtsConfig } from '@/config/mcpAgentVoices'
import { getProjectRoleForApi, getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { buyNumber, attachNumberToTrunk, digitsOnly, getOwnedNumber, inboundAlias, listOwnedNumbers, resolveInboundTrunk, restoreNumberApp, searchAvailableNumbers } from '@/lib/plivoNumbers'
import { getPypeApiBaseUrlForServer, fetchPypeApiWithRetry, isPypeUpstreamUnreachable } from '@/lib/pypeApiFetch'
import { deployAgentConfig } from '@/lib/deployAgentConfig'
import { applyAssistantUpdates } from '@/lib/mcpAgentHelpers'
import { validateDispositions, dispositionsToAgentColumns } from '@/lib/dispositions'
import { validateVariables } from '@/utils/variableValidator'
import { piPlatformSchemaDoc, PI_MODEL_HISTORY_TURNS } from '@/lib/piPlatformSchema'
import { PI_AGENT_INTELLIGENCE_DOC } from '@/lib/piAgentIntelligence'
import { PI_ANALYTICS_RECIPES_DOC } from '@/lib/piAnalyticsRecipes'
import { PI_MANDATORY_ANALYTICS_TOOLS_DOC, runCallVolumeTrend, runCompletionInsights } from '@/lib/piAnalyticsTools'
import { resolveWhispeyKeyFields } from '@/server/mcpAgentDb'
import { resolveScope, isDenied } from '@/server/analytics/context'
import { applyDeclarations, summarise } from '@/server/analytics/extractor'
import { catalogIsStale, rescan as rescanAnalyticsFields } from '@/server/analytics/catalog'
import { Spec, ALL_COLS } from '@/server/analytics/spec'
import { planDashboardQueries, isPhoneField } from '@/server/analytics/buildQuery'
import { runQuery, isTimeout } from '@/server/analytics/db'

interface StoredToolCall {
  id: string
  name: string
  arguments: any
  result?: any
  success?: boolean
}

interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: StoredToolCall[]
}

// Pi's own system prompt is small (capability list + a voice table, well
// under 1K tokens) and agent config is never preloaded into it — prompts,
// field-extractor text, and full configs are only ever fetched on demand via
// a tool call, scoped to the one agent being discussed, not stuffed into
// every turn. The part that genuinely grows without bound is conversation
// history, so that's what's capped here, on the replay path only:
// persistence keeps the full record (so a resumed chat or an admin's audit
// view still sees everything), this just bounds what goes back to the model.
const RECENT_HISTORY_TURNS = PI_MODEL_HISTORY_TURNS
const MAX_TOOL_RESULT_CHARS = 3000

// Context windows by model family — AZURE_DEPLOYMENT_NAME is an arbitrary deployment
// name (e.g. "gpt-4.1-mini-2"), so match by substring rather than exact value.
function contextWindowFor(model: string): number {
  if (model.includes('gpt-4.1')) return 1_047_576
  if (model.includes('gpt-4o')) return 128_000
  return 128_000 // conservative default for an unrecognized model
}

// requested for debugging what Pi actually runs against the DB — appends, never blocks a reply on failure
const PI_SQL_LOG_PATH = join(process.cwd(), 'pi-sql-queries.log')
function logPiSql(projectId: string, agentId: string | undefined, sql: string, params: unknown[]) {
  const line = `\n--- ${new Date().toISOString()} project=${projectId} agent=${agentId ?? 'ALL'} ---\n${sql}\n-- params: ${JSON.stringify(params)}\n`
  appendFile(PI_SQL_LOG_PATH, line).catch((err) => console.error('[pi/chat] failed to write SQL log', err))
}

function truncateForContext(value: unknown, max = MAX_TOOL_RESULT_CHARS): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  if (text.length <= max) return text
  return `${text.slice(0, max)}… [truncated ${text.length - max} more chars — ask a narrower question if you need the rest]`
}

// get_agent_details/search_field_definitions carry real agent content (a
// disposition's description alone can run 10,000+ characters) and need more
// room than the default. This must match on BOTH the live tool-execution path
// AND history replay (toWireMessages) — a result sized correctly when first
// returned was getting crushed back down to the default on every later turn,
// which is exactly how a "copy dispositions from X" request ended up acting
// on a result 29 dispositions short of what the agent actually has.
function toolResultLimit(toolName: string): number {
  return toolName === 'get_agent_details' || toolName === 'search_field_definitions' ? 20000 : MAX_TOOL_RESULT_CHARS
}

// Defense in depth, not a replacement for it: query_analytics already masks
// phone numbers that are DELIBERATELY selected as a dimension value, but that
// only covers one specific path. This is a blanket backstop over every tool
// result, live or replayed from history — any string anywhere in the result
// that is shaped like a phone number (10-15 digits once punctuation is
// stripped) gets masked before it reaches the model, regardless of which
// field it came from or whether we specifically anticipated that path.
function redactPhoneLikeStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replaceAll(/\+?\d[\d\s\-().]{7,16}\d/g, (match, offset: number, full: string) => {
      // a UUID/hash segment has a hex letter immediately touching a digit run
      // (agent_id, call_id) — a real phone number never does. Reject anything
      // adjacent to one rather than risk mangling an id the model needs intact.
      const before = full[offset - 1] ?? ''
      const after = full[offset + match.length] ?? ''
      if (/[a-fA-F]/.test(before) || /[a-fA-F]/.test(after)) return match
      const digits = match.replaceAll(/\D/g, '')
      if (digits.length < 10 || digits.length > 15) return match
      return `***${digits.slice(-4)}`
    })
  }
  if (Array.isArray(value)) return value.map(redactPhoneLikeStrings)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactPhoneLikeStrings(v)]))
  }
  return value
}

/** The exact shape the model loop already builds in memory for one turn, rebuilt for every PRIOR turn loaded from storage — truncated and windowed, never the raw unbounded record. */
function toWireMessages(history: StoredMessage[]): any[] {
  const wire: any[] = []
  for (const m of history.slice(-RECENT_HISTORY_TURNS)) {
    if (m.role === 'user') {
      wire.push({ role: 'user', content: m.content })
      continue
    }
    if (!m.toolCalls?.length) {
      wire.push({ role: 'assistant', content: m.content })
      continue
    }
    wire.push({
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: 'function' as const, function: { name: tc.name, arguments: JSON.stringify(tc.arguments ?? {}) } })),
    })
    for (const tc of m.toolCalls) {
      wire.push({ role: 'tool', tool_call_id: tc.id, content: truncateForContext(RAW_PHONE_RESULT_TOOLS.has(tc.name) ? tc.result : redactPhoneLikeStrings(tc.result), toolResultLimit(tc.name)) })
    }
  }
  return wire
}

export const runtime = 'nodejs'
// Without this, Next can buffer the whole SSE body instead of flushing it as
// produced — the same reason analytics/query (also a streamed response) sets
// it explicitly rather than relying on request.json() alone to imply dynamic.
export const dynamic = 'force-dynamic'

const enc = new TextEncoder()
const MAX_TOOL_ITERATIONS = 8

function sseChunk(data: string) {
  return enc.encode(`data: ${data}\n\n`)
}

// /api/askpi is outside Clerk and accepts the Agent Studio secret only.
// Do not attach the voice-backend service JWT here: Clerk treats Authorization
// as a session token and rewrites the call to a missing /clerk_* path (404).
function studioHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-agent-studio-secret': process.env.AGENT_STUDIO_SECRET ?? '',
  }
}

/** Links for users (NEXT_PUBLIC_APP_URL). Pi's MCP self-calls must hit the running Next server. */
function appUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function mcpCallbackBaseUrl() {
  const internal = process.env.INTERNAL_APP_URL?.trim()
  if (internal) return internal.replace(/\/$/, '')
  // Dev: NEXT_PUBLIC_APP_URL often differs from the port `next dev` binds (e.g. 3001 vs 3000).
  if (process.env.NODE_ENV === 'development') {
    return `http://127.0.0.1:${process.env.PORT || 3000}`
  }
  return appUrl()
}

const voiceList = MCP_VOICES.map((v) => `${v.name} (provider=${v.provider}, voice_id=${v.voice_id})`).join(', ')

function pinnedAgent(history: StoredMessage[]): { id: string; name: string } | null {
  let found: { id: string; name: string } | null = null
  for (const message of history) {
    for (const call of message.toolCalls ?? []) {
      if (call.success === false) continue
      const result = call.result ?? {}
      const id = result.agent_id || result.id || call.arguments?.agent_id
      const name = result.display_name
      if (!id || !name) continue
      if (['create_agent', 'edit_agent', 'get_agent_details', 'get_talk_link', 'open_custom_tool_form', 'open_page'].includes(call.name)) {
        found = { id: String(id), name: String(name) }
      }
    }
  }
  return found
}

function systemPrompt(projectId: string, canWrite: boolean, history: StoredMessage[]) {
  const extra = process.env.PI_SYSTEM_PROMPT_APPEND?.trim()
  const extraBlock = extra ? `\nOrganization-specific instructions:\n${extra}` : ''
  const pinned = pinnedAgent(history)
  const pinnedLine = pinned
    ? `PINNED AGENT (saved for this chat): "${pinned.name}" agent_id=${pinned.id}. Default to this for a later prompt edit, tool, or test call — but if the message names or clearly describes a DIFFERENT agent, re-resolve via list_agents instead of forcing the pinned one (see AGENT SCOPE below). Do not ask which agent when the pinned one is clearly still the right one.`
    : 'PINNED AGENT: none yet. When they name an agent, call list_agents, match the display name, and use that agent_id from then on.'
  return `You are Pi, Whispey's assistant for this organization (project_id=${projectId}).
${pinnedLine}
EDIT CONFIRMATION — handled by the app, not by you: a create_agent or edit_agent call you make is automatically held pending and shown to the user as a Confirm/Cancel button — the write does not happen until they click Confirm. You do not need to ask in text first or wait for a reply before calling the tool; call it as soon as you have the right arguments, in the same turn. Your text that turn should say what the pending action will do and name the exact agent (by name, and say "a new agent" if creating one) so the button they see matches what you described — get the agent identity right here, since the button executes exactly the agent_id/arguments you passed, not what you say in prose.
When asked for a prompt change (for example "make it a lead qualification agent"), on the agent in scope: get_agent_details, then edit_agent with a complete replacement prompt, in this same turn. Keep their brand, variables, greeting, and voice. Apply AGENT INTELLIGENCE general rules plus lead qualification, inbound, appointment reminder, or language when that is what they asked for. Do not paste the whole prompt unless they ask to see it.
Never say a prompt, voice, or LLM has been switched in THIS turn's text — the tool result you get back is always {__pending: true}, never the real outcome, because the write only happens later on the Confirm click (which you are not part of). Describe what the pending change WILL do, future tense; the UI shows success or cancellation on the button itself once they act on it. Sarvam Priya is the speaking voice, not the LLM. Sarvam 105 means llm_model sarvam-105b-conversations.
PHONE NUMBERS: to attach a number for inbound calls — call list_phone_numbers, let the user pick (or search_plivo_numbers to buy one: always show the monthly USD price, never buy without the user explicitly choosing that number), then call attach_inbound_number / buy_plivo_number. If list_phone_numbers shows no available_to_attach, say none are free and offer to search for and buy a new one (ask only for country, default IN, and optionally an area/prefix), then after the buy is confirmed call list_phone_numbers again and attach it. Both are held for a Confirm button like edits (result is {__pending:true}; describe in future tense). Inbound always uses the shared inbound trunk automatically. Outbound numbers are NOT handled by you yet — say so.
Capabilities: ${canWrite ? 'read and write agents, extractors, analytics;' : 'read-only (viewer) — no create/edit;'} test-call links via get_talk_link.
Voices: ${voiceList}.

${piPlatformSchemaDoc()}

${PI_AGENT_INTELLIGENCE_DOC}

${PI_MANDATORY_ANALYTICS_TOOLS_DOC}

${PI_ANALYTICS_RECIPES_DOC}

When create_agent or edit_agent fails, tell the user the exact error and details from the tool result (quota, voice backend, unauthorized, validation). Do not say "try again" without the reason.

${extraBlock}`
}

// --- Fixed tool registry, scoped to one project_id per request ---

const FieldRef = {
  type: 'object',
  properties: { col: { type: 'string' }, path: { type: 'array', items: { type: 'string' } } },
  required: ['col'],
} as const

const FilterSchema = {
  type: 'object',
  properties: {
    field: FieldRef,
    op: { type: 'string', enum: ['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'is_empty', 'is_not_empty', 'is_true', 'is_false'] },
    value: {},
  },
  required: ['field', 'op'],
} as const

function toolSchemas(canWrite: boolean): OpenAI.Chat.ChatCompletionTool[] {
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_call_volume_trend',
        description: 'REQUIRED for call volume trends over time. Returns daily counts, total, average per day, and up/down trend. Do not use query_analytics or list_analytics_fields for this.',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Default 30' },
            agent_id: { type: 'string', description: 'Optional — one agent only' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_completion_insights',
        description: 'REQUIRED for task completion, goal achieved, outcomes, success rates. Scans extractor/analytics fields and returns rates for the period. Default days=7 for "last week".',
        parameters: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Default 7' },
            agent_id: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_page',
        description: 'Open a page in this app. Call only when the user asks to go to, open, or show a screen (call logs, agent config, overview, analytics, agents, campaigns, settings, phone calls, knowledge, QA). Do not call it to edit a prompt — use edit_agent for that. Do not paste a URL.',
        parameters: {
          type: 'object',
          properties: {
            page: {
              type: 'string',
              enum: ['logs', 'overview', 'config', 'phone_calls', 'knowledge', 'qa', 'campaign_logs', 'agents', 'analytics', 'campaigns', 'campaign', 'settings', 'phone_settings', 'api_keys'],
            },
            agent_id: { type: 'string', description: 'Required for logs, overview, config, phone_calls, knowledge, qa, campaign_logs' },
            campaign_id: { type: 'string', description: 'Required for page=campaign' },
          },
          required: ['page'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_agents',
        description: "List this project's voice agents (id, display_name, extractor_count).",
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_analytics_fields',
        description: 'List custom/disposition analytics fields (JSON paths). Skip this for standard metrics (call counts, duration, latency, call_ended_reason, agent_id) — use the analytics recipes instead.',
        parameters: { type: 'object', properties: { agent_id: { type: 'string' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_field_definitions',
        description: "Search the FULL, untruncated text of an agent's field_extractor/disposition descriptions for a specific word or phrase. list_analytics_fields only shows a short summary of each description (the first sentence near the start) — some descriptions run tens of thousands of characters, and what a term like a specific disposition value actually means can be defined far past what that summary shows. Call this before concluding a term doesn't exist for an agent, whenever list_analytics_fields didn't surface it.",
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            term: { type: 'string', description: 'Word or short phrase to search for, case-insensitive.' },
          },
          required: ['agent_id', 'term'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'query_analytics',
        description: 'Advanced analytics only — NOT for call volume trends (use get_call_volume_trend) or task completion (use get_completion_insights).',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            spec: {
              type: 'object',
              properties: {
                spec_version: { type: 'number', description: 'Always 1' },
                source: { type: 'string', enum: ['voice', 'whatsapp', 'journeys'] },
                agg: { type: 'object', description: '{ fn: count|count_distinct|rate|sum|avg|... , field?: ref, denominator?: field_present|all_rows for rate }. "Unique" calls/callers means count_distinct on the customer/phone field, not count — a plain count includes retries and redials of the same person.' },
                bucket: { type: 'string', enum: ['none', 'auto', 'hour', 'day', 'week', 'month'], description: 'Time series: use day/week/month for trends — NOT dimension on timestamps' },
                dimension: { type: 'object', description: 'Breakdown by a field ref (e.g. call_ended_reason, agent_id)' },
                range: { type: 'object', description: '{ days: N } or { from, to } YYYY-MM-DD' },
                filters: { type: 'array', items: FilterSchema },
                having: { type: 'array', items: FilterSchema },
              },
              required: ['spec_version', 'agg', 'range'],
            },
          },
          required: ['spec'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_talk_link',
        description: 'Show an in-chat Start agent button so the user can talk to this voice agent and stop it here. Do not mention a URL.',
        parameters: { type: 'object', properties: { agent_id: { type: 'string' } }, required: ['agent_id'] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_agent_details',
        description: "Get an agent's CURRENT prompt, greeting, voice, prompt variables, field extractors (dispositions), extractor_count, and extractor variables. Always call this before editing. Extractor keys are lowercase_snake_case; descriptions may include {{name}} placeholders wired via extractor_variables to call-log paths like metadata.name.",
        parameters: { type: 'object', properties: { agent_id: { type: 'string' } }, required: ['agent_id'] },
      },
    },
  ]
  if (!canWrite) return tools
  tools.push(
    {
      type: 'function',
      function: {
        name: 'create_agent',
        description: 'Create a new voice agent in this chat. Only display_name is required — default prompt and voice are applied if omitted. This tool cannot set the conversation LLM — there is no llm_model argument here. If the user asked for a specific LLM (e.g. Sarvam 105), call edit_agent with llm_model right after this succeeds, in the same turn, before replying — do not just mention the model in the prompt text, which sets nothing. Further prompt edits stay in this chat via edit_agent. Never tell the user to open the studio.',
        parameters: {
          type: 'object',
          properties: {
            display_name: { type: 'string', description: 'Human-readable agent name' },
            prompt: { type: 'string', description: 'Optional system prompt' },
            greeting: { type: 'string', description: 'Optional first message' },
            voice_provider: { type: 'string', description: 'elevenlabs or sarvam' },
            voice_id: { type: 'string' },
            dispositions: {
              type: 'array',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, description: { type: 'string' } },
                required: ['key', 'description'],
              },
            },
          },
          required: ['display_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_custom_tool_form',
        description: 'Open the in-chat custom tool form for an agent. Call this whenever the user wants to add or change a tool. Fill any fields they already stated. The form collects method, URL, headers, parameters, and body. Do not say the tool was added until they submit the form.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            type: { type: 'string', enum: ['custom_function', 'end_call', 'knowledge_search', 'voicemail_detection', 'update_vad_options'] },
            name: { type: 'string' },
            description: { type: 'string' },
            api_url: { type: 'string' },
            http_method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            timeout: { type: 'number' },
            async: { type: 'boolean' },
            headers: { type: 'object' },
            parameters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                  required: { type: 'boolean' },
                },
                required: ['name'],
              },
            },
            custom_payload: { type: 'string', description: 'JSON body template. Placeholders are __paramName__ and __timestamp__.' },
          },
          required: ['agent_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'edit_agent',
        description: "Write or change an agent's prompt, greeting, voice (TTS), conversation LLM, prompt variables, field extractors, and/or extractor variables. This is the only way a setting is saved. Never tell the user a prompt, voice, or LLM changed unless this tool returns success and updated includes that field. llm_model sarvam-105b-conversations is Sarvam 105 for conversation. sarvam-105b is the base 105B model. Voice (Priya) is TTS and is not the LLM. For an existing agent's prompt, changing one instruction or section: use prompt_patch, not prompt — prompts run tens of thousands of characters, and re-outputting the whole thing for a one-line change wastes output tokens for no benefit.",
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            prompt: { type: 'string', description: 'Full replacement prompt text. Only use this for a new prompt or a rewrite touching most of it — for changing one part of an existing prompt, use prompt_patch instead so you do not have to re-output the whole thing.' },
            prompt_patch: {
              type: 'object',
              description: 'Change one part of the CURRENT prompt without re-sending all of it — far cheaper in output tokens than `prompt` for a small edit. old_string must match the current prompt text exactly (verbatim, including whitespace) and must occur exactly once; include a few surrounding words if the exact phrase repeats. Never use both `prompt` and `prompt_patch` in the same call.',
              properties: {
                old_string: { type: 'string', description: 'Exact text to find in the current prompt, unique within it.' },
                new_string: { type: 'string', description: 'Text to replace it with.' },
              },
              required: ['old_string', 'new_string'],
            },
            greeting: { type: 'string' },
            voice_provider: { type: 'string' },
            voice_id: { type: 'string' },
            llm_model: { type: 'string', enum: ['sarvam-105b-conversations', 'sarvam-105b'], description: 'Conversation LLM. Sarvam 105 → sarvam-105b-conversations.' },
            variables: { type: 'object', description: 'Prompt {{variable}} defaults (flat string map). Merged with existing.' },
            extractor_variables: { type: 'object', description: 'Extractor description {{name}} → call-log column path, e.g. {"customer_name":"metadata.name"}. Replaces the whole map if sent.' },
            dispositions: {
              type: 'array',
              description: 'Dispositions to add or update, by key. Merged into the agent\'s EXISTING dispositions by default — a key that already exists gets its description updated, a new key gets added, every other existing disposition is left untouched. You do NOT need to re-send dispositions you are not changing. Set dispositions_mode to "replace" only if the user explicitly wants every other disposition removed.',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, description: { type: 'string' } },
                required: ['key', 'description'],
              },
            },
            dispositions_mode: { type: 'string', enum: ['merge', 'replace'], description: 'Default "merge" (see dispositions). "replace" deletes every disposition not included in this call — confirm that is really wanted before using it.' },
          },
          required: ['agent_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_phone_numbers',
        description: 'List phone numbers for this project: numbers already attached here, and unassigned Plivo numbers that can be attached. Use before attach_inbound_number so the user can pick one.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_plivo_numbers',
        description: 'Search Plivo for numbers that can be BOUGHT (does not buy). Returns number, type, city and the monthly price in USD. Always show the price when presenting options.',
        parameters: {
          type: 'object',
          properties: {
            country_iso: { type: 'string', description: 'ISO country code, e.g. IN or US' },
            type: { type: 'string', enum: ['local', 'tollfree', 'mobile', 'national', 'fixed'] },
            pattern: { type: 'string', description: 'Optional digits the number should start with (without country code)' },
          },
          required: ['country_iso'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'buy_plivo_number',
        description: 'Buy ONE number from a search_plivo_numbers result. Costs real money and needs project owner/admin; the user must click Confirm on a card showing the price. Only call for a number the user explicitly chose.',
        parameters: {
          type: 'object',
          properties: { number: { type: 'string', description: 'Exact number from the search result' }, country_iso: { type: 'string' } },
          required: ['number', 'country_iso'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'attach_inbound_number',
        description: 'Attach an unassigned Plivo number to an agent for INBOUND calls: points it at the shared inbound SIP trunk, creates the LiveKit trunk named <project>-inbound-<last4>, and routes calls to the agent. The user confirms on a card first.',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { type: 'string' },
            number: { type: 'string', description: 'Exact number from list_phone_numbers' },
            krisp_enabled: { type: 'boolean', description: 'Noise cancellation, default false' },
          },
          required: ['agent_id', 'number'],
        },
      },
    }
  )
  return tools
}

async function runListAgents(projectId: string) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_agents')
    .select('id, display_name, is_active, field_extractor, field_extractor_prompt')
    .eq('project_id', projectId)
    .order('display_name')
  if (error) return { success: false, result: { error: error.message } }
  const agents = (data ?? []).map((row) => {
    const dispositions = parseExtractorList(row.field_extractor_prompt)
    const enabled = !!row.field_extractor && dispositions.length > 0
    return {
      id: row.id,
      display_name: row.display_name,
      is_active: row.is_active,
      extractor_enabled: enabled,
      extractor_count: enabled ? dispositions.length : 0,
    }
  })
  return { success: true, result: { agents } }
}

function parseExtractorList(prompt: unknown) {
  if (Array.isArray(prompt)) return prompt.filter((p: any) => p?.key)
  if (typeof prompt !== 'string' || !prompt.trim()) return []
  try {
    const parsed = JSON.parse(prompt)
    return Array.isArray(parsed) ? parsed.filter((p: any) => p?.key) : []
  } catch {
    return []
  }
}

function asStringMap(value: unknown): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'extractor_variables must be an object of string column paths' }
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string' || !k.trim()) return { ok: false, error: `extractor_variables.${k} must be a string column path` }
    out[k] = v
  }
  return { ok: true, value: out }
}

async function runCreateAgent(projectId: string, args: any) {
  const displayName = String(args.display_name ?? args.name ?? '').trim()
  if (!displayName) {
    return { success: false, result: { error: 'display_name is required' } }
  }

  const defaultVoice = MCP_VOICES[0]
  const voice_provider = args.voice_provider ?? defaultVoice.provider
  const voice_id = args.voice_id ?? defaultVoice.voice_id
  const prompt =
    args.prompt?.trim() ||
    `You are ${displayName}, a helpful and professional voice assistant for this organization. Keep responses concise and clear.`

  const promptValidation = validateVariables(prompt)
  if (!promptValidation.isValid) {
    return { success: false, result: { error: `Prompt has invalid {{variable}} name(s): ${promptValidation.errors.map((e) => e.message).join('; ')}` } }
  }

  const body: Record<string, unknown> = {
    project_id: projectId,
    display_name: displayName,
    prompt,
    voice: { provider: voice_provider, voice_id },
    created_by: 'pi',
  }
  if (args.greeting) body.greeting = args.greeting
  if (args.dispositions) body.dispositions = args.dispositions

  const url = `${mcpCallbackBaseUrl()}/api/askpi/agents`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: studioHeaders(),
      body: JSON.stringify(body),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      return {
        success: false,
        result: {
          error: data?.error ?? `Agent create failed (HTTP ${resp.status})`,
          details: data?.details,
          voice_backend: getPypeApiBaseUrlForServer('classic') ?? 'not configured',
        },
      }
    }
    const created = { ...((data ?? {}) as Record<string, unknown>) }
    delete created.studio_url
    return { success: true, result: created }
  } catch (err: any) {
    return {
      success: false,
      result: {
        error: err?.message ?? 'Could not reach MCP create route',
        hint: `Pi calls ${url}. In dev, set INTERNAL_APP_URL=http://127.0.0.1:3000 if NEXT_PUBLIC_APP_URL points at a different port.`,
        voice_backend: getPypeApiBaseUrlForServer('classic') ?? 'not configured',
      },
    }
  }
}

/** An agent_id must belong to this project — never trust one the model echoed back without checking. */
async function agentBelongsToProject(agentId: string, projectId: string): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('pype_voice_agents').select('id').eq('id', agentId).eq('project_id', projectId).maybeSingle()
  return !!data
}

type LoadedAssistant = { backendAgentName: string; deploymentTarget: 'classic' | 'docker'; assistant: Record<string, any> }

/**
 * Loads the agent's CURRENT live assistant config from the voice backend —
 * the same call /api/mcp/agents/[id]'s PATCH makes before editing. Pi needs
 * this for every edit (prompt/greeting are a full replace, not a patch) and
 * for get_agent_details, which exists specifically because an assistant with
 * no way to see the current prompt can't make a sensible targeted change to it.
 */
async function loadCurrentAssistant(agentId: string): Promise<{ error: string } | LoadedAssistant> {
  const supabase = createServiceRoleClient()
  const { data: agent } = await supabase.from('pype_voice_agents').select('name').eq('id', agentId).maybeSingle()
  if (!agent) return { error: 'Agent not found' }
  const backendAgentName = `${agent.name}_${agentId.replaceAll('-', '_')}`

  const deploymentTarget = await getDeploymentTargetFromAgentBackendName(backendAgentName)
  const apiBase = getPypeApiBaseUrlForServer(deploymentTarget)
  if (!apiBase) return { error: 'Voice backend URL is not configured' }

  try {
    const resp = await fetchPypeApiWithRetry(`${apiBase}/agent_config/${encodeURIComponent(backendAgentName)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
    })
    if (!resp.ok) return { error: 'Failed to load current agent config' }
    const config = await resp.json()
    const assistant = config?.agent?.assistant?.[0]
    if (!assistant) return { error: 'Current agent config has no assistant to read' }
    return { backendAgentName, deploymentTarget, assistant }
  } catch (err) {
    return { error: isPypeUpstreamUnreachable(err) ? 'Voice backend is unreachable' : 'Failed to load current agent config' }
  }
}

async function runGetAgentDetails(projectId: string, args: any) {
  if (!(await agentBelongsToProject(args.agent_id, projectId))) {
    return { success: false, result: { error: 'No such agent in this project' } }
  }
  const loaded = await loadCurrentAssistant(args.agent_id)
  if ('error' in loaded) return { success: false, result: { error: loaded.error } }

  const supabase = createServiceRoleClient()
  const { data: row } = await supabase
    .from('pype_voice_agents')
    .select('display_name, field_extractor, field_extractor_prompt, field_extractor_variables')
    .eq('id', args.agent_id)
    .maybeSingle()
  const { assistant } = loaded
  const rawDispositions = parseExtractorList(row?.field_extractor_prompt)
  // Key + short summary only, not the full description — an agent can have
  // dozens of dispositions and a single description can run 10,000+
  // characters (a full quality-review rubric), so including full text here
  // doesn't scale: even a generous truncation limit fits only one or two
  // entries before cutting the rest, which is exactly how "copy dispositions
  // from X" ended up acting on a list 29 entries short of the real one. To
  // read or copy a specific disposition's full text, call
  // search_field_definitions with its key.
  const dispositions = rawDispositions.map((d: any) => ({
    key: d.key,
    summary: typeof d.description === 'string' ? summarise(d.description) : '',
  }))
  const extractorEnabled = !!row?.field_extractor && dispositions.length > 0
  return {
    success: true,
    result: {
      agent_id: args.agent_id,
      display_name: row?.display_name ?? null,
      prompt: assistant.prompt,
      greeting: assistant.first_message_mode?.first_message ?? null,
      voice: { provider: assistant.tts?.provider, voice_id: assistant.tts?.voice_id ?? assistant.tts?.speaker },
      llm: { provider: assistant.llm?.provider ?? assistant.llm?.name ?? null, model: assistant.llm?.model ?? null },
      variables: assistant.variables ?? {},
      extractor_enabled: extractorEnabled,
      extractor_count: extractorEnabled ? dispositions.length : 0,
      dispositions,
      extractor_variables: row?.field_extractor_variables ?? {},
    },
  }
}

/** Saves dispositions straight to the agent row — no redeploy needed, same as /api/mcp/agents/[id]'s own PATCH. */
async function saveDispositions(agentId: string, dispositions: unknown): Promise<{ error?: string }> {
  const checked = validateDispositions(dispositions)
  if (!checked.ok) return { error: checked.error }
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('pype_voice_agents')
    .update({ ...dispositionsToAgentColumns(checked.dispositions), updated_at: new Date().toISOString() })
    .eq('id', agentId)
  return error ? { error: error.message } : {}
}

async function runEditAgent(projectId: string, _callerUserId: string, args: any) {
  if (!(await agentBelongsToProject(args.agent_id, projectId))) {
    return { success: false, result: { error: 'No such agent in this project' } }
  }

  const touchesAssistant = args.prompt !== undefined || args.prompt_patch !== undefined || args.greeting !== undefined || args.variables !== undefined || (args.voice_provider && args.voice_id) || args.llm_model !== undefined
  const updated: Record<string, boolean> = {}

  if (args.extractor_variables !== undefined) {
    const mapped = asStringMap(args.extractor_variables)
    if (!mapped.ok) return { success: false, result: { error: mapped.error } }
    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from('pype_voice_agents')
      .update({ field_extractor_variables: mapped.value, updated_at: new Date().toISOString() })
      .eq('id', args.agent_id)
    if (error) return { success: false, result: { error: error.message } }
    updated.extractor_variables = true
  }

  if (args.dispositions !== undefined) {
    // saveDispositions is a full replace of the stored list — merge by key here
    // by default so "add a disposition" doesn't silently delete every other one
    // already on the agent. dispositions_mode: "replace" opts into the old
    // destructive behavior explicitly, for the rare case that's really intended.
    let finalDispositions = args.dispositions
    if (args.dispositions_mode !== 'replace') {
      const supabase = createServiceRoleClient()
      const { data: row } = await supabase.from('pype_voice_agents').select('field_extractor_prompt').eq('id', args.agent_id).maybeSingle()
      const existing = parseExtractorList(row?.field_extractor_prompt) as Array<{ key: string; description: string }>
      const byKey = new Map(existing.map((d) => [d.key, d]))
      for (const d of args.dispositions as Array<{ key: string; description: string }>) byKey.set(d.key, d)
      finalDispositions = Array.from(byKey.values())
    }
    const saved = await saveDispositions(args.agent_id, finalDispositions)
    if (saved.error) return { success: false, result: { error: saved.error } }
    updated.dispositions = true
  }

  if (!touchesAssistant) return { success: true, result: { agent_id: args.agent_id, updated } }

  const loaded = await loadCurrentAssistant(args.agent_id)
  if ('error' in loaded) return { success: false, result: { error: loaded.error } }
  const { backendAgentName, deploymentTarget, assistant } = loaded

  // prompt_patch exists so a small change doesn't force re-generating the
  // entire prompt as output tokens — the model sends only the old/new snippet,
  // the full text is reconstructed server-side from what's already stored
  let nextPrompt = args.prompt
  if (args.prompt_patch) {
    const current = assistant.prompt ?? ''
    const { old_string, new_string } = args.prompt_patch
    const occurrences = current.split(old_string).length - 1
    if (occurrences === 0) {
      return { success: false, result: { error: 'prompt_patch.old_string was not found in the current prompt — it must match exactly, including whitespace' } }
    }
    if (occurrences > 1) {
      return { success: false, result: { error: `prompt_patch.old_string matches ${occurrences} places in the current prompt — include more surrounding text to make it unique` } }
    }
    nextPrompt = current.replace(old_string, new_string)
  }

  // Same rule the Studio's own prompt editor enforces (variableValidator.ts) —
  // a variable Pi writes that the Studio would reject makes the agent
  // inconsistent the moment someone opens it there, even though the runtime
  // substitution itself has no such limit.
  if (nextPrompt) {
    const validation = validateVariables(nextPrompt)
    if (!validation.isValid) {
      return { success: false, result: { error: `Prompt has invalid {{variable}} name(s): ${validation.errors.map((e) => e.message).join('; ')}` } }
    }
  }

  let mcpVoice
  if (args.voice_provider && args.voice_id) {
    mcpVoice = findMcpVoice(args.voice_provider, args.voice_id)
    if (!mcpVoice) return { success: false, result: { error: `Voice ${args.voice_provider}/${args.voice_id} is not in the Agent Studio voice list` } }
  }

  const updatedAssistant = applyAssistantUpdates(assistant, {
    prompt: nextPrompt,
    greeting: args.greeting,
    tts: mcpVoice ? buildMcpTtsConfig(mcpVoice) : undefined,
    variables: args.variables,
  })

  if (args.llm_model !== undefined) {
    const llmModel = String(args.llm_model)
    if (llmModel !== 'sarvam-105b-conversations' && llmModel !== 'sarvam-105b') {
      return { success: false, result: { error: `Unknown LLM "${llmModel}". Use sarvam-105b-conversations (Sarvam 105) or sarvam-105b.` } }
    }
    updatedAssistant.llm = {
      name: 'sarvam',
      provider: 'sarvam',
      model: llmModel,
      temperature: assistant.llm?.temperature ?? 0.3,
    }
    updated.llm = true
  }

  const supabase = createServiceRoleClient()
  const deployed = await deployAgentConfig(
    backendAgentName,
    {
      agent: {
        name: backendAgentName,
        agent_id: args.agent_id,
        assistant: [updatedAssistant],
        ...(await resolveWhispeyKeyFields(supabase, projectId)),
      },
    },
    deploymentTarget,
  )
  if (!deployed.ok) return { success: false, result: { error: deployed.errorText || 'Failed to deploy updated config' } }
  const { data: named } = await supabase.from('pype_voice_agents').select('display_name').eq('id', args.agent_id).maybeSingle()
  return {
    success: true,
    result: {
      agent_id: args.agent_id,
      backend_name: backendAgentName,
      display_name: named?.display_name ?? null,
      updated: {
        prompt: args.prompt !== undefined || args.prompt_patch !== undefined,
        greeting: args.greeting !== undefined,
        voice: !!mcpVoice,
        llm: updated.llm === true ? updatedAssistant.llm?.model : undefined,
        variables: args.variables !== undefined,
        ...updated,
      },
    },
  }
}

async function runListAnalyticsFields(projectId: string, args: any) {
  if (args.agent_id && !(await agentBelongsToProject(args.agent_id, projectId))) {
    return { success: false, result: { error: 'No such agent in this project' } }
  }
  const resolved = await resolveScope({ agentId: args.agent_id, projectId: args.agent_id ? undefined : projectId })
  if (!resolved || isDenied(resolved)) return { success: false, result: { error: 'Access denied' } }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_analytics_fields')
    .select('*')
    .in('agent_id', resolved.ctx.agentIds)
    .order('coverage_pct', { ascending: false })
  if (error) return { success: false, result: { error: error.message } }

  // The fields picker (/api/analytics/fields) rescans on demand when an agent's
  // catalog is empty or stale — this path read the raw cached table directly and
  // skipped that, so a newly-configured agent with real extractor fields looked
  // like it had none at all (Pi told a user "no custom fields defined" when the
  // agent had 29 of them, just never scanned into this table yet).
  const byAgent = new Map<string, any[]>()
  for (const r of data ?? []) {
    const list = byAgent.get(r.agent_id as string) ?? []
    list.push(r)
    byAgent.set(r.agent_id as string, list)
  }
  const rescanProjectId = 'agent' in resolved ? resolved.agent.projectId : projectId
  const scanned: any[][] = await Promise.all(
    resolved.ctx.agentIds.map(async (agentId) => {
      const existing = byAgent.get(agentId) ?? []
      if (!catalogIsStale(existing, Date.now())) return existing
      try {
        return await rescanAnalyticsFields(agentId, rescanProjectId, existing)
      } catch (err) {
        console.error('[pi/chat] list_analytics_fields rescan failed', agentId, err)
        return existing
      }
    })
  )
  const rows = scanned.flat().sort((a: any, b: any) => Number(b.coverage_pct) - Number(a.coverage_pct)).slice(0, 150)

  const visible = rows.filter(
    (r: any) => !resolved.ctx.deniedFields.has(r.col) && !resolved.ctx.deniedFields.has(`${r.col}.${(r.path ?? []).join('.')}`)
  )

  // the agent's own field_extractor wording beats a guess from the column name —
  // "unassured" or "confirmation" only resolve correctly against what the client
  // actually wrote for that field, same as the fields picker (src/app/api/analytics/fields/route.ts)
  const includeDescription = resolved.role !== 'viewer'
  let described: Array<Record<string, unknown>>
  if ('agent' in resolved) {
    described = applyDeclarations(visible, resolved.agent.extractorPrompt, { includeDescription })
  } else {
    const { data: agents } = await supabase
      .from('pype_voice_agents')
      .select('id, field_extractor_prompt')
      .in('id', resolved.ctx.agentIds)
    const extractorPromptByAgent = new Map((agents ?? []).map((a) => [a.id, a.field_extractor_prompt ?? null]))
    described = resolved.ctx.agentIds.flatMap((agentId) =>
      applyDeclarations(visible.filter((r) => r.agent_id === agentId), extractorPromptByAgent.get(agentId) ?? null, { includeDescription })
    )
  }

  // trim back down to what the model needs — `visible` rows now carry the full
  // catalog row shape (encoding, sentinels, cardinality, …) since rescan needs
  // that to decide what survives a re-scan; none of it is useful to Pi
  const trimmed = described.map((f: any) => ({
    col: f.col, path: f.path, label: f.label, value_type: f.value_type, boolean_encoding: f.boolean_encoding,
    is_dimension: f.is_dimension, coverage_pct: f.coverage_pct, enum_values: f.enum_values,
    description: f.description,
  }))

  return { success: true, result: { fields: trimmed } }
}

// Field/disposition descriptions can run tens of thousands of characters (a
// full quality-review rubric, not a one-liner) — list_analytics_fields only
// shows a short summary of the first sentence near the start (extractor.ts's
// `summarise`, capped at 4000 chars in / 150 chars out), so a term defined
// deep in a long description never reaches the model through that path at
// all. This searches the full, untruncated text instead.
async function runSearchFieldDefinitions(projectId: string, args: any) {
  if (!args.agent_id) return { success: false, result: { error: 'agent_id is required' } }
  if (!args.term || typeof args.term !== 'string') return { success: false, result: { error: 'term is required' } }
  if (!(await agentBelongsToProject(args.agent_id, projectId))) {
    return { success: false, result: { error: 'No such agent in this project' } }
  }
  const resolved = await resolveScope({ agentId: args.agent_id })
  if (!resolved || isDenied(resolved)) return { success: false, result: { error: 'Access denied' } }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_agents')
    .select('field_extractor_prompt')
    .eq('id', args.agent_id)
    .maybeSingle()
  if (error) return { success: false, result: { error: error.message } }

  const fields = parseExtractorList(data?.field_extractor_prompt) as Array<{ key: string; description?: string }>
  const term = args.term.toLowerCase()

  // an exact key match (e.g. copying a disposition's real text elsewhere, or
  // reading one you already know the name of) gets its FULL description back,
  // not a windowed snippet — get_agent_details only gives a short summary per
  // disposition precisely so this is the path back to the whole thing
  const exact = fields.find((f) => f.key.toLowerCase() === term)
  if (exact) {
    return { success: true, result: { matches: [{ field: exact.key, context: exact.description ?? '' }] } }
  }

  const CONTEXT_CHARS = 350
  const matches: Array<{ field: string; context: string }> = []

  for (const f of fields) {
    const text = f.description ?? ''
    const lower = text.toLowerCase()
    let idx = lower.indexOf(term)
    let found = 0
    while (idx !== -1 && found < 3 && matches.length < 10) {
      const start = Math.max(0, idx - CONTEXT_CHARS)
      const end = Math.min(text.length, idx + term.length + CONTEXT_CHARS)
      matches.push({
        field: f.key,
        context: `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`,
      })
      idx = lower.indexOf(term, idx + term.length)
      found++
    }
  }

  return {
    success: true,
    result: matches.length
      ? { matches }
      : { matches: [], note: `"${args.term}" does not appear anywhere in this agent's field or disposition definitions.` },
  }
}

// The model keeps guessing a disposition/extractor KEY as a bare top-level
// column (e.g. `{col: 'final_disposition'}`) instead of looking it up first —
// it almost always actually lives at `{col: 'transcription_metrics', path:
// ['final_disposition']}`. Rather than rely entirely on prompting the model to
// never do this, correct it here: any field ref whose col isn't a real column
// gets matched against the agent's own field catalog by its path's last
// segment, so a reasonable guess still works instead of failing validation.
async function correctFieldRefs(rawSpec: Record<string, unknown>, agentIds: string[]): Promise<Record<string, unknown>> {
  const refs: Array<{ col: string; path?: string[] }> = []
  const dimField = (rawSpec as any)?.dimension?.field
  if (dimField) refs.push(dimField)
  const aggField = (rawSpec as any)?.agg?.field
  if (aggField) refs.push(aggField)
  for (const arr of [(rawSpec as any)?.filters, (rawSpec as any)?.having]) {
    if (Array.isArray(arr)) for (const node of arr) if (node?.field) refs.push(node.field)
  }
  const needsFix = refs.filter((r) => r && typeof r.col === 'string' && !ALL_COLS.has(r.col))
  if (!needsFix.length || !agentIds.length) return rawSpec

  const supabase = createServiceRoleClient()
  const { data } = await supabase.from('pype_analytics_fields').select('col, path').in('agent_id', agentIds)
  const byLeaf = new Map<string, { col: string; path?: string[] }>()
  for (const row of data ?? []) {
    const path = (row.path ?? []) as string[]
    const leaf = (path.length ? path.at(-1) : row.col)?.toLowerCase()
    if (leaf && !byLeaf.has(leaf)) byLeaf.set(leaf, { col: row.col, path: path.length ? path : undefined })
  }
  for (const r of needsFix) {
    const match = byLeaf.get(r.col.toLowerCase())
    if (!match) continue
    r.col = match.col
    if (match.path) r.path = match.path
    else delete r.path
  }
  return rawSpec
}

async function runQueryAnalytics(projectId: string, args: any) {
  if (args.agent_id && !(await agentBelongsToProject(args.agent_id, projectId))) {
    return { success: false, result: { error: 'No such agent in this project' } }
  }
  const resolved = await resolveScope({ agentId: args.agent_id, projectId: args.agent_id ? undefined : projectId })
  if (!resolved || isDenied(resolved)) return { success: false, result: { error: 'Access denied' } }

  // tolerate the model flattening { agg, range, ... } onto the top-level args
  // instead of nesting them under `spec` as the tool schema requires — seen in
  // practice, and silently correcting it beats failing a query whose shape was
  // otherwise exactly right
  let rawSpec: any = {}
  if (args.spec && typeof args.spec === 'object') rawSpec = args.spec
  else if (args.agg || args.range) rawSpec = args
  const correctedSpec = await correctFieldRefs(rawSpec, resolved.ctx.agentIds)

  let spec
  try {
    spec = Spec.parse({ source: 'voice', grain: 'interaction', ...correctedSpec })
  } catch (err: any) {
    return { success: false, result: { error: `Invalid spec: ${err?.message ?? 'validation failed'}` } }
  }

  // dimensioning by a phone-shaped field (customer_number etc.) puts the near-full
  // number in `bucket`/`series` — that must not reach the model verbatim
  const dimensionIsPhone = !!spec.dimension && isPhoneField(spec.dimension.field)
  const maskPhone = (v: unknown) => {
    if (typeof v !== 'string') return v
    const digits = v.replaceAll(/\D/g, '')
    return digits.length >= 7 ? `***${digits.slice(-4)}` : v
  }

  try {
    const [plan] = planDashboardQueries([{ id: 'pi', spec }], resolved.ctx)
    logPiSql(projectId, args.agent_id, plan.sql, plan.params)
    const rows = await runQuery(plan.sql, plan.params, 20_000)
    const simplified = (rows as Record<string, unknown>[]).map((r) => ({
      bucket: dimensionIsPhone ? maskPhone(r.bucket ?? r.series ?? null) : (r.bucket ?? r.series ?? null),
      value: r.value ?? r.value_0,
    }))
    return {
      success: true,
      result: {
        data: simplified.length ? simplified : rows,
        meta: plan.meta,
        note: plan.meta.bucket === 'none' ? undefined : 'Each row is one time bucket with value = metric for that period.',
      },
    }
  } catch (err: any) {
    if (isTimeout(err)) return { success: false, result: { error: 'Query took too long — try a shorter date range' } }
    return { success: false, result: { error: err?.message ?? 'Query failed' } }
  }
}

async function runOpenCustomToolForm(projectId: string, args: any) {
  const linked = await runGetTalkLink(projectId, args)
  if (!linked.success) return linked
  return {
    success: true,
    result: {
      ...linked.result,
      agent_id: args.agent_id,
      show_form: true,
      draft: {
        type: args.type || 'custom_function',
        name: args.name || '',
        description: args.description || '',
        api_url: args.api_url || '',
        http_method: args.http_method || 'POST',
        timeout: args.timeout ?? 10,
        async: args.async !== false,
        headers: args.headers || {},
        parameters: Array.isArray(args.parameters) ? args.parameters : [],
        custom_payload: args.custom_payload || '',
      },
    },
  }
}

const AGENT_PAGES = new Set(['logs', 'overview', 'config', 'phone_calls', 'knowledge', 'qa', 'campaign_logs'])

async function runOpenPage(projectId: string, args: any) {
  const page = String(args.page || '')
  const agentId = typeof args.agent_id === 'string' ? args.agent_id : ''
  const campaignId = typeof args.campaign_id === 'string' ? args.campaign_id : ''

  if (page === 'agents') return { success: true, result: { href: `/${projectId}/agents`, label: 'Agent list' } }
  if (page === 'analytics') return { success: true, result: { href: `/${projectId}/analytics`, label: 'Org overview' } }
  if (page === 'campaigns') return { success: true, result: { href: `/${projectId}/campaigns`, label: 'Campaigns' } }
  if (page === 'settings') return { success: true, result: { href: `/${projectId}/settings`, label: 'Settings' } }
  if (page === 'phone_settings') return { success: true, result: { href: `/${projectId}/agents/sip-management`, label: 'Phone settings' } }
  if (page === 'api_keys') return { success: true, result: { href: `/${projectId}/agents/api-keys`, label: 'Project API key' } }
  if (page === 'campaign') {
    if (!campaignId) return { success: false, result: { error: 'campaign_id is required' } }
    return { success: true, result: { href: `/${projectId}/campaigns/${campaignId}`, label: 'Campaign' } }
  }
  if (!AGENT_PAGES.has(page)) return { success: false, result: { error: 'Unknown page' } }
  if (!agentId) return { success: false, result: { error: 'agent_id is required' } }

  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_agents')
    .select('display_name, agent_type, configuration')
    .eq('id', agentId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!data) return { success: false, result: { error: 'No such agent in this project' } }

  const name = data.display_name || 'Agent'
  const config = (data.configuration ?? {}) as { pipecat_agent_id?: string; workflow?: unknown; workflowMode?: unknown }
  const pipecat = data.agent_type === 'pipecat_agent' || !!config.pipecat_agent_id
  const base = `/${projectId}/agents/${agentId}`
  if (page === 'logs') return { success: true, result: { href: `${base}?tab=logs`, label: `${name} call logs` } }
  if (page === 'overview') return { success: true, result: { href: `${base}?tab=overview`, label: `${name} overview` } }
  if (page === 'campaign_logs') return { success: true, result: { href: `${base}?tab=campaign-logs`, label: `${name} campaign logs` } }
  if (page === 'phone_calls') return { success: true, result: { href: `${base}/phone-call-config`, label: `${name} phone calls` } }
  if (page === 'qa') return { success: true, result: { href: `${base}/qa`, label: `${name} QA` } }
  if (page === 'knowledge') {
    const href = pipecat ? `${base}/config/pipecat/knowledgebase` : `${base}/knowledge`
    return { success: true, result: { href, label: `${name} knowledge base` } }
  }
  let href = `${base}/config`
  if (pipecat) href = `${base}/config/pipecat`
  else if (data.agent_type === 'livekit') href = `${base}/config/livekit`
  else if (config.workflow || config.workflowMode) href = `${base}/workflow`
  return { success: true, result: { href, label: `${name} config` } }
}

async function runGetTalkLink(projectId: string, args: any) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_agents')
    .select('name, display_name')
    .eq('id', args.agent_id)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!data?.name) return { success: false, result: { error: 'No such agent in this project' } }
  return {
    success: true,
    result: {
      agent_id: args.agent_id,
      backend_name: `${data.name}_${String(args.agent_id).replaceAll('-', '_')}`,
      display_name: data.display_name,
    },
  }
}

// Phone numbers are Pype-owned inventory, not customer PII, so these tools' results skip the phone-masking backstop.
const RAW_PHONE_RESULT_TOOLS = new Set(['list_phone_numbers', 'search_plivo_numbers'])
const CONFIRMED_TOOLS = new Set(['create_agent', 'edit_agent', 'buy_plivo_number', 'attach_inbound_number'])
// An unassigned number: no alias, or one of the team's "free" markers. Anything else may be live for another client.
const isFreePoolAlias = (alias: string | null) => !alias || /free|not.?in.?use|unused/i.test(alias)
// ...and not already routed to some other inbound trunk (a number on another client's trunk is live).
const isFreeNumber = (alias: string | null, trunkId: string | null, sharedTrunkId: string) => isFreePoolAlias(alias) && (!trunkId || trunkId === sharedTrunkId)

async function phoneRowsFor(number: string) {
  const supabase = createServiceRoleClient()
  const d = digitsOnly(number)
  const { data } = await supabase.from('pype_voice_phone_numbers').select('project_id, trunk_id, assigned_agent_name').in('phone_number', [d, `+${d}`])
  return data ?? []
}

async function runListPhoneNumbers(projectId: string) {
  const supabase = createServiceRoleClient()
  const [owned, { trunkId: sharedTrunk }, { data: all }] = await Promise.all([listOwnedNumbers(), resolveInboundTrunk(), supabase.from('pype_voice_phone_numbers').select('phone_number, project_id, trunk_direction, assigned_agent_name, status')])
  const inDb = new Set((all ?? []).map((r: any) => digitsOnly(r.phone_number)))
  const attached = (all ?? []).filter((r: any) => r.project_id === projectId).map((r: any) => ({ number: r.phone_number, direction: r.trunk_direction, agent: r.assigned_agent_name, status: r.status }))
  const available = owned.filter((n) => !inDb.has(digitsOnly(n.number)) && isFreeNumber(n.alias, n.trunkId, sharedTrunk)).map((n) => ({ number: `+${digitsOnly(n.number)}`, type: n.type }))
  return { success: true, result: { attached_in_this_project: attached, available_to_attach: available, ...(available.length ? {} : { note: 'No unassigned numbers are left. Offer to search for a new one (ask country, default IN, and type) and buy it; buying needs a project owner/admin.' }) } }
}

async function runSearchPlivoNumbers(args: any) {
  const results = await searchAvailableNumbers({ country_iso: String(args.country_iso ?? ''), type: args.type, pattern: args.pattern })
  return { success: true, result: { options: results.map((n: any) => ({ ...n, number: `+${digitsOnly(n.number)}` })), note: 'Prices are USD per month. Nothing has been bought.' } }
}

/** Exact-number lookup (Plivo's search pattern is the number WITHOUT its country code). */
async function lookupAvailable(number: string, countryIso: string) {
  const d = digitsOnly(number)
  for (let cut = 1; cut <= 3; cut++) {
    const hit = (await searchAvailableNumbers({ country_iso: countryIso, pattern: d.slice(cut), limit: 20 }).catch(() => [])).find((n: any) => digitsOnly(n.number) === d)
    if (hit) return hit
  }
  return null
}

async function runBuyPlivoNumber(projectId: string, args: any) {
  const access = await getProjectRoleForApi(projectId)
  if (!access || !['owner', 'admin'].includes(String(access.role))) return { success: false, result: { error: 'Only project owners and admins can buy numbers' } }
  const number = digitsOnly(String(args.number ?? ''))
  const country = String(args.country_iso ?? '').toUpperCase()
  if (!number || !country) return { success: false, result: { error: 'number and country_iso are required' } }
  const offer = await lookupAvailable(number, country)
  if (!offer) return { success: false, result: { error: 'That number is no longer available. Search again.' } }
  const compliance = country === 'IN' ? process.env.PLIVO_COMPLIANCE_APPLICATION_ID || (await resolveInboundTrunk()).complianceApplicationId : undefined
  const res = await buyNumber(number, compliance)
  return { success: true, result: { bought: `+${number}`, monthly_rental_rate_usd: offer.monthly_rental_rate_usd, plivo_status: res?.status ?? 'ok', next: 'Attach it to an agent with attach_inbound_number.' } }
}

async function backendCall(method: 'POST' | 'PUT', path: string, body: unknown) {
  const base = getPypeApiBaseUrlForServer('classic')
  if (!base) throw new Error('Voice backend URL is not configured')
  const resp = await fetch(`${base}/api/calls/phone-numbers/${path}`, { method, headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) })
  const data: any = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data?.detail || data?.error || `Voice backend ${path} failed (HTTP ${resp.status})`)
  return data
}

async function runAttachInboundNumber(projectId: string, args: any) {
  const supabase = createServiceRoleClient()
  const number = `+${digitsOnly(String(args.number ?? ''))}`
  const agentId = String(args.agent_id ?? '')
  if (number.length < 9 || !agentId) return { success: false, result: { error: 'agent_id and number are required' } }
  if (!(await agentBelongsToProject(agentId, projectId))) return { success: false, result: { error: 'That agent is not in this project' } }

  const [{ data: agent }, { data: project }, owned, rows] = await Promise.all([
    supabase.from('pype_voice_agents').select('name, display_name').eq('id', agentId).maybeSingle(),
    supabase.from('pype_voice_projects').select('name').eq('id', projectId).maybeSingle(),
    getOwnedNumber(number),
    phoneRowsFor(number),
  ])
  if (!agent || !project) return { success: false, result: { error: 'Agent or project not found' } }
  if (!owned) return { success: false, result: { error: 'That number is not on the Plivo account. Buy it first.' } }
  if (rows.some((r: any) => r.project_id !== projectId)) return { success: false, result: { error: 'That number is already used by another project' } }
  const { trunkId } = await resolveInboundTrunk()
  const currentTrunk = /Zentrunk\/Trunk\/(\d+)/.exec(owned.application)?.[1] ?? null
  if (!rows.length && !isFreeNumber(owned.alias, currentTrunk, trunkId)) {
    const labelled = owned.alias ? ` (labelled "${owned.alias}")` : ' on another trunk'
    return { success: false, result: { error: `That number looks in use${labelled}. Pick an unassigned number.` } }
  }

  const alias = inboundAlias(project.name, number)
  const prevApp = owned.application.match(/(?:Zentrunk\/Trunk|Application)\/(\d+)/)?.[1] ?? null
  const hadTrunk = rows.some((r: any) => r.trunk_id)

  await attachNumberToTrunk(number, trunkId, alias)
  try {
    if (!hadTrunk) await backendCall('POST', 'create-inbound-trunk', { name: alias, numbers: [number], krisp_enabled: !!args.krisp_enabled })
    await backendCall('PUT', 'inbound-trunk/update', {
      phone_number: number,
      agent_name: `${agent.name}_${agentId.replaceAll('-', '_')}`,
      project_name: project.name,
      project_id: projectId,
      provider: 'plivo',
      room_prefix: 'call-',
      assigned_to: agent.display_name || agent.name,
      notes: `Attached by Pi (${alias})`,
    })
  } catch (err) {
    await restoreNumberApp(number, prevApp, owned.alias).catch(() => {})
    throw err
  }
  return { success: true, result: { attached: number, alias, agent: agent.display_name || agent.name, direction: 'inbound' } }
}

/** Server-computed facts shown on the Confirm card — never taken from the model's arguments. */
async function pendingPreview(projectId: string, name: string, args: any): Promise<Record<string, unknown> | undefined> {
  try {
    if (name === 'buy_plivo_number') {
      const offer = await lookupAvailable(String(args.number ?? ''), String(args.country_iso ?? '').toUpperCase())
      return offer
        ? { number: `+${digitsOnly(offer.number)}`, monthly_usd: offer.monthly_rental_rate_usd, setup_usd: offer.setup_rate_usd, city: offer.city, type: offer.type }
        : { unavailable: true }
    }
    if (name === 'attach_inbound_number') {
      const supabase = createServiceRoleClient()
      const [{ data: agent }, { data: project }] = await Promise.all([
        supabase.from('pype_voice_agents').select('display_name, name').eq('id', String(args.agent_id ?? '')).eq('project_id', projectId).maybeSingle(),
        supabase.from('pype_voice_projects').select('name').eq('id', projectId).maybeSingle(),
      ])
      if (!agent || !project) return { unavailable: true }
      return { number: `+${digitsOnly(String(args.number ?? ''))}`, agent: agent.display_name || agent.name, alias: inboundAlias(project.name, String(args.number ?? '')) }
    }
  } catch {}
  return undefined
}

type ToolRunner = (projectId: string, userId: string, args: any) => Promise<any>

const analyticsQuery: Parameters<typeof runCallVolumeTrend>[1] = (pid, a) => runQueryAnalytics(pid, a)

const READ_TOOLS: Record<string, ToolRunner> = {
  get_call_volume_trend: (pid, _uid, args) => runCallVolumeTrend(pid, analyticsQuery, args),
  get_completion_insights: (pid, _uid, args) => runCompletionInsights(pid, analyticsQuery, runListAnalyticsFields, args),
  list_agents: (pid) => runListAgents(pid),
  list_analytics_fields: (pid, _uid, args) => runListAnalyticsFields(pid, args),
  search_field_definitions: (pid, _uid, args) => runSearchFieldDefinitions(pid, args),
  query_analytics: (pid, _uid, args) => runQueryAnalytics(pid, args),
  get_talk_link: (pid, _uid, args) => runGetTalkLink(pid, args),
  open_page: (pid, _uid, args) => runOpenPage(pid, args),
  get_agent_details: (pid, _uid, args) => runGetAgentDetails(pid, args),
}

// everything here needs a non-viewer role; create/edit/buy/attach are additionally held behind a Confirm click (see POST)
const WRITE_TOOLS: Record<string, ToolRunner> = {
  open_custom_tool_form: (pid, _uid, args) => runOpenCustomToolForm(pid, args),
  create_agent: (pid, _uid, args) => runCreateAgent(pid, args),
  edit_agent: (pid, uid, args) => runEditAgent(pid, uid, args),
  list_phone_numbers: (pid) => runListPhoneNumbers(pid),
  search_plivo_numbers: (_pid, _uid, args) => runSearchPlivoNumbers(args),
  buy_plivo_number: (pid, _uid, args) => runBuyPlivoNumber(pid, args),
  attach_inbound_number: (pid, _uid, args) => runAttachInboundNumber(pid, args),
}

async function executeTool(projectId: string, userId: string, canWrite: boolean, name: string, args: any) {
  try {
    const read = READ_TOOLS[name]
    if (read) return await read(projectId, userId, args)
    if (!canWrite) return { success: false, result: { error: 'Viewer access — cannot create or edit agents' } }
    const write = WRITE_TOOLS[name]
    if (write) return await write(projectId, userId, args)
    return { success: false, result: { error: `Unknown tool "${name}"` } }
  } catch (err: any) {
    return { success: false, result: { error: err?.message ?? 'Tool execution failed' } }
  }
}

/** 4-6 words, no punctuation — a cheap one-shot call, not worth its own provider branch. */
async function generateTitle(client: OpenAI, model: string, firstMessage: string): Promise<string | null> {
  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 20,
      messages: [
        { role: 'system', content: 'Summarize the user\'s request in 3-6 words, title case, no punctuation, no quotes. Reply with only the title.' },
        { role: 'user', content: firstMessage.slice(0, 500) },
      ],
    })
    const title = resp.choices[0]?.message?.content?.trim()
    return title ? title.replaceAll(/^["']|["']$/g, '').slice(0, 120) : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, projectId, sessionId: incomingSessionId, resolveAction } = await request.json()
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!resolveAction && (!message || typeof message !== 'string')) return NextResponse.json({ error: 'message is required' }, { status: 400 })

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const access = await getProjectRoleForApi(projectId)
    if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
    const canWrite = access.role !== 'viewer'

    const supabase = createServiceRoleClient()

    // The Confirm/Cancel button's click, not a chat message — no LLM involved.
    // Only `toolCallId` comes from the client; the action name and arguments
    // are read back from what the server itself already stored for that
    // pending call, never trusted from the request, so a tampered client
    // request can't execute something other than what was actually shown to
    // the user.
    if (resolveAction) {
      const { toolCallId, decision } = resolveAction ?? {}
      if (!incomingSessionId || !toolCallId || (decision !== 'confirm' && decision !== 'cancel')) {
        return NextResponse.json({ error: 'Invalid confirmation request' }, { status: 400 })
      }
      const { data: existing, error } = await supabase.from('pi_sessions').select('project_id, user_id, messages').eq('id', incomingSessionId).maybeSingle()
      if (error || !existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (existing.project_id !== projectId || existing.user_id !== userId) {
        return NextResponse.json({ error: 'Not your session' }, { status: 403 })
      }
      const sessionHistory = (existing.messages as StoredMessage[]) ?? []
      const msgIndex = sessionHistory.findIndex((m) => m.toolCalls?.some((t) => t.id === toolCallId))
      const tcIndex = msgIndex === -1 ? -1 : sessionHistory[msgIndex].toolCalls!.findIndex((t) => t.id === toolCallId)
      if (msgIndex === -1 || tcIndex === -1) return NextResponse.json({ error: 'That action is no longer in this chat' }, { status: 404 })
      const storedCall = sessionHistory[msgIndex].toolCalls![tcIndex]
      if (!storedCall.result?.__pending) return NextResponse.json({ error: 'That action was already resolved' }, { status: 409 })

      const outcome = decision === 'cancel'
        ? { result: { __cancelled: true }, success: true }
        : await executeTool(projectId, userId, canWrite, storedCall.name, storedCall.arguments)

      const updatedHistory = sessionHistory.map((m, i) =>
        i === msgIndex ? { ...m, toolCalls: m.toolCalls!.map((t, j) => (j === tcIndex ? { ...t, ...outcome } : t)) } : m
      )
      await supabase.from('pi_sessions').update({ messages: updatedHistory, updated_at: new Date().toISOString() }).eq('id', incomingSessionId)
      return NextResponse.json({ ...outcome, toolCallId })
    }

    let sessionId = incomingSessionId as string | undefined
    let history: StoredMessage[] = []

    if (sessionId) {
      const { data: existing, error } = await supabase.from('pi_sessions').select('project_id, user_id, messages').eq('id', sessionId).maybeSingle()
      if (error || !existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      if (existing.project_id !== projectId || existing.user_id !== userId) {
        return NextResponse.json({ error: 'Not your session' }, { status: 403 })
      }
      history = (existing.messages as StoredMessage[]) ?? []
    } else {
      const user = await currentUser()
      const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? 'unknown'
      const { data: created, error } = await supabase
        .from('pi_sessions')
        .insert({ project_id: projectId, user_id: userId, user_email: userEmail, title: 'New chat', messages: [] })
        .select('id')
        .single()
      if (error || !created) return NextResponse.json({ error: 'Could not create session' }, { status: 500 })
      sessionId = created.id
    }

    const isFirstTurn = history.length === 0

    let client: OpenAI
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      })
    } else if (process.env.OPENAI_API_KEY) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    } else {
      return NextResponse.json({ error: 'No LLM provider configured' }, { status: 500 })
    }
    const resolvedModel = process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4o-mini'
    const tools = toolSchemas(canWrite)

    // Prompting alone wasn't reliable here (confirmed in practice: Pi repeated
    // a "field not found" conclusion verbatim across several follow-ups
    // without ever re-searching) — so this nudges deterministically instead of
    // hoping static instructions get followed. Soft hint, not a forced tool
    // call: tool_choice stays 'auto', this just raises the odds in the exact
    // situation that kept failing.
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')
    const saidFieldNotFound = !!lastAssistant && /does not have a (disposition|field)|do not see any disposition/i.test(lastAssistant.content ?? '')

    const conversationMessages: any[] = [
      { role: 'system', content: systemPrompt(projectId, canWrite, history) },
      ...toWireMessages(history),
      { role: 'user', content: message },
      ...(saidFieldNotFound
        ? [{ role: 'system', content: 'Your previous reply concluded a field/disposition could not be found. If this message is still about that same term (even rephrased, mistranscribed, or repeated), two things are both suspect, not just the term: (1) call search_field_definitions with the term fresh — do not restate the earlier "not found" conclusion from memory; (2) re-confirm which agent_id you actually used last time matches what the user means now — a wrong pinned agent produces exactly this symptom (a real term reported as missing because the wrong agent was checked). If unsure, call list_agents and ask, or check the term against the agent whose name the user actually said. Never answer this turn by combining this term\'s "not found" result with a different agent\'s numbers from earlier in the thread.' }]
        : []),
    ]
    // What actually gets persisted back to the session at the end — the UI
    // shape, not the OpenAI wire shape, so a resumed session needs no
    // reverse-translation on load.
    const userTurn: StoredMessage[] = [...history, { role: 'user', content: message }]

    const saveSession = async (messages: StoredMessage[], title?: string) => {
      const { error } = await supabase
        .from('pi_sessions')
        .update({ messages, updated_at: new Date().toISOString(), ...(title ? { title } : {}) })
        .eq('id', sessionId)
      if (error) console.error('[pi/chat] save failed', error.message)
      return !error
    }

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(sseChunk(JSON.stringify({ sessionId })))
        let assistantText = ''
        const assistantToolCalls: StoredToolCall[] = []
        let savedReply = false
        let lastUsage: { prompt_tokens: number; completion_tokens: number } | null = null
        try {
          await saveSession(userTurn)
          let continueLoop = true
          let iterations = 0

          while (continueLoop && iterations < MAX_TOOL_ITERATIONS) {
            iterations++

            const stream = await client.chat.completions.create({
              model: resolvedModel,
              messages: conversationMessages,
              stream: true,
              stream_options: { include_usage: true },
              temperature: 0.2,
              tools,
              tool_choice: 'auto',
            })

            const pendingCalls: Record<number, { id: string; name: string; args: string }> = {}
            let textContent = ''
            let finishReason = ''

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta
              finishReason = chunk.choices[0]?.finish_reason ?? finishReason

              if (delta?.content) {
                textContent += delta.content
                controller.enqueue(sseChunk(JSON.stringify({ text: delta.content })))
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!pendingCalls[tc.index]) pendingCalls[tc.index] = { id: tc.id ?? '', name: '', args: '' }
                  if (tc.id) pendingCalls[tc.index].id = tc.id
                  if (tc.function?.name) pendingCalls[tc.index].name += tc.function.name
                  if (tc.function?.arguments) pendingCalls[tc.index].args += tc.function.arguments
                }
              }

              // the usage chunk (stream_options.include_usage) arrives last, with no choices —
              // its prompt_tokens already covers this whole turn's history, so later iterations
              // (tool-calling round trips) naturally overwrite this with the bigger number
              if (chunk.usage) lastUsage = { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens }
            }

            assistantText += textContent

            if (finishReason === 'tool_calls') {
              const toolCallsForMsg = Object.values(pendingCalls).map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.args },
              }))
              conversationMessages.push({ role: 'assistant', content: textContent || null, tool_calls: toolCallsForMsg })

              for (const tc of Object.values(pendingCalls)) {
                let parsedArgs: any = {}
                try { parsedArgs = JSON.parse(tc.args) } catch {}

                controller.enqueue(sseChunk(JSON.stringify({ toolCall: { id: tc.id, name: tc.name, arguments: parsedArgs } })))

                const start = Date.now()
                // create_agent/edit_agent never execute here — holding them until an
                // actual button click (handled below, in the confirmAction branch) is
                // a code guarantee that nothing writes without it, instead of relying
                // on the model to correctly sequence "ask, wait, then call the tool
                // next turn" — a sequence prompting alone didn't reliably hold to.
                const needsConfirmation = CONFIRMED_TOOLS.has(tc.name) && canWrite
                const { result, success } = needsConfirmation
                  ? { result: { __pending: true, action: tc.name, args: parsedArgs, preview: await pendingPreview(projectId, tc.name, parsedArgs) }, success: true }
                  : await executeTool(projectId, userId, canWrite, tc.name, parsedArgs)
                const duration_ms = Date.now() - start

                controller.enqueue(sseChunk(JSON.stringify({ toolResult: { id: tc.id, result, success, duration_ms } })))

                conversationMessages.push({ role: 'tool', tool_call_id: tc.id, content: truncateForContext(RAW_PHONE_RESULT_TOOLS.has(tc.name) ? result : redactPhoneLikeStrings(result), toolResultLimit(tc.name)) })
                assistantToolCalls.push({ id: tc.id, name: tc.name, arguments: parsedArgs, result, success })
              }
            } else {
              continueLoop = false
            }
          }

          const reply: StoredMessage = {
            role: 'assistant',
            content: assistantText,
            toolCalls: assistantToolCalls.length ? assistantToolCalls : undefined,
          }
          let title: string | undefined
          if (isFirstTurn) {
            title = (await generateTitle(client, resolvedModel, message)) ?? undefined
            if (title) controller.enqueue(sseChunk(JSON.stringify({ title })))
          }
          savedReply = await saveSession([...userTurn, reply], title)

          if (lastUsage) {
            const used = lastUsage.prompt_tokens + lastUsage.completion_tokens
            controller.enqueue(sseChunk(JSON.stringify({ usage: { used, limit: contextWindowFor(resolvedModel) } })))
          }

          controller.enqueue(sseChunk('[DONE]'))
        } catch (err) {
          const partial: StoredMessage[] = assistantText || assistantToolCalls.length
            ? [...userTurn, { role: 'assistant', content: assistantText, toolCalls: assistantToolCalls.length ? assistantToolCalls : undefined }]
            : userTurn
          if (!savedReply) await saveSession(partial)
          controller.enqueue(sseChunk(JSON.stringify({ error: String(err) })))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: any) {
    console.error('[pi/chat]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
