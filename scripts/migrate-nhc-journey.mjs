// One-off: copy Narayana Clinic (client = nh_clinic) members + their logs from the n8n/Supabase campaign DB
// into ONE Journeys campaign here. The source is only ever READ (GET); nothing in it is changed.
//
//   node scripts/migrate-nhc-journey.mjs               dry run: builds everything in memory, prints a report, writes nothing
//   node scripts/migrate-nhc-journey.mjs --apply       writes the campaign, journeys and events into this app's DB
//   node scripts/migrate-nhc-journey.mjs --rollback    deletes that one campaign (and only it) from this app's DB
//
// Env: target = SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local; source = NHC_SOURCE_URL / NHC_SOURCE_KEY (never stored).
// PII: phone numbers, member names, click tokens and WhatsApp message ids are NOT copied. identity_key is the campaign's member_id.
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('.env.local')

const PROJECT_ID = 'a5370ff3-81c6-4551-bd56-9f5d44b561d8'
const CLIENT = 'nh_clinic'
const CAMPAIGN_KEY = 'nhc_add_family_members'
const CAMPAIGN_NAME = 'NH Clinic · Add Family Members'
const VOICE_AGENT_NAME_PREFIX = 'NH Add Family Member LQ' // the source's clients.agent_name is NH_Add_Fam_7e01d5b5_… (same agent)
const VOICE_AGENT_ID_PREFIX = '7e01d5b5'

const STEPS = [
  { step: 'joined', label: 'Joined campaign', channel: 'system' },
  { step: 'video_1', label: '1st video (WhatsApp)', channel: 'whatsapp' },
  { step: 'voice_call_1', label: '1st voice AI call', channel: 'voice' },
  { step: 'recovery_text_1', label: 'Recovery text (after call 1)', channel: 'whatsapp' },
  { step: 'video_2', label: '2nd video (WhatsApp)', channel: 'whatsapp' },
  { step: 'voice_call_2', label: 'Final voice AI call', channel: 'voice' },
  { step: 'recovery_text_2', label: 'Recovery text (after call 2)', channel: 'whatsapp' },
  { step: 'family_added', label: 'Family members added', channel: 'form' },
]
// the n8n workflow's own step codes -> our readable step keys
const STEP_KEY = { 1: 'video_1', 2: 'voice_call_1', '2b': 'recovery_text_1', 3: 'video_2', 4: 'voice_call_2', '4b': 'recovery_text_2' }
const CALL_STEP_FOR = { 1: null, 2: 'voice_call_1', '2b': 'voice_call_1', 3: 'voice_call_1', 4: 'voice_call_2', '4b': 'voice_call_2' }
const CALL_KEYS_DROPPED = new Set(['members']) // the family members' names live in here

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const ROLLBACK = args.has('--rollback')

const target = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function sourceGet(path) {
  const { NHC_SOURCE_URL: url, NHC_SOURCE_KEY: key } = process.env
  if (!url || !key) throw new Error('Set NHC_SOURCE_URL and NHC_SOURCE_KEY in the environment (read access to the campaign DB)')
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`source ${path} -> HTTP ${res.status}`)
  return res.json()
}

async function sourceAll(table, select, filter, order) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const page = await sourceGet(`${table}?select=${select}${filter ? `&${filter}` : ''}&order=${order}&limit=1000&offset=${offset}`)
    out.push(...page)
    if (page.length < 1000) return out
  }
}

const ts = (v) => {
  if (!v) return null
  const d = new Date(String(v).replace(' ', 'T').replace(/\+00$/, '+00:00'))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''))
const parseMaybeJson = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return v } }

