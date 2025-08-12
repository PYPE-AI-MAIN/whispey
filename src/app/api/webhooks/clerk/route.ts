// Clerk Webhooks API - Mock Data Integration (No Database Required!)
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Get the headers
    const headerPayload = req.headers
    const svix_id = headerPayload.get("svix-id")
    const svix_timestamp = headerPayload.get("svix-timestamp")
    const svix_signature = headerPayload.get("svix-signature")

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new NextResponse('Error occured -- no svix headers', {
        status: 400
      })
    }

    // Get the body
    const payload = await req.json()
    const body = JSON.stringify(payload)

    // Mock: In a real app, you'd verify the webhook and update user data
    console.log('Mock: Clerk webhook received:', {
      type: payload.type,
      userId: payload.data?.id,
      email: payload.data?.email_addresses?.[0]?.email_address
    })

    // Mock: simulate user creation/update
    if (payload.type === 'user.created' || payload.type === 'user.updated') {
      const userData = payload.data
      console.log(`Mock: ${payload.type} for user ${userData.id}`)
      
      // In real app, you'd create/update user in database
      // MockDataService doesn't need this since it's static data
    }

    return new NextResponse('Mock: Webhook processed successfully', { status: 200 })
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new NextResponse('Error occured', {
      status: 400
    })
  }
}