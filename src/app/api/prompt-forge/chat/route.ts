import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type OpenAI from 'openai'
import { agentInProject, requireForgeUser } from '@/server/promptForge/access'
import { resolveForgeLlm } from '@/server/promptForge/llm'
import { samplingFor } from '@/lib/piModels'

export const runtime = 'nodejs'

const enc = new TextEncoder()
const MAX_TOOL_ITERATIONS = 8

function sseChunk(data: string) {
  return enc.encode(`data: ${data}\n\n`)
}

function sanitizeFunctionName(name: string): string {
  return name.replaceAll(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

function buildOpenAITools(tools: any[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools
    .filter(t => t.name)
    .map(t => ({
      type: 'function' as const,
      function: {
        name: sanitizeFunctionName(t.name),
        description: t.description || `Tool: ${t.name}`,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            (t.parameters ?? []).map((p: any) => [p.name, {
              type: p.type || 'string',
              description: p.description || p.name,
            }])
          ),
          required: (t.parameters ?? []).filter((p: any) => p.required).map((p: any) => p.name),
        },
      },
    }))
}

// Tool calls make real HTTP requests from this server, so the URL a tool names
// must be a public address — never localhost, the cloud metadata service or a
// private network this server can reach.
const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return PRIVATE_V4.some((r) => r.test(ip))
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

async function publicToolUrl(raw: string): Promise<URL | null> {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replaceAll(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return null
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) return null
  } catch {
    return null
  }
  return url
}

const TOOL_TIMEOUT_MS = 15_000

async function executeTool(tool: any, args: any): Promise<{ result: any; success: boolean }> {
  // A mock set in the Tools panel: answer with it instead of calling the endpoint,
  // so a flow ("no slots", an error) can be tested without touching real systems.
  if (tool?.mock?.enabled) {
    const raw = String(tool.mock.response ?? '')
    let result: any = raw
    try { result = JSON.parse(raw) } catch { /* plain text is fine */ }
    return { result, success: tool.mock.success !== false }
  }

  // Non-HTTP tools (transfer_call, knowledge_search) can't be executed in forge
  if (!tool || !tool.endpoint || tool.type === 'transfer_call' || tool.type === 'knowledge_search') {
    return {
      result: { _forge_note: `Tool "${tool?.name ?? 'unknown'}" invoked (no HTTP execution for this type in Forge)` },
      success: true,
    }
  }

  const url = await publicToolUrl(String(tool.endpoint))
  if (!url) {
    return { result: { error: `Tool "${tool.name}" points at an address Prompt Forge won't call (it must be a public http(s) URL)` }, success: false }
  }

  try {
    let body = tool.body ?? '{}'
    for (const [key, value] of Object.entries(args)) {
      body = body.replace(new RegExp(`__${key}__`, 'g'), String(value))
    }
    const res = await fetch(url, {
      method: tool.method ?? 'POST',
      headers: tool.headers ?? {},
      ...(tool.method !== 'GET' ? { body } : {}),
      // a redirect could lead to an address the check above would refuse
      redirect: 'error',
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
    })
    const text = await res.text()
    let result: any
    try { result = JSON.parse(text) } catch { result = text }
    return { result, success: res.ok }
  } catch (err: any) {
    return { result: { error: err.message }, success: false }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages, systemPrompt, model, temperature, provider, tools, projectId, agentId, generateGreeting } = await request.json()

    const access = await requireForgeUser(projectId)
    if ('response' in access) return access.response
    if (!agentId || !(await agentInProject(agentId, projectId))) {
      return NextResponse.json({ error: 'No such agent in this project' }, { status: 403 })
    }

    const llm = resolveForgeLlm(provider, model)
    if ('error' in llm) return NextResponse.json({ error: llm.error }, { status: 400 })
    const { client, model: resolvedModel } = llm
    const openaiTools = buildOpenAITools(tools ?? [])
    const hasTools = openaiTools.length > 0

    // Build mutable conversation messages for the tool-calling loop
    const conversationMessages: any[] = [
      ...(systemPrompt?.trim() ? [{ role: 'system', content: systemPrompt }] : []),
      ...(messages ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      // Greeting mode "generated": nothing has been said yet, so ask the model
      // for the opening message its prompt calls for. Text only — this is a chat.
      ...(generateGreeting ? [{ role: 'user', content: '[The conversation is starting. Send your opening message now.]' }] : []),
    ]

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let continueLoop = true
          let iterations = 0

          while (continueLoop && iterations < MAX_TOOL_ITERATIONS) {
            iterations++

            const stream = await client.chat.completions.create({
              model: resolvedModel,
              messages: conversationMessages,
              stream: true,
              // reasoning models (GPT-5, o-series) reject a custom temperature
              ...samplingFor(resolvedModel, temperature ?? 0.7),
              ...(hasTools ? { tools: openaiTools, tool_choice: 'auto' } : {}),
            })

            // Accumulate streaming response
            const pendingCalls: Record<number, { id: string; name: string; args: string }> = {}
            let textContent = ''
            let finishReason = ''

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta
              finishReason = chunk.choices[0]?.finish_reason ?? finishReason

              // Stream text tokens immediately
              if (delta?.content) {
                textContent += delta.content
                controller.enqueue(sseChunk(JSON.stringify({ text: delta.content })))
              }

              // Accumulate tool call fragments
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!pendingCalls[tc.index]) {
                    pendingCalls[tc.index] = { id: tc.id ?? '', name: '', args: '' }
                  }
                  if (tc.id) pendingCalls[tc.index].id = tc.id
                  if (tc.function?.name) pendingCalls[tc.index].name += tc.function.name
                  if (tc.function?.arguments) pendingCalls[tc.index].args += tc.function.arguments
                }
              }
            }

            if (finishReason === 'tool_calls') {
              // Add assistant message with tool calls to history
              const toolCallsForMsg = Object.values(pendingCalls).map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.args },
              }))
              conversationMessages.push({
                role: 'assistant',
                content: textContent || null,
                tool_calls: toolCallsForMsg,
              })

              // Execute each tool and stream events
              for (const tc of Object.values(pendingCalls)) {
                let parsedArgs: any = {}
                try { parsedArgs = JSON.parse(tc.args) } catch {}

                // Notify frontend: tool is being called
                controller.enqueue(sseChunk(JSON.stringify({
                  toolCall: { id: tc.id, name: tc.name, arguments: parsedArgs },
                })))

                const toolDef = (tools ?? []).find((t: any) =>
                  sanitizeFunctionName(t.name) === sanitizeFunctionName(tc.name)
                )
                const start = Date.now()
                const { result, success } = await executeTool(toolDef, parsedArgs)
                const duration_ms = Date.now() - start

                // Notify frontend: tool result arrived
                controller.enqueue(sseChunk(JSON.stringify({
                  toolResult: { id: tc.id, result, success, duration_ms },
                })))

                // Add tool result to conversation
                conversationMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                })
              }
              // Loop continues — model will respond to tool results
            } else {
              continueLoop = false
            }
          }

          controller.enqueue(sseChunk('[DONE]'))
        } catch (err) {
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
    console.error('[prompt-forge/chat]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
