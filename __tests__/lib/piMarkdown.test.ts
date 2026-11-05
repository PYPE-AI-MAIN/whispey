import { describe, it, expect } from 'vitest'
import { closeOpenMarkdown, isFenceLine, nextRevealLength, splitBlocks } from '@/lib/piMarkdown'

describe('isFenceLine', () => {
  it('recognises a code fence, indented or not', () => {
    expect(isFenceLine('```')).toBe(true)
    expect(isFenceLine('   ```ts')).toBe(true)
    expect(isFenceLine('\t```')).toBe(true)
    expect(isFenceLine('text ```')).toBe(false)
    expect(isFenceLine('``')).toBe(false)
    expect(isFenceLine('')).toBe(false)
  })
})

describe('splitBlocks', () => {
  it('splits paragraphs at blank lines', () => {
    expect(splitBlocks('one\n\ntwo\n\nthree')).toEqual(['one\n', 'two\n', 'three'])
    expect(splitBlocks('')).toEqual([''])
  })
  it('never splits a list, a table, a quote or an indented continuation', () => {
    expect(splitBlocks('- a\n\n- b')).toHaveLength(1)
    expect(splitBlocks('1. a\n\n2. b')).toHaveLength(1)
    expect(splitBlocks('| a |\n\n| b |')).toHaveLength(1)
    expect(splitBlocks('> a\n\n> b')).toHaveLength(1)
    expect(splitBlocks('para\n\n  indented')).toHaveLength(1)
  })
  it('keeps a code block together even when it contains blank lines', () => {
    const blocks = splitBlocks('intro\n\n```js\nline1\n\nline2\n```\n\noutro')
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toBe('```js\nline1\n\nline2\n```\n')
  })
  it('puts back together exactly what was split', () => {
    for (const text of ['a\n\nb', '- x\n\n- y\n\nz', '```\n\n```\n\nq', 'solo']) expect(splitBlocks(text).join('\n')).toBe(text)
  })
})

describe('closeOpenMarkdown', () => {
  it('leaves finished markdown alone', () => {
    for (const text of ['plain', '**bold** and `code`', '```js\nx\n```', '']) expect(closeOpenMarkdown(text)).toBe(text)
  })
  it('closes whatever the stream has left open', () => {
    expect(closeOpenMarkdown('hi **bo')).toBe('hi **bo**')
    expect(closeOpenMarkdown('use `code')).toBe('use `code`')
    expect(closeOpenMarkdown('```js\nx')).toBe('```js\nx\n```')
    expect(closeOpenMarkdown('   ```\nx')).toBe('   ```\nx\n```')
  })
  it('counts backticks outside a fence separately from the fence itself', () => {
    expect(closeOpenMarkdown('```\ncode\n```\nthen `inline')).toBe('```\ncode\n```\nthen `inline`')
  })
  it('stays fast on whitespace-heavy input', () => {
    const start = performance.now()
    closeOpenMarkdown(`${' '.repeat(100000)}\n`.repeat(20))
    expect(performance.now() - start).toBeLessThan(500)
  })
  it('counts fences like the regex it replaced (random lines)', () => {
    let x = 7
    const next = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    const pieces = ['```', '  ```', 'text', '', '`x`', ' ```js', 'a ```', '**']
    for (let i = 0; i < 2000; i++) {
      const text = Array.from({ length: Math.floor(next() * 8) }, () => pieces[Math.floor(next() * pieces.length)]).join('\n')
      const oldOdd = ((text.match(/^\s*```/gm) ?? []).length % 2) === 1
      const closed = closeOpenMarkdown(text)
      if (oldOdd) expect(closed, JSON.stringify(text)).toBe(`${text}\n\`\`\``)
      else expect(closed.length - text.length, JSON.stringify(text)).toBeLessThanOrEqual(2) // only ever a closing ** or `
    }
  })
})

describe('nextRevealLength', () => {
  it('reveals at least one character and never past the end', () => {
    expect(nextRevealLength('hello', 0)).toBe(1)
    expect(nextRevealLength('hello', 4)).toBe(5)
    expect(nextRevealLength('hello', 5)).toBe(5)
    expect(nextRevealLength('', 0)).toBe(0)
  })
  it('catches up faster the further behind it is', () => {
    const long = 'x'.repeat(1000)
    expect(nextRevealLength(long, 0)).toBeGreaterThan(50)
    expect(nextRevealLength(long, 990)).toBe(991)
  })
  it('never cuts an emoji in half', () => {
    const text = 'ab😀cd' // 😀 is two UTF-16 units at index 2-3
    for (let shown = 0; shown < text.length; shown++) {
      const n = nextRevealLength(text, shown)
      expect(text.slice(0, n)).not.toMatch(/[\ud800-\udbff]$/)
    }
  })
  it('never separates a letter from its combining mark (Devanagari / Kannada)', () => {
    for (const word of ['क्षत्रिय', 'ಕನ್ನಡ', 'नमस्ते']) {
      for (let shown = 0; shown < word.length; shown++) {
        const n = nextRevealLength(word, shown)
        if (n < word.length) expect(word[n]).not.toMatch(/[\p{M}‌‍]/u)
      }
    }
  })
})
