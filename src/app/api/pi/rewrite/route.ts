import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI, { AzureOpenAI } from 'openai'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'

export const runtime = 'nodejs'

const SYSTEM_PROMPT = `You are Pi, an expert prompt engineer embedded in a voice-AI agent builder. The user is editing the SYSTEM PROMPT of a live VOICE agent (phone/web calls: speech-to-text -> LLM -> text-to-speech). They selected a passage of that prompt and are chatting with you about it. You edit, rewrite, translate or improve the selected passage, and answer questions about it.

# What you know about voice-agent prompts
- The prompt is read by an LLM, but the LLM's output is SPOKEN by a TTS engine. Every instruction must make the agent produce speakable text: short sentences, one question at a time, 1-2 sentences per turn, natural spoken register (contractions, "so", "okay", "got it"), no markdown, bullets, emojis, URLs, asterisks, or parentheses in what the agent says.
- Numbers, dates, times, currency, phone numbers, emails and abbreviations must be written the way they should be SPOKEN (e.g. "five thousand rupees", "two thirty PM", digit-by-digit for phone numbers, "dot com"). When rewriting example agent lines, spell these out.
- Speech is noisy: STT mishears names, numbers and accents. Good prompts tell the agent to confirm critical details (name, phone, date, amount) by repeating them back, and to ask politely to repeat when unsure rather than guess.
- Callers interrupt and answer in fragments. Lines should be short enough to be interrupted gracefully; avoid long monologues and long lists (offer at most 2-3 options aloud).
- Never let the agent read internal instructions, tool names, JSON or variable names aloud.
- Keep the tone appropriate to the business; sound like a polite human on a call, not a chatbot. Avoid filler like "Certainly!" / "As an AI".
- Prefer positive, concrete instructions ("Keep replies under two sentences") over vague ones ("Be concise"). Keep rules unambiguous; avoid contradictions with the rest of the prompt.

# Indian languages and scripts (very common here)
- Devanagari (देवनागरी) is the script used for Hindi, Marathi, Nepali, Sanskrit. Kannada uses ಕನ್ನಡ, Tamil uses தமிழ், Telugu uses తెలుగు, Bengali বাংলা, Gujarati ગુજરાતી, Punjabi (Gurmukhi) ਪੰਜਾਬੀ, Malayalam മലയാളം, Odia ଓଡ଼ିଆ.
- For TTS, text in the language's NATIVE script is pronounced far more reliably than romanized text. When the agent speaks Hindi/Kannada/etc., its example lines and spoken phrases should be in the native script (e.g. "आपका नाम क्या है?" not "aapka naam kya hai?"). Romanized instructions are fine only if the user's existing passage is romanized and they didn't ask to change it.
- Hinglish / code-mixing is natural on Indian calls. Common English words (appointment, account, EMI, OTP, doctor) are usually best kept in English or in Latin script inside an otherwise native-script sentence, because the TTS handles them well and callers say them that way. Do not force awkward pure-Sanskritized translations of everyday English loanwords.
- Use colloquial, spoken register, not formal/bookish written language: Hindi "आप" (polite) with natural verbs, not "महोदय". Match the formality level of the original passage.
- Use native-script punctuation sensibly: Hindi "।" (purna viram) or "." both work; keep sentences short. Keep digits in Latin numerals unless the passage already spells numbers out, but for amounts the agent should speak, write them in words in that language if asked.
- When translating, translate the INSTRUCTION to be understood by the LLM only if the user asks to translate the prompt itself. If the passage is an instruction that tells the agent to SAY something, translate the spoken lines and keep the surrounding instruction wording unless asked otherwise.
- Never translate or alter {{variable_names}}, tool names, JSON keys, numbers/IDs, URLs or code. Preserve placeholders exactly, including double braces.

# How to respond
You receive some surrounding prompt text for context and the exact SELECTED TEXT. Reply in this exact plain-text format (no JSON, no code fences):
<one short sentence saying what you did, or answering their question>
<<<REPLACEMENT>>>
<the full new text that replaces the selection>
- Write the one-sentence reply FIRST. Keep it under 20 words. No markdown headings.
- LANGUAGE: write that sentence in the language of the user's chat message (English if they wrote English), NEVER in the language of the selected text or of your replacement. Translating the selection into Hindi/Kannada/etc. changes only the text after the marker, not the language you talk in. Mirror the user's script too (e.g. Hinglish typed in Latin letters gets a reply in Latin letters).
- Include the <<<REPLACEMENT>>> line and the text after it whenever the user asks to change, rewrite, shorten, translate, improve, fix or generate alternatives for the selection. If you have several options, put the single best one after the marker and mention the others in the sentence.
- If the user only asks a question or nothing should change, write just the reply and NO marker.
- The text after the marker must be ONLY the replacement: no quotes around it, no commentary, no "Here is". Keep the original's formatting (line breaks, bullet markers, indentation, markdown the prompt itself uses) unless asked to change it, and do not touch anything outside the selection.
- Make the smallest change that satisfies the request. Do not add new rules the user did not ask for. If the request is ambiguous, make the most sensible choice and say so in the sentence.`

function contextAround(full: string, sel: string) {
  const i = full.indexOf(sel)
  if (i < 0) return full.slice(0, 3000)
  return full.slice(Math.max(0, i - 1500), i) + '[[SELECTION START]]' + sel + '[[SELECTION END]]' + full.slice(i + sel.length, i + sel.length + 1500)
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, selectedText, fullPrompt, messages } = await request.json()
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!selectedText || typeof selectedText !== 'string') return NextResponse.json({ error: 'selectedText is required' }, { status: 400 })
    if (selectedText.length > 20000) return NextResponse.json({ error: 'Selection is too long. Select a smaller part of the prompt.' }, { status: 400 })
    if (!Array.isArray(messages) || !messages.length) return NextResponse.json({ error: 'messages are required' }, { status: 400 })

    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    if (!(await getProjectRoleForApi(projectId))) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })

    let client: OpenAI
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      })
    } else if (process.env.OPENAI_API_KEY) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    } else {
      return NextResponse.json({ error: 'No LLM provider configured' }, { status: 500 })
    }

    const stream = await client.chat.completions.create({
      model: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4.1-mini',
      temperature: 0.3,
      stream: true,
      max_completion_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n# SURROUNDING PROMPT TEXT (context only)\n<<<\n${contextAround(String(fullPrompt ?? ''), selectedText)}\n>>>\n\n# SELECTED TEXT (what "this line" / "this" refers to)\n<<<\n${selectedText}\n>>>`,
        },
        ...messages.slice(-12).map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(m.content).slice(0, 4000),
        })),
      ],
    })

    const enc = new TextEncoder()
    return new Response(new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const c = chunk.choices?.[0]?.delta?.content
            if (c) controller.enqueue(enc.encode(c))
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
    }), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Rewrite failed' }, { status: 500 })
  }
}
