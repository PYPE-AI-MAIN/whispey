#!/usr/bin/env node
/**
 * Local smoke test for Pi MCP create + voice backend. Loads .env.local only.
 * Usage: node scripts/verify-pi-local.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')

function loadEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i)
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const env = loadEnv(envPath)
const secret = env.AGENT_STUDIO_SECRET
const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const pypeApi = env.PYPEAI_API_URL || env.NEXT_PUBLIC_PYPEAI_API_URL
const appBase = env.INTERNAL_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3000' : env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ''))

const failures = []
const ok = (msg) => console.log('✓', msg)
const fail = (msg) => {
  console.log('✗', msg)
  failures.push(msg)
}

async function main() {
  console.log('Pi local verification\n')

  if (!secret) fail('AGENT_STUDIO_SECRET missing in .env.local')
  else ok('AGENT_STUDIO_SECRET set')

  if (!pypeApi) fail('PYPEAI_API_URL missing')
  else {
    try {
      const r = await fetch(`${pypeApi.replace(/\/$/, '')}/`, { signal: AbortSignal.timeout(5000) }).catch((e) => ({ ok: false, status: 0, _err: e }))
      if (r._err) fail(`Voice backend unreachable at ${pypeApi}: ${r._err.message}`)
      else ok(`Voice backend responded at ${pypeApi} (HTTP ${r.status})`)
    } catch (e) {
      fail(String(e))
    }
  }

  if (!supabaseUrl || !serviceKey) {
    fail('Supabase URL/service key missing — skipping MCP create test')
  } else {
    const sb = createClient(supabaseUrl, serviceKey)
    const { data: projects, error } = await sb.from('pype_voice_projects').select('id').limit(1)
    if (error || !projects?.[0]) fail(`Could not load a project: ${error?.message ?? 'none'}`)
    else {
      const projectId = projects[0].id
      ok(`Using project ${projectId}`)

      const mcpUrl = `${appBase.replace(/\/$/, '')}/api/askpi/agents`
      const body = {
        project_id: projectId,
        display_name: `pi-smoke-${Date.now()}`,
        prompt: 'You are a smoke-test agent. Say hello briefly.',
        voice: { provider: 'elevenlabs', voice_id: 'MmQVkVZnQ0dUbfWzcW6f' },
        created_by: 'pi-verify',
      }
      try {
        const resp = await fetch(mcpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-agent-studio-secret': secret },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120_000),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok) fail(`MCP create failed (${resp.status}): ${data.error ?? JSON.stringify(data)}`)
        else {
          ok(`MCP create OK agent_id=${data.agent_id}`)
          if (data.agent_id) {
            await sb.from('pype_voice_agents').delete().eq('id', data.agent_id)
            ok('Cleaned up smoke-test agent row')
          }
        }
      } catch (e) {
        fail(`MCP fetch to ${mcpUrl}: ${e.message}`)
      }
    }
  }

  console.log('')
  if (failures.length) {
    console.log(`${failures.length} issue(s):`)
    failures.forEach((f) => console.log(' -', f))
    process.exit(1)
  }
  console.log('All checks passed.')
}

main()
