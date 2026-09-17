import { describe, it } from 'vitest'
import pg from 'pg'
import fs from 'node:fs'
import { scanBuiltins, scanColumn, inferField } from '@/server/analytics/catalog'
import { applyDeclarations, GROUP_LABEL, GROUP_ORDER, type FieldGroup } from '@/server/analytics/extractor'
import { disambiguate } from '@/components/analytics/FieldPicker'
import { suggestions } from '@/components/analytics/suggest'
import { JSON_COLS } from '@/server/analytics/spec'
import type { CatalogField } from '@/types/analytics'

const AGENT = process.env.ANALYTICS_SMOKE_AGENT ?? '781fcc07-6929-4a4a-bc63-bb2b837ce71c'

/**
 * Prints the field pickers exactly as a person sees them, grouped, so that
 * "is this sensible?" is a question with an answer rather than a guess. This is
 * what caught `call_id` being offered as a chart axis and five separate rows
 * all reading "Reason".
 *
 * Never runs in CI:
 *   SUPABASE_POOLER_URL=... npx vitest run __tests__/analytics/catalog.live.test.ts
 */
const run = process.env.SUPABASE_POOLER_URL ? describe : describe.skip

run('what the pickers show', () => {
  it('grouped, sorted, and named the way a person reads them', async () => {
    const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
    const c = new pg.Client({ connectionString: env.SUPABASE_POOLER_URL, ssl:{rejectUnauthorized:false} })
    await c.connect()
    const prompt = (await c.query(`select field_extractor_prompt p from pype_voice_agents where id=$1`,[AGENT])).rows[0].p
    await c.end()

    const raw: Record<string, unknown>[] = []
    for (const b of await scanBuiltins(AGENT)) raw.push({ ...b, path: [] })
    for (const col of JSON_COLS) for (const s of await scanColumn(AGENT, col)) raw.push({ col, path: s.path, ...inferField(s) })

    const rows = applyDeclarations(raw as never[], prompt, { includeDescription: true }) as unknown as CatalogField[]
    const names = disambiguate(rows)
    const key = (f: CatalogField) => `${f.col}::${f.path.join('.')}`

    for (const g of GROUP_ORDER) {
      const list = rows.filter((f) => f.group === g).sort((a,b)=>(b.coverage_pct??0)-(a.coverage_pct??0))
      if (!list.length) continue
      console.log(`\n══ ${GROUP_LABEL[g as FieldGroup]} (${list.length})`)
      for (const f of list) {
        const shape = f.value_type === 'boolean' ? `bool:${f.boolean_encoding}`
          : f.enum_values?.length ? `[${f.enum_values.slice(0,6).join(',')}]` : f.value_type
        console.log(`  ${String(Math.round(f.coverage_pct??0)).padStart(3)}%  ${(names.get(key(f))??'').padEnd(32)} ${f.is_dimension?'axis':'    '}  ${String(shape).slice(0,70)}`)
        if (f.description) console.log(`         ↳ ${f.description.slice(0,88)}`)
      }
    }
    console.log('\n══ SUGGESTED (what the strip offers, in order)')
    for (const s of suggestions(rows).slice(0, 8)) {
      console.log(`  [${s.kind.padEnd(4)}] ${s.title.padEnd(34)} ↳ ${s.why.slice(0, 80)}`)
    }

    console.log('\nSPLIT-BY candidates:', rows.filter(f=>f.is_dimension && f.value_type!=='json').length, 'of', rows.length)
  }, 120000)
})
