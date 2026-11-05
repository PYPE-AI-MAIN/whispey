// Pure helpers behind the "Ask Pi" popover in the prompt editor, kept out of the component so they can be tested.

export const MARK = '<<<REPLACEMENT>>>'

export interface Msg {
  id: number
  role: 'user' | 'assistant'
  content: string
  replacement?: string | null
  missingVars?: string[]
  streamingReplacement?: boolean
}

/** Every `{{variable}}` in a text. A plain scan with one forward pointer, so it stays linear on adversarial input. */
export function findVariables(text: string): Set<string> {
  const found = new Set<string>()
  let close = -2
  let i = 0
  while (i < text.length - 1) {
    if (text[i] !== '{' || text[i + 1] !== '{') {
      i++
      continue
    }
    if (close < i + 2) close = text.indexOf('}', i + 2)
    if (close === -1) break
    if (text[close + 1] === '}') {
      found.add(text.slice(i, close + 2))
      i = close + 2
    } else {
      i++
    }
  }
  return found
}

/** Splits the streamed "<short reply>\n<<<REPLACEMENT>>>\n<new text>" into the message the card shows. */
export function parseReply(id: number, acc: string, done: boolean, selectedText: string): Msg {
  const k = acc.indexOf(MARK)
  const content = (k < 0 ? acc : acc.slice(0, k)).trim()
  const rep = k < 0 ? '' : acc.slice(k + MARK.length).trim()
  const replacement = done && rep ? rep : null
  return {
    id, role: 'assistant', content, replacement,
    missingVars: replacement ? [...findVariables(selectedText)].filter((v) => !replacement.includes(v)) : [],
    streamingReplacement: !done && k >= 0,
  }
}

/** Reads the response body to the end, reporting the text so far after every chunk. */
export async function readReply(body: ReadableStream<Uint8Array>, onText: (acc: string) => void): Promise<string> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let acc = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    acc += dec.decode(value, { stream: true })
    onText(acc)
  }
  return acc + dec.decode()
}
