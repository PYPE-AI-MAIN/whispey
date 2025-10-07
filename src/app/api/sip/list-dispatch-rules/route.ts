// src/app/api/sip/list-dispatch-rules/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 })
    }

    const response = await fetch(`${apiUrl}/dispatch_rule_numbers`, {
      method: 'GET',
      headers: {
        'x-api-key': 'pype-api-v1',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to fetch dispatch rules: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ dispatch_rules: data.dispatch_rule_numbers })

  } catch (error: any) {
    console.error('List dispatch rules error:', error)
    return NextResponse.json(
      { error: 'Failed to list dispatch rules', details: error.message },
      { status: 500 }
    )
  }
}