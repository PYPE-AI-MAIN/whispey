
// /app/api/vapi/calls/route.ts
import { decrypt } from '@/lib/crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('📞 POST /api/vapi/calls called')
  
  try {
    const body = await request.json()
    console.log('📋 Call request body:', body)
    
    // Get authentication from request headers
    const apiKey = request.headers.get('x-vapi-api-key')
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vapi API key required in x-vapi-api-key header' },
        { status: 401 }
      )
    }

    // Decrypt the API key
    let vapiToken: string
    try {
      vapiToken = decrypt(apiKey)
    } catch (err) {
      console.error('❌ Failed to decrypt Vapi API key:', err)
      return NextResponse.json(
        { error: 'Invalid or corrupted API key' },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!body.assistantId) {
      return NextResponse.json(
        { error: 'Assistant ID is required' },
        { status: 400 }
      )
    }

    if (!body.customer?.number) {
      return NextResponse.json(
        { error: 'Customer phone number is required' },
        { status: 400 }
      )
    }

    // Phone number validation
    if (!body.customer.number.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include country code (e.g., +1 or +91)' },
        { status: 400 }
      )
    }

    const phoneNumber = body.customer.number
    const isValidUS = phoneNumber.startsWith('+1') && phoneNumber.replace(/\D/g, '').length === 11
    const isValidIndia = phoneNumber.startsWith('+91') && phoneNumber.replace(/\D/g, '').length === 12
    
    if (!isValidUS && !isValidIndia) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use valid US (+1) or India (+91) phone number.' },
        { status: 400 }
      )
    }

    // Construct call payload
    const callPayload = {
      type: body.type || 'outboundPhoneCall',
      assistantId: body.assistantId,
      customer: {
        number: body.customer.number,
        ...(body.customer.name && { name: body.customer.name })
      },
      ...(body.phoneNumberId && { phoneNumberId: body.phoneNumberId }),
      ...(body.assistantOverrides && { assistantOverrides: body.assistantOverrides })
    }

    console.log('🚀 Sending call request to Vapi:', callPayload)

    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload),
    })

    const responseText = await response.text()
    console.log('📡 Vapi raw response:', responseText)

    if (!response.ok) {
      console.error('❌ Vapi API error:', response.status, responseText)
      
      let errorMessage = `Failed to initiate call: ${response.status}`
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (e) {
        if (responseText) {
          errorMessage = responseText
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    let callData
    try {
      callData = JSON.parse(responseText)
    } catch (e) {
      console.error('💥 Failed to parse Vapi response:', e)
      return NextResponse.json(
        { error: 'Invalid response from Vapi API' },
        { status: 500 }
      )
    }

    console.log('✅ Successfully initiated call:', callData?.id || 'unknown ID')
    
    return NextResponse.json({ 
      success: true,
      call: callData,
      message: 'Call initiated successfully'
    })

  } catch (error) {
    console.error('💥 Unexpected error in call API:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}


