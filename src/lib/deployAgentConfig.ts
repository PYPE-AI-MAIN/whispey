import { serviceAuthHeaders } from './serviceToken'
import {
  getPypeApiBaseUrlForServer,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
  PYPE_API_DEPLOY_TIMEOUT_MS,
} from './pypeApiFetch'

export type DeployAgentConfigResult =
  | { ok: true; status: number; data: any; verifiedAfterError?: boolean }
  | { ok: false; status: number; errorText: string; unreachable?: boolean }

/**
 * Re-read the deployed config to check whether the update actually landed.
 * Returns the config when its voice_id matches, null otherwise.
 */
async function verifyConfigApplied(apiUrl: string, expectedVoiceId: string): Promise<Record<string, any> | null> {
  // The killed backend worker can finish writing the config well after nginx
  // returns 502, so keep checking for ~30s before declaring failure.
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3000))
    try {
      const verifyRes = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
        signal: pypeApiAbortSignal(),
      })
      if (!verifyRes.ok) continue
      const cfg = await verifyRes.json()
      if (cfg?.agent?.assistant?.[0]?.tts?.voice_id === expectedVoiceId) return cfg
    } catch { /* retry */ }
  }
  return null
}

/**
 * Deploy an agent config to the voice backend. Shared by save-and-deploy and
 * update-voice so both behave identically.
 *
 * When the agent worker is running, the backend hot-reloads it (20-30s) and
 * its API worker often dies AFTER the config is written (nginx 502/504). On
 * those statuses we re-read the config and treat a matching voice_id as
 * success instead of reporting a false failure.
 */
export async function deployAgentConfig(
  agentName: string,
  agentConfigBody: any
): Promise<DeployAgentConfigResult> {
  const baseUrl = getPypeApiBaseUrlForServer()
  if (!baseUrl) {
    console.error('❌ [deployAgentConfig] No voice backend URL configured. Set PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL.')
    return {
      ok: false,
      status: 503,
      errorText: 'Voice backend URL is not configured. Set PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL.',
      unreachable: true,
    }
  }
  const apiUrl = `${baseUrl}/agent_config/${encodeURIComponent(agentName)}`

  let response: Response
  const fetchStart = Date.now()
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
      body: JSON.stringify(agentConfigBody),
      signal: pypeApiAbortSignal(PYPE_API_DEPLOY_TIMEOUT_MS),
    })
  } catch (err) {
    const e = err as any
    console.error('❌ [deployAgentConfig] Fetch threw after', Date.now() - fetchStart, 'ms:', {
      name: e?.name,
      message: e?.message,
      causeCode: e?.cause?.code,
      url: apiUrl,
    })
    if (isPypeUpstreamUnreachable(err)) {
      return {
        ok: false,
        status: 503,
        errorText: 'Voice backend unreachable. The agent config could not be deployed because the voice backend did not respond.',
        unreachable: true,
      }
    }
    throw err
  }

  if (response.ok) {
    return { ok: true, status: response.status, data: await response.json().catch(() => ({})) }
  }

  const errorText = await response.text()
  console.error('❌ [deployAgentConfig] Voice backend returned error:', {
    status: response.status,
    body: errorText,
    url: apiUrl,
  })

  const expectedVoiceId = agentConfigBody?.agent?.assistant?.[0]?.tts?.voice_id
  if ((response.status === 502 || response.status === 504) && expectedVoiceId) {
    const cfg = await verifyConfigApplied(apiUrl, expectedVoiceId)
    if (cfg) {
      console.warn(`⚠️ [deployAgentConfig] Backend returned ${response.status} but the config update was applied — treating as success`)
      return { ok: true, status: 200, data: cfg, verifiedAfterError: true }
    }
  }

  return { ok: false, status: response.status, errorText }
}
