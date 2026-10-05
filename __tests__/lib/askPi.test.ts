import { describe, it, expect, vi } from 'vitest'
import { MARK, findVariables, parseReply, readReply } from '@/lib/askPi'

// deterministic pseudo-random strings made of the characters that matter to the variable syntax
function* randomTexts(count: number, seed = 42) {
  let x = seed
  const next = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const alphabet = ['{', '{', '}', '}', 'a', 'b', ' ', '_', '\n', '1']
  for (let i = 0; i < count; i++) {
    const len = Math.floor(next() * 24)
    yield Array.from({ length: len }, () => alphabet[Math.floor(next() * alphabet.length)]).join('')
  }
}

describe('findVariables', () => {
  it('finds every {{variable}} once', () => {
    expect([...findVariables('Hi {{name}}, your {{plan}} for {{name}}')].sort()).toEqual(['{{name}}', '{{plan}}'])
    expect(findVariables('no variables here').size).toBe(0)
    expect(findVariables('').size).toBe(0)
  })
  it('behaves like the original regex on odd input', () => {
    expect([...findVariables('{{a}b}}')]).toEqual([])
    expect([...findVariables('{{{a}}')]).toEqual(['{{{a}}'])
    expect([...findVariables('{{a {{b}}')]).toEqual(['{{a {{b}}'])
    expect([...findVariables('{{unclosed')]).toEqual([])
    expect([...findVariables('{ {x} } {{}}')]).toEqual(['{{}}'])
  })
  it('matches the original regex on 5,000 random strings', () => {
    for (const text of randomTexts(5000)) {
      expect([...findVariables(text)].sort(), JSON.stringify(text)).toEqual([...new Set(text.match(/\{\{[^}]*\}\}/g) ?? [])].sort())
    }
  })
  it('stays fast on input built to make a naive scan quadratic', () => {
    const start = performance.now()
    expect(findVariables('{{'.repeat(50000)).size).toBe(0)
    expect(findVariables(`${'{{ '.repeat(20000)}}}`).size).toBe(1)
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('parseReply', () => {
  it('shows the short reply while the replacement is still streaming', () => {
    expect(parseReply(1, 'I shortened it.', false, '')).toMatchObject({ id: 1, role: 'assistant', content: 'I shortened it.', replacement: null, streamingReplacement: false })
    const mid = parseReply(1, `I shortened it.\n${MARK}\nNew te`, false, '')
    expect(mid).toMatchObject({ content: 'I shortened it.', replacement: null, streamingReplacement: true })
  })
  it('offers the replacement only once complete, and flags variables it dropped', () => {
    const done = parseReply(2, `Done.\n${MARK}\nHello {{first}}`, true, 'Hi {{first}} and {{last}}')
    expect(done).toMatchObject({ content: 'Done.', replacement: 'Hello {{first}}', missingVars: ['{{last}}'], streamingReplacement: false })
  })
  it('treats a reply without a marker, or with an empty replacement, as just an answer', () => {
    expect(parseReply(3, 'Because it keeps the call natural.', true, '').replacement).toBeNull()
    expect(parseReply(3, `Nothing to change.\n${MARK}\n   `, true, '').replacement).toBeNull()
    expect(parseReply(3, `Nothing to change.\n${MARK}\n   `, true, '').missingVars).toEqual([])
  })
})

describe('readReply', () => {
  const bodyOf = (...chunks: Uint8Array[]) => new ReadableStream<Uint8Array>({ start(c) { chunks.forEach((x) => c.enqueue(x)); c.close() } })
  const enc = new TextEncoder()
  it('reports the text so far after each chunk and returns the whole reply', async () => {
    const seen: string[] = []
    const all = await readReply(bodyOf(enc.encode('Hel'), enc.encode('lo '), enc.encode('there')), (t) => seen.push(t))
    expect(seen).toEqual(['Hel', 'Hello ', 'Hello there'])
    expect(all).toBe('Hello there')
  })
  it('does not corrupt a multi-byte character split across chunks', async () => {
    const bytes = enc.encode('नमस्ते')
    const onText = vi.fn()
    const all = await readReply(bodyOf(bytes.slice(0, 4), bytes.slice(4)), onText)
    expect(all).toBe('नमस्ते')
  })
  it('returns an empty string for an empty body', async () => {
    expect(await readReply(bodyOf(), vi.fn())).toBe('')
  })
})
