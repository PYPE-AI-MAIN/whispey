import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  
  try {
    const apiKey = process.env.ELEVEN_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    const myVoices = data.voices?.filter((voice: any) => {
      return voice.category !== 'premade'
    }) || []
    
    return NextResponse.json({ voices: myVoices }, { status: 200 })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch voices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}