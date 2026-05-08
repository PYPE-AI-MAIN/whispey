import { NextRequest, NextResponse } from 'next/server'
import OpenAI, { AzureOpenAI } from 'openai'

export const runtime = 'nodejs'

const enc = new TextEncoder()
const MAX_TOOL_ITERATIONS = 8

function sseChunk(data: string) {
  return enc.encode(`data: ${data}\n\n`)
}

function sanitizeFunctionName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
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

async function executeTool(tool: any, args: any): Promise<{ result: any; success: boolean }> {
  // Non-HTTP tools (transfer_call, knowledge_search) can't be executed in forge
  if (!tool || !tool.endpoint || tool.type === 'transfer_call' || tool.type === 'knowledge_search') {
    return {
      result: { _forge_note: `Tool "${tool?.name ?? 'unknown'}" invoked (no HTTP execution for this type in Forge)` },
      success: true,
    }
  }

  try {
    let body = tool.body ?? '{}'
    for (const [key, value] of Object.entries(args)) {
      body = body.replace(new RegExp(`__${key}__`, 'g'), String(value))
    }
    const res = await fetch(tool.endpoint, {
      method: tool.method ?? 'POST',
      headers: tool.headers ?? {},
      ...(tool.method !== 'GET' ? { body } : {}),
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
    const { messages, systemPrompt, model, temperature, provider, tools } = await request.json()

    let client: OpenAI
    if (provider === 'azure_openai') {
      if (!process.env.AZURE_OPENAI_API_KEY) return NextResponse.json({ error: 'AZURE_OPENAI_API_KEY not configured' }, { status: 500 })
      if (!process.env.AZURE_OPENAI_ENDPOINT) return NextResponse.json({ error: 'AZURE_OPENAI_ENDPOINT not configured' }, { status: 500 })
      client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      })
    } else {
      if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }

    const resolvedModel = model || (provider === 'azure_openai' ? process.env.AZURE_DEPLOYMENT_NAME : undefined) || 'gpt-4o-mini'
    const openaiTools = buildOpenAITools(tools ?? [])
    const hasTools = openaiTools.length > 0

    // Build mutable conversation messages for the tool-calling loop
    const conversationMessages: any[] = [
      ...(systemPrompt?.trim() ? [{ role: 'system', content: systemPrompt }] : []),
      ...(messages ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
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
              temperature: temperature ?? 0.7,
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
