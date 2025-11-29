import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Read from local JSON file instead of API
    const filePath = join(process.cwd(), 'google_voices.json')
    const fileContents = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContents)
    
    // Filter to only include voices with "Chirp3-HD" in the name
    const allVoices = data.voices || []
    const chirp3HDVoices = allVoices.filter((voice: any) => 
      voice.name && voice.name.includes('Chirp3-HD')
    )
    
    // Transform Google TTS voices to a consistent format
    const voices = chirp3HDVoices.map((voice: any) => ({
      name: voice.name,
      languageCodes: voice.languageCodes || [],
      ssmlGender: voice.ssmlGender || 'NEUTRAL',
      naturalSampleRateHertz: voice.naturalSampleRateHertz || 24000,
      // For display purposes
      displayName: voice.name,
      primaryLanguage: voice.languageCodes?.[0] || 'en-US',
      gender: voice.ssmlGender === 'FEMALE' ? 'Female' : voice.ssmlGender === 'MALE' ? 'Male' : 'Neutral'
    }))
    
    return NextResponse.json({ voices }, { status: 200 })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch Google TTS voices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

