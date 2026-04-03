// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

interface ClerkWebhookEvent {
  data: {
    id: string
    email_addresses: Array<{
      email_address: string
      id: string
    }>
    first_name: string | null
    last_name: string | null
    image_url: string | null
    username: string | null
  }
  type: string
}


export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('🎯 Webhook received')
  
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ Missing CLERK_WEBHOOK_SIGNING_SECRET')
    return new NextResponse('Missing webhook secret', { status: 500 })
  }

  const supabase = createServiceRoleClient()
  
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('❌ Missing svix headers')
    return new NextResponse('Error occurred -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  console.log('📝 Webhook payload type:', payload.type)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: ClerkWebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error('❌ Error verifying webhook:', err)
    return new NextResponse('Error occurred during verification', {
      status: 400,
    })
  }

  const { id } = evt.data
  const eventType = evt.type

  console.log(`🔄 Processing ${eventType} for user ${id}`)

  try {
    if (eventType === 'user.created') {
      const { email_addresses, first_name, last_name, image_url } = evt.data
      const userEmail = email_addresses[0]?.email_address || ''

      console.log('✅ Creating new user in database')

      const { data, error } = await supabase.from('pype_voice_users').insert({
        clerk_id: id,
        email: userEmail,
        first_name: first_name,
        last_name: last_name,
        profile_image_url: image_url,
      }).select().single()

      if (error) {
        console.error('❌ Error creating user in Supabase:', error)
        return new NextResponse('Error creating user', { status: 500 })
      }

      console.log('🎉 User created successfully:', data)

      // Link any pending invite mappings for this email
      // Non-fatal — user still has access via email-based lookup even if this fails
      try {
        const { error: linkError } = await supabase
          .from('pype_voice_email_project_mapping')
          .update({ clerk_id: id })
          .eq('email', userEmail)
          .is('clerk_id', null)
          .eq('is_active', true)

        if (linkError) {
          console.error('⚠️ Failed to link pending invites for', userEmail, linkError)
        } else {
          console.log('🔗 Linked pending invites for', userEmail)
        }
      } catch (linkErr) {
        console.error('⚠️ Error linking pending invites for', userEmail, linkErr)
      }
    }

    if (eventType === 'user.updated') {
      const { email_addresses, first_name, last_name, image_url } = evt.data

      console.log('📝 Updating user in database')

      const { data, error } = await supabase
        .from('pype_voice_users')
        .update({
          email: email_addresses[0]?.email_address || '',
          first_name: first_name,
          last_name: last_name,
          profile_image_url: image_url,
          updated_at: new Date().toISOString(),
        })
        .eq('clerk_id', id)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating user in Supabase:', error)
        return new NextResponse('Error updating user', { status: 500 })
      }

      console.log('📝 User updated successfully:', data)
    }

    if (eventType === 'user.deleted') {
      console.log('🗑️ Deleting user from database')

      const { error } = await supabase
        .from('pype_voice_users')
        .delete()
        .eq('clerk_id', id)

      if (error) {
        console.error('❌ Error deleting user from Supabase:', error)
        return new NextResponse('Error deleting user', { status: 500 })
      }

      console.log('🗑️ User deleted successfully')
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }

  console.log('✅ Webhook processed successfully')
  return new NextResponse('Webhook processed successfully', { status: 200 })
}