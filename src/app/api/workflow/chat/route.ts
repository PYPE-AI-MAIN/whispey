import { NextRequest } from 'next/server'
import OpenAI, { AzureOpenAI } from 'openai'

export const runtime = 'nodejs'

const enc = new TextEncoder()
function sse(data: string) { return enc.encode(`data: ${data}\n\n`) }

const SYSTEM_PROMPT = `You are a workflow builder assistant for a voice-agent platform called Whispey.

The user will ask you to create or modify a workflow (a JSON object). You MUST return a COMPLETE valid workflow JSON in a fenced \`\`\`json block in EVERY response. Even for small edits — return the full workflow, not a partial patch. The canvas will replace the current workflow with your output.

After the JSON block, add 1-2 sentences explaining what you did.

## Workflow schema (schemaVersion 1.0)

\`\`\`
{
  schemaVersion: "1.0",
  metadata: { name: string, description?: string },
  agent: {
    globalPrompt: string,          // persona & rules that apply across every node
    llm: { name: "openai"|"google"|"groq"|"cerebras"|"aws"|"azure", model?: string, temperature?: number },
    stt: { name: "deepgram"|"openai"|"sarvam"|"smallestai", model?: string, language?: string },
    tts: { name: "elevenlabs"|"sarvam"|"google"|"cartesia"|"openai"|"aws", voice_id?: string, model?: string, language?: string, voice_settings?: object },
    vad?: { name: "silero", min_silence_duration?: number },
  },
  transports: {
    web?: { enabled: boolean },
    telephony?: { enabled: boolean }
  },
  variables: [{ key: string, type: "string"|"number"|"boolean"|"object", default?: any, description?: string }],
  start: "<nodeId>",              // id of the first node
  nodes: [ ...typed nodes... ],
  edges: [ { id, source, target, kind: "always"|"condition"|"logic"|"fallback", condition?: string, expression?: string, label?: string } ]
}
\`\`\`

## Node types

- **conversation**: { id, type:"conversation", name?, position:{x,y}, prompt?, staticText?, skipUserResponse?:bool, blockInterruptions?:bool, model?:llmConfig, voice?:ttsConfig }
  The core LLM node. Set a prompt for dynamic speech. Use staticText to skip the LLM and play fixed text. skipUserResponse=true means the agent speaks and immediately transitions (no waiting for user).

- **extract_variable**: { id, type:"extract_variable", name?, position, prompt?, extractions:[{variable:string, type:"string"|"number"|"boolean"|"object", description?:string}] }
  Ask the user for information and save it into named variables. Variables are referenced as {{variable_name}} in prompts/URLs.

- **logic_split**: { id, type:"logic_split", name?, position }
  Deterministic branching — no prompt, no LLM. The branching logic is defined by outgoing edges of kind "logic" with expressions like "budget > 5000".

- **function**: { id, type:"function", name?, position, method:"GET"|"POST"|"PUT"|"PATCH"|"DELETE", url:string, headers?:{}, body?:any, waitMessage?:string, saveAs?:string, timeout?:number }
  HTTP API call. Use {{variable}} in url/headers/body. waitMessage is spoken while the call runs. saveAs stores the response in a variable.

- **knowledge**: { id, type:"knowledge", name?, position, query?:string, topK?:number, knowledgeBase?:string, saveAs?:string }
  RAG lookup against the agent's knowledge base. saveAs stores the retrieved context in a variable.

- **call_transfer**: { id, type:"call_transfer", name?, position, transferTo:string, mode:"cold"|"warm", message?:string }
  Transfer the call to a phone number. Requires telephony transport enabled.

- **press_digit**: { id, type:"press_digit", name?, position, mode:"send"|"collect", digits?:string, numDigits?:number, timeout?:number, saveAs?:string }
  Send or collect DTMF tones. Requires telephony transport.

- **sms**: { id, type:"sms", name?, position, to?:string, message:string, provider?:"plivo"|"twilio"|"webhook" }
  Send an SMS. Requires telephony transport.

- **subagent**: { id, type:"subagent", name?, position, prompt:string, model?:llmConfig, voice?:ttsConfig }
  A node with its own persona/model/voice — useful for a different character or specialist.

- **mcp**: { id, type:"mcp", name?, position, server:string, tool:string, args?:{}, saveAs?:string }
  Call a tool on an MCP server.

- **code**: { id, type:"code", name?, position, language:"python"|"javascript", source:string, saveAs?:string }
  Run a sandboxed code snippet.

- **ending**: { id, type:"ending", name?, position, message?:string }
  End the call with an optional farewell message.

- **note**: { id, type:"note", name?, position, text:string }
  Canvas-only annotation, ignored at runtime.

## Edge kinds

- **always**: unconditional transition (the default for scripted flows)
- **condition**: natural-language gate the LLM evaluates (e.g. "the caller wants to cancel"). Only valid on conversation / extract_variable / subagent source nodes.
- **logic**: variable expression (e.g. "budget > 5000"). Used with logic_split source nodes.
- **fallback**: default branch when nothing else matched.

## Layout rules

- Position nodes top-to-bottom or left-to-right, ~160px apart vertically
- Give every node a descriptive name
- Always assign unique ids (use short kebab-case like "greeting", "get-name", "route-budget")
- Always set a "start" id pointing to the first node
- Default TTS voice_id: "EXAVITQu4vr4xnSDxMaL" (ElevenLabs)
- Default transports: { web: { enabled: true } }
- When the user says "call transfer", "DTMF", "SMS" or "telephony", also enable the telephony transport

## Important

- Return COMPLETE workflow JSON every time — the canvas replaces the entire workflow
- Use the CURRENT workflow (provided in the conversation) as the base for edits
- When the user asks to "add a node", keep all existing nodes and edges intact
- Generate valid edge ids (e.g. "e1", "e2", etc.) — they must be unique
- Wrap variables in {{double_braces}} in prompts and URLs`

function getClient(): { client: OpenAI; model: string } {
  const azureKey = process.env.AZURE_OPENAI_API_KEY
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
  if (azureKey && azureEndpoint) {
    return {
      client: new AzureOpenAI({
        apiKey: azureKey,
        endpoint: azureEndpoint,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
        deployment: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini-2',
      }),
      model: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini-2',
    }
  }
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    }
  }
  throw new Error('No LLM API key configured (set AZURE_OPENAI_API_KEY or OPENAI_API_KEY)')
}

export async function POST(req: NextRequest) {
  const { messages, workflow } = await req.json()
  if (!messages?.length) {
    return Response.json({ error: 'No messages' }, { status: 400 })
  }

  let client: OpenAI
  let model: string
  try {
    const c = getClient()
    client = c.client
    model = c.model
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }

  const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  if (workflow) {
    systemMessages.push({
      role: 'system',
      content: `The user's CURRENT workflow is:\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\`\nUse this as the base for any edits. Return the complete modified workflow.`,
    })
  }

  const stream = await client.chat.completions.create({
    model,
    messages: [...systemMessages, ...messages],
    stream: true,
    temperature: 0.3,
    max_tokens: 16000,
  })

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  ;(async () => {
    try {
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content
        if (content) {
          await writer.write(sse(JSON.stringify({ content })))
        }
      }
      await writer.write(sse('[DONE]'))
    } catch (err: any) {
      await writer.write(sse(JSON.stringify({ error: err.message })))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
