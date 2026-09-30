import { mintServiceToken } from '@/lib/serviceToken';
// app/api/agents/start-session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { resolveApiBaseUrlForAgent } from '@/lib/getProjectRoleForApi'

interface StartSessionRequest {
  user_identity: string
  user_name: string
  agent_name: string
  deploymentTarget?: string
  /** Per-call {{variable}} overrides (name -> value). */
  variables?: Record<string, unknown>
}

interface StartSessionResponse {
  room: string
  user_token: string
  agent_name: string
  dispatch_cli_output: string
}

const MAX_VARIABLES = 50
const MAX_VARIABLE_NAME = 64
const MAX_VARIABLE_VALUE = 1000

function blank(value: string | undefined): boolean {
  return !value || !value.trim()
}

/** Which required field is missing, if any. */
function missingField(body: StartSessionRequest): string | null {
  if (blank(body.agent_name)) return 'agent_name'
  if (blank(body.user_identity)) return 'user_identity'
  return null
}

// Only plain non-empty string values, capped — this rides along in LiveKit
// dispatch metadata, so it shouldn't carry arbitrary client-supplied blobs.
function sanitizeVariables(raw: unknown): Record<string, string> {
  const variables: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return variables
  for (const [name, value] of Object.entries(raw).slice(0, MAX_VARIABLES)) {
    const usable = typeof value === 'string' && value.trim() && value.length <= MAX_VARIABLE_VALUE
    if (usable && name.length <= MAX_VARIABLE_NAME) variables[name] = value
  }
  return variables
}

// Backend errors arrive as JSON ({detail: {message}} / {detail} / {message}) or plain text.
function errorMessageFrom(errorText: string): string {
  const fallback = 'Failed to start web session'
  try {
    const errJson = JSON.parse(errorText)
    const msg = errJson?.detail?.message ?? errJson?.detail ?? errJson?.message
    if (typeof msg === 'string' && msg) return msg
    if (msg && typeof msg === 'object' && msg.message) return msg.message
    return fallback
  } catch {
    return errorText && errorText !== 'Unknown error' ? errorText : fallback
  }
}

async function postStartSession(apiBaseUrl: string, payload: Record<string, unknown>): Promise<Response> {
  const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || 'pype-api-v1'
  const send = () =>
    fetch(`${apiBaseUrl}/start_web_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': 'Bearer ' + mintServiceToken(),
      },
      body: JSON.stringify(payload),
    })

  const response = await send()
  // Retry once on 503 (transient unavailability)
  if (response.status !== 503) return response
  await new Promise((r) => setTimeout(r, 2000))
  return send()
}

async function backendFailure(response: Response): Promise<NextResponse> {
  const errorText = await response.text().catch(() => 'Unknown error')
  console.error(`Backend API error: ${response.status} - ${errorText}`)
  return NextResponse.json(
    { error: errorMessageFrom(errorText), details: errorText },
    { status: response.status }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body: StartSessionRequest = await request.json()

    const missing = missingField(body)
    if (missing) {
      return NextResponse.json({ error: `${missing} is required` }, { status: 400 })
    }

    // Which backend this agent actually lives on — resolved from its own
    // persisted record, not trusted from the client.
    const urlResult = await resolveApiBaseUrlForAgent(body.agent_name)
    if ('errorResponse' in urlResult) return urlResult.errorResponse

    const variables = sanitizeVariables(body.variables)
    const response = await postStartSession(urlResult.apiUrl, {
      user_identity: body.user_identity,
      user_name: body.user_name,
      agent_name: body.agent_name,
      ...(Object.keys(variables).length > 0 && { variables }),
    })

    if (!response.ok) return await backendFailure(response)

    const apiData: StartSessionResponse = await response.json()

    // Transform to include LiveKit URL and backward compatibility fields
    return NextResponse.json({
      room: apiData.room,
      user_token: apiData.user_token,
      agent_name: apiData.agent_name,
      dispatch_cli_output: apiData.dispatch_cli_output,

      // Backward compatibility
      room_name: apiData.room,
      token: apiData.user_token,
      participant_identity: body.user_identity,

      // Add LiveKit server URL
      url: process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL,
    })
  } catch (error) {
    console.error('Error in start-session API route:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
