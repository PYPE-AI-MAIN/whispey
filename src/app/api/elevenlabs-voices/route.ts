import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('ElevenLabs API route called')
  
  try {
    const apiKey = process.env.ELEVEN_API_KEY
    console.log('API Key exists:', !!apiKey)
    
    if (!apiKey) {
      console.error('ELEVEN_API_KEY not found in environment')
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    console.log('Making request to ElevenLabs for user voices...')
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs error response:', errorText)
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Log all voices to see the structure
    console.log('All voices:', JSON.stringify(data.voices, null, 2))
    
    // Filter to exclude only default voices (keep everything else that appears in "My Voices")
    const myVoices = data.voices?.filter((voice: any) => {
      // Exclude default/premade voices, keep everything else
      return voice.category !== 'premade'
    }) || []
    
    console.log('Total voices received:', data.voices?.length || 0)
    console.log('My voices filtered:', myVoices.length)
    console.log('My voices categories:', myVoices.map((v: any) => ({ name: v.name, category: v.category })))
    
    return NextResponse.json({ voices: myVoices }, { status: 200 })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch voices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}