if (ROLLBACK) {
  const { data: c } = await target.from('pype_campaigns').select('id').eq('project_id', PROJECT_ID).eq('key', CAMPAIGN_KEY).maybeSingle()
  if (!c) { console.log('Nothing to roll back: campaign not found.'); process.exit(0) }
  const ids = []
  for (let from = 0; ; from += 1000) {
    const { data } = await target.from('pype_journeys').select('id').eq('campaign_id', c.id).range(from, from + 999)
    ids.push(...(data ?? []).map((j) => j.id))
    if (!data || data.length < 1000) break
  }
  for (let i = 0; i < ids.length; i += 200) await target.from('pype_journey_events').delete().in('journey_id', ids.slice(i, i + 200))
  await target.from('pype_journeys').delete().eq('campaign_id', c.id)
  await target.from('pype_journey_charts').delete().eq('campaign_id', c.id)
  await target.from('pype_campaigns').delete().eq('id', c.id)
  console.log(`Rolled back campaign ${CAMPAIGN_KEY}: ${ids.length} journeys removed.`)
  process.exit(0)
}

// ───────────── extract (read-only) ─────────────
console.log('Reading the source (GET only)…')
const members = await sourceAll('members', 'member_id,phone_hash,language,whatsapp_optin,status,current_step,last_step_sent,last_channel,last_disposition,clicked,clicked_at,members_added_count,reachout_count,call_retry_count,delivery_status,converted_at_step,batch,cohort_name,created_at,updated_at,callback_at,wa_history,call_dispositions', `client=eq.${CLIENT}`, 'member_id')
const history = await sourceAll('member_status_history', 'member_id,from_status,to_status,step,disposition,added_count,changed_at', `client=eq.${CLIENT}`, 'id')
const familyAll = await sourceAll('family_members', 'member_id,slot,age,source,created_at,relation', null, 'id')
const memberIds = new Set(members.map((m) => String(m.member_id)))
const family = familyAll.filter((f) => memberIds.has(String(f.member_id)))
console.log(`  members ${members.length} · status history ${history.length} · family rows ${family.length} (of ${familyAll.length} across clients)`)

const { data: agents } = await target.from('pype_voice_agents').select('id,name,display_name').eq('project_id', PROJECT_ID)
const voiceAgent = agents?.find((a) => a.id.startsWith(VOICE_AGENT_ID_PREFIX))
if (!voiceAgent) console.warn(`  ! voice agent ${VOICE_AGENT_ID_PREFIX}… not found in this project: voice events get no agent_id`)

// Every call attempt lives in the voice-call logs (answered or not) — the campaign DB only keeps each member's LAST call result.
// Matched on the phone HASH both sides already store, so no phone number is read or copied.
const NH_AGENT_PREFIXES = ['7e01d5b5', '3bba0672', '29ce860b'] // NH Add Family Member LQ / Cohort 5&6 / Inbound
const callAgentIds = (agents ?? []).filter((a) => NH_AGENT_PREFIXES.some((x) => a.id.startsWith(x))).map((a) => a.id)
const memberByHash = new Map(members.filter((m) => m.phone_hash).map((m) => [m.phone_hash, String(m.member_id)]))
const callsBy = new Map()
let callRows = 0
// keyset paging (id > last) — offset paging over the big transcription_metrics column hits the statement timeout
const CALL_PAGE = 300
for (let lastId = null; ;) {
  let q = target.from('pype_voice_call_logs')
    .select('id,call_id,agent_id,customer_number_hash,call_started_at,call_ended_reason,duration_seconds,fd:transcription_metrics->>final_disposition,co:transcription_metrics->>call_outcome,task:transcription_metrics->>is_task_complete,inc:transcription_metrics->>is_user_in_call,added:transcription_metrics->>members_added_count,lang:transcription_metrics->>language_mode_used')
    .in('agent_id', callAgentIds).gte('call_started_at', '2026-08-20').order('id').limit(CALL_PAGE)
  if (lastId) q = q.gt('id', lastId)
  let res = await q
  for (let attempt = 1; res.error && attempt <= 3; attempt++) { await new Promise((r) => setTimeout(r, 1500 * attempt)); res = await q }
  if (res.error) throw res.error
  const data = res.data
  for (const c of data) {
    const mid = memberByHash.get(c.customer_number_hash)
    if (!mid) continue
    if (!callsBy.has(mid)) callsBy.set(mid, [])
    callsBy.get(mid).push(c)
  }
  callRows += data.length
  if (callRows % 6000 < CALL_PAGE) process.stdout.write(`\r  scanning call logs… ${callRows}`)
  if (data.length < CALL_PAGE) break
  lastId = data[data.length - 1].id
}
console.log(`  call logs scanned ${callRows} · matched to ${callsBy.size} of ${members.length} members`)

const historyBy = new Map(), familyBy = new Map()
for (const h of history) { const k = String(h.member_id); if (!historyBy.has(k)) historyBy.set(k, []); historyBy.get(k).push(h) }
for (const f of family) { const k = String(f.member_id); if (!familyBy.has(k)) familyBy.set(k, []); familyBy.get(k).push(f) }

// ───────────── transform ─────────────
const unmappedSteps = new Map()
const stepOf = (code) => {
  if (code === null || code === undefined || code === '') return null
  const key = STEP_KEY[String(code)]
  if (!key) unmappedSteps.set(String(code), (unmappedSteps.get(String(code)) ?? 0) + 1)
  return key ?? null
}

const journeys = [] // { identity_key, status, current_step, outcome, metadata, created_at, updated_at, events: [...] }
for (const m of members) {
  const id = String(m.member_id)
  const events = []
  const add = (channel, step, action, at, payload = {}, agent = false) => {
    if (!at) return
    events.push({ channel, step, action, occurred_at: at, payload: clean(payload), agent_id: agent && voiceAgent ? voiceAgent.id : null, external_ref: null })
  }

  add('system', 'joined', 'entered_campaign', ts(m.created_at), { batch: num(m.batch), cohort: m.cohort_name })

  for (const w of Array.isArray(m.wa_history) ? m.wa_history : []) {
    const step = stepOf(w.step)
    const p = { template: w.template }
    add('whatsapp', step, 'message_sent', ts(w.sent_at), p)
    add('whatsapp', step, 'message_delivered', ts(w.delivered_at), p)
    add('whatsapp', step, 'message_read', ts(w.read_at), p)
    add('whatsapp', step, 'message_failed', ts(w.failed_at), p)
    add('whatsapp', step, 'link_clicked', ts(w.clicked_at), p)
  }
  const clickAt = ts(m.clicked_at)
  if (clickAt && !events.some((e) => e.action === 'link_clicked' && Math.abs(new Date(e.occurred_at) - new Date(clickAt)) < 60_000)) {
    add('whatsapp', STEP_KEY[String(m.last_step_sent)] ?? null, 'link_clicked', clickAt)
  }

  const callBase = (() => {
    const cd = m.call_dispositions && typeof m.call_dispositions === 'object' ? m.call_dispositions : null
    if (!cd) return null
    return clean(Object.fromEntries(Object.entries(cd).filter(([k]) => !CALL_KEYS_DROPPED.has(k)).map(([k, v]) => [k, parseMaybeJson(v) === 'null' ? null : v])))
  })()

  let analysisPlaced = false
  const hist = (historyBy.get(id) ?? []).sort((a, b) => ts(a.changed_at).localeCompare(ts(b.changed_at)))
  for (const h of hist) {
    const action = h.to_status === 'exhausted' ? 'campaign_exhausted' : 'status_changed'
    add('system', stepOf(h.step), action, ts(h.changed_at),
      { from_status: h.from_status, to_status: h.to_status, disposition: h.disposition, added_count: num(h.added_count) })
  }

  // one event per call attempt, from the voice-call logs
  const myCalls = (callsBy.get(id) ?? []).filter((c) => ts(c.call_started_at)).sort((a, b) => ts(a.call_started_at).localeCompare(ts(b.call_started_at)))
  if (myCalls.length) {
    const video2 = events.find((e) => e.step === 'video_2' && e.action === 'message_sent')?.occurred_at
    const earlyOnly = ['1', '2', '2b'].includes(String(m.last_step_sent))
    let cluster = 0, prev = null, attempt = 0, lastStep = null
    for (const c of myCalls) {
      const at = ts(c.call_started_at)
      // which call step? before the 2nd video = call 1, after = final call; without a video log, a >36h gap starts the final-call cluster
      let step
      if (video2) step = at < video2 ? 'voice_call_1' : 'voice_call_2'
      else if (earlyOnly) step = 'voice_call_1'
      else { if (prev && new Date(at) - new Date(prev) > 36 * 3600e3) cluster = 1; step = cluster ? 'voice_call_2' : 'voice_call_1' }
      attempt = prev && step === lastStep ? attempt + 1 : 1
      lastStep = step
      prev = at
      const connected = c.call_ended_reason === 'completed'
      add('voice', step, connected ? 'call_completed' : 'call_not_connected', at, {
        call_ended_reason: c.call_ended_reason, duration_seconds: num(c.duration_seconds), attempt,
        final_disposition: c.fd || c.co, is_task_complete: c.task, is_user_in_call: c.inc, members_added_count: num(c.added), language_mode_used: c.lang,
      }, true)
      const e = events[events.length - 1]; e.agent_id = c.agent_id; e.external_ref = c.id // the observability page looks a call up by the log's primary key `id` (not `call_id`)
    }
  }
  if (callBase && !myCalls.length) {
    // the call's own log has no timestamp; the member's last update is the closest honest time, and we say so
    add('voice', CALL_STEP_FOR[String(m.last_step_sent)] ?? null, 'call_completed', ts(m.updated_at), { ...callBase, time_is_approximate: true }, true)
  }

  const fam = (familyBy.get(id) ?? []).sort((a, b) => ts(a.created_at).localeCompare(ts(b.created_at)))
  for (const f of fam) add(f.source === 'voice' ? 'voice' : 'form', 'family_added', 'family_member_added', ts(f.created_at), { slot: num(f.slot), relation: f.relation, age: num(f.age), source: f.source }, f.source === 'voice')
  if (m.status === 'converted' && !events.some((e) => e.step === 'family_added')) {
    const conv = hist.find((h) => h.to_status === 'converted')
    add('system', 'family_added', 'converted', ts(conv?.changed_at) ?? ts(m.updated_at), conv ? { added_count: num(conv.added_count) } : { time_is_approximate: true })
  }

  events.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
  const last = events[events.length - 1]
  journeys.push({
    identity_key: id,
    status: m.status ?? 'active',
    current_step: STEP_KEY[String(m.current_step ?? m.last_step_sent)] ?? null,
    outcome: callBase?.final_disposition ?? m.last_disposition ?? null,
    metadata: clean({
      batch: num(m.batch), cohort: m.cohort_name, language: m.language, whatsapp_optin: m.whatsapp_optin,
      members_added_count: num(m.members_added_count), reachout_count: num(m.reachout_count), call_retry_count: num(m.call_retry_count),
      delivery_status: m.delivery_status, converted_at_step: STEP_KEY[String(m.converted_at_step)] ?? m.converted_at_step, source: 'nh_clinic_n8n',
    }),
    created_at: ts(m.created_at),
    updated_at: ts(m.updated_at) ?? last?.occurred_at ?? ts(m.created_at),
    events,
  })
}

// ───────────── report ─────────────
const tally = (rows, f) => Object.entries(rows.reduce((a, r) => { const k = f(r); a[k] = (a[k] ?? 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1])
const allEvents = journeys.flatMap((j) => j.events)
const reached = Object.fromEntries(STEPS.map((s) => [s.step, journeys.filter((j) => j.events.some((e) => e.step === s.step)).length]))
console.log(`\nCampaign   ${CAMPAIGN_KEY}  "${CAMPAIGN_NAME}"`)
console.log(`Journeys   ${journeys.length}`)
console.log(`Events     ${allEvents.length}   (${allEvents[0] ? allEvents.reduce((m, e) => (e.occurred_at < m ? e.occurred_at : m), allEvents[0].occurred_at).slice(0, 10) : '-'} → ${allEvents.reduce((m, e) => (e.occurred_at > m ? e.occurred_at : m), '').slice(0, 10)})`)
console.log('By channel ', tally(allEvents, (e) => e.channel).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('By action  ', tally(allEvents, (e) => e.action).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('Funnel (journeys that reached each step):'); for (const s of STEPS) console.log(`  ${s.step.padEnd(16)} ${String(reached[s.step]).padStart(6)}   ${s.label}`)
console.log('Status     ', tally(journeys, (j) => j.status).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('Outcome    ', tally(journeys, (j) => j.outcome ?? '—').slice(0, 10).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log('Approximate-time events:', allEvents.filter((e) => e.payload.time_is_approximate).length, ' · journeys with no event beyond "joined":', journeys.filter((j) => j.events.length <= 1).length)
if (unmappedSteps.size) console.log('! Unmapped step codes (stored with step = null):', [...unmappedSteps])
const sample = journeys.find((j) => j.status === 'converted' && j.events.length > 6) ?? journeys[0]
console.log(`\nSample journey (${sample.identity_key}):`); for (const e of sample.events.slice(0, 12)) console.log(`  ${e.occurred_at.slice(0, 16)}  ${e.channel.padEnd(8)} ${String(e.step).padEnd(16)} ${e.action}`)

if (!APPLY) { console.log('\nDry run only — nothing was written. Re-run with --apply to write it.'); process.exit(0) }

// ───────────── load (target) ─────────────
const { data: existing } = await target.from('pype_campaigns').select('id').eq('project_id', PROJECT_ID).eq('key', CAMPAIGN_KEY).maybeSingle()
if (existing) {
  const { count } = await target.from('pype_journeys').select('id', { count: 'exact', head: true }).eq('campaign_id', existing.id)
  if (count) throw new Error(`Campaign ${CAMPAIGN_KEY} already has ${count} journeys here. Run --rollback first so nothing is written twice.`)
}
const { data: camp, error: campErr } = await target.from('pype_campaigns').upsert({ project_id: PROJECT_ID, key: CAMPAIGN_KEY, name: CAMPAIGN_NAME, steps: STEPS }, { onConflict: 'project_id,key' }).select('id').single()
if (campErr) throw campErr

let written = 0
for (let i = 0; i < journeys.length; i += 500) {
  const chunk = journeys.slice(i, i + 500)
  const { data: rows, error } = await target.from('pype_journeys').upsert(
    chunk.map((j) => ({ project_id: PROJECT_ID, campaign_id: camp.id, identity_key: j.identity_key, status: j.status, current_step: j.current_step, outcome: j.outcome, metadata: j.metadata, created_at: j.created_at, updated_at: j.updated_at })),
    { onConflict: 'project_id,campaign_id,identity_key' }
  ).select('id,identity_key')
  if (error) throw error
  const idOf = new Map(rows.map((r) => [r.identity_key, r.id]))
  const events = chunk.flatMap((j) => j.events.map((e) => ({ journey_id: idOf.get(j.identity_key), ...e })))
  for (let k = 0; k < events.length; k += 1000) {
    const { error: evErr } = await target.from('pype_journey_events').insert(events.slice(k, k + 1000))
    if (evErr) throw evErr
  }
  written += chunk.length
  process.stdout.write(`\r  wrote ${written}/${journeys.length} journeys`)
}
console.log(`\nDone. Open /${PROJECT_ID}/analytics → Journeys → "${CAMPAIGN_NAME}".`)
