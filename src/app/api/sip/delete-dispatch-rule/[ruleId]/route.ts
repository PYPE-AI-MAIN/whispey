// src/app/api/sip/delete-dispatch-rule/[ruleId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params
    const apiUrl = process.env.PYPEAI_API_URL
    
    if (!apiUrl) {
      return NextResponse.json({ error: 'API configuration error' }, { status: 500 })
    }

    const response = await fetch(`${apiUrl}/delete_sip_dispatch_rule/${ruleId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': 'pype-api-v1',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Failed to delete dispatch rule: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Delete dispatch rule error:', error)
    return NextResponse.json(
      { error: 'Failed to delete dispatch rule', details: error.message },
      { status: 500 }
    )
  }
}