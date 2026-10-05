// Plivo number search / buy / attach-to-inbound-trunk, used by Pi's phone-number tools.
// Numbers attach to the same inbound Zentrunk trunk as the "Agent Command Center 17" number
// (its origination URI points at LiveKit SIP) — resolved by alias at runtime so the trunk id isn't hardcoded.

const INBOUND_TRUNK_REFERENCE_ALIAS = 'Agent Command Center 17'

function creds() {
  const id = process.env.PLIVO_AUTH_ID
  const token = process.env.PLIVO_AUTH_TOKEN
  if (!id || !token) throw new Error('PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN are not configured')
  return { id, token }
}

async function plivo(path: string, init: { method?: 'GET' | 'POST'; query?: Record<string, string | number | undefined>; body?: Record<string, unknown> } = {}) {
  const { id, token } = creds()
  const url = new URL(`https://api.plivo.com/v1/Account/${id}/${path}`)
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${token}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any)?.error || (data as any)?.message || `Plivo request failed (HTTP ${res.status})`)
  return data as any
}

export const digitsOnly = (n: string) => n.replace(/\D/g, '')

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'

/** `<project-alias>-inbound-<last4>` — used for the Plivo number alias and the LiveKit trunk name. */
export const inboundAlias = (projectName: string, number: string) => `${slugify(projectName)}-inbound-${digitsOnly(number).slice(-4)}`

export async function resolveInboundTrunk(): Promise<{ trunkId: string; complianceApplicationId?: string }> {
  const data = await plivo('Number/', { query: { alias: INBOUND_TRUNK_REFERENCE_ALIAS } })
  const ref = data.objects?.[0]
  const trunkId = String(ref?.application ?? '').match(/Zentrunk\/Trunk\/(\d+)/)?.[1]
  if (!trunkId) throw new Error(`Could not find the "${INBOUND_TRUNK_REFERENCE_ALIAS}" number on Plivo to copy its inbound trunk from`)
  return { trunkId, complianceApplicationId: ref?.compliance_application_id || undefined }
}

/** Every number on the Plivo account (Plivo pages at 20). */
export async function listOwnedNumbers() {
  const out: { number: string; alias: string | null; trunkId: string | null; appId: string | null; type: string | null; monthly_rental_rate: string | null }[] = []
  for (let offset = 0; offset < 400; offset += 20) {
    const data = await plivo('Number/', { query: { limit: 20, offset } })
    for (const n of data.objects ?? []) {
      const app = String(n.application ?? '')
      out.push({
        number: n.number,
        alias: n.alias ?? null,
        trunkId: app.match(/Zentrunk\/Trunk\/(\d+)/)?.[1] ?? null,
        appId: app.match(/Application\/(\d+)/)?.[1] ?? null,
        type: n.type ?? n.number_type ?? null,
        monthly_rental_rate: n.monthly_rental_rate ?? null,
      })
    }
    if (!data.meta?.next) break
  }
  return out
}

export async function getOwnedNumber(number: string) {
  try {
    const n = await plivo(`Number/${digitsOnly(number)}/`)
    return { number: n.number as string, alias: (n.alias ?? null) as string | null, application: String(n.application ?? ''), compliance_application_id: (n.compliance_application_id ?? undefined) as string | undefined }
  } catch {
    return null
  }
}

export async function searchAvailableNumbers(args: { country_iso: string; type?: string; pattern?: string; limit?: number }) {
  const data = await plivo('PhoneNumber/', {
    query: { country_iso: args.country_iso.toUpperCase(), type: args.type, pattern: args.pattern, services: 'voice', limit: Math.min(args.limit ?? 10, 20) },
  })
  return (data.objects ?? []).map((n: any) => ({
    number: n.number as string,
    type: n.type as string,
    city: (n.city ?? n.region ?? null) as string | null,
    country: n.country as string,
    monthly_rental_rate_usd: n.monthly_rental_rate as string,
    setup_rate_usd: (n.setup_rate ?? null) as string | null,
  }))
}

export async function buyNumber(number: string, complianceApplicationId?: string) {
  return plivo(`PhoneNumber/${digitsOnly(number)}/`, { method: 'POST', body: complianceApplicationId ? { compliance_application_id: complianceApplicationId } : {} })
}

/** Sets the alias and points the number at an inbound Zentrunk trunk (Plivo: trunk id goes in app_id). */
export async function attachNumberToTrunk(number: string, trunkId: string, alias: string) {
  return plivo(`Number/${digitsOnly(number)}/`, { method: 'POST', body: { app_id: trunkId, alias } })
}

/** Used to roll back an attach. */
export async function restoreNumberApp(number: string, appId: string | null, alias: string | null) {
  return plivo(`Number/${digitsOnly(number)}/`, { method: 'POST', body: { ...(appId ? { app_id: appId } : {}), alias: alias ?? '' } })
}
