import { NextRequest, NextResponse } from 'next/server'

interface TranscriptTurn {
  id: string
  speaker: 'user' | 'agent'
  text: string
}

interface TurnAnalysis {
  id: string
  sentiment: 'positive' | 'neutral' | 'negative'
  score: number // 0–1, where 1 = most positive
}

interface AnalysisResult {
  summary: string
  overallSentiment: 'positive' | 'neutral' | 'negative'
  turns: TurnAnalysis[]
  topics: string[]
  callOutcome: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let transcripts: TranscriptTurn[]
  try {
    const body = await req.json()
    transcripts = body.transcripts ?? []
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (transcripts.length === 0) {
    return NextResponse.json({ error: 'No transcripts provided' }, { status: 400 })
  }

  const conversationText = transcripts
    .map(t => `[${t.speaker.toUpperCase()}]: ${t.text}`)
    .join('\n')

  const turnIds = transcripts.map(t => t.id)

  const prompt = `You are an expert call analytics AI. Analyze the following voice call transcript and return a structured JSON analysis.

TRANSCRIPT:
${conversationText}

Respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "summary": "2-3 sentence summary of what was discussed and the outcome",
  "overallSentiment": "positive" | "neutral" | "negative",
  "callOutcome": "one short phrase describing what was achieved or resolved",
  "topics": ["topic1", "topic2", "topic3"],
  "turns": [
    ${turnIds.map(id => `{"id": "${id}", "sentiment": "positive"|"neutral"|"negative", "score": 0.0}`).join(',\n    ')}
  ]
}

For each turn, set:
- sentiment: the emotional tone of that specific message
- score: a number 0.0 to 1.0 (0=very negative, 0.5=neutral, 1.0=very positive)

Topics should be 2-5 key subjects discussed. Keep them concise (1-3 words each).`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: err?.error?.message || `Claude API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text ?? ''

    let analysis: AnalysisResult
    try {
      // Strip markdown code blocks if Claude wraps in them
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      analysis = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse Claude response', raw: text }, { status: 500 })
    }

    return NextResponse.json(analysis)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
