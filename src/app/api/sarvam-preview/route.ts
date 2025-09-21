import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    console.log('Sarvam preview API called')
    
    try {
      const { text, speaker, model } = await request.json()
      console.log('Request data:', { text, speaker, model })
      
      const apiKey = process.env.SARVAM_API_KEY
      console.log('Sarvam API Key exists:', !!apiKey)
      
      if (!apiKey) {
        throw new Error('SARVAM_API_KEY not found')
      }
      
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': apiKey,
        },
        body: JSON.stringify({ 
          inputs: [text], 
          speaker, 
          model 
        })
      })
      
      console.log('Sarvam API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Sarvam API error:', errorText)
        throw new Error(`Sarvam API failed: ${response.status}`)
      }
      
      return new Response(await response.blob(), {
        headers: { 'Content-Type': 'audio/wav' }
      })
    } catch (error: any) {
      console.error('Sarvam preview error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }