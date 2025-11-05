// src/app/api/email/notify-admins/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

// Loops.so transactional template IDs
// Get these from your Loops dashboard after creating templates
const LOOPS_TEMPLATE_IDS = {
  agent_permission: process.env.LOOPS_AGENT_PERMISSION_TEMPLATE_ID || '',
  phone_number_request: process.env.LOOPS_PHONE_NUMBER_TEMPLATE_ID || '',
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, description } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      )
    }

    if (!LOOPS_TEMPLATE_IDS[type as keyof typeof LOOPS_TEMPLATE_IDS]) {
      return NextResponse.json(
        { error: 'Invalid email type. Must be: agent_permission or phone_number_request' },
        { status: 400 }
      )
    }

    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user email and name from Clerk
    const userEmail = user.emailAddresses?.[0]?.emailAddress
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    const userName = `${firstName} ${lastName}`.trim() || userEmail || 'Unknown User'

    console.log('📧 Fetched user data from Clerk:')
    console.log('📧 User email:', userEmail)
    console.log('📧 User name:', userName)

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found in Clerk data' },
        { status: 400 }
      )
    }

    // Get admin emails from environment
    const adminEmails = process.env.PYPE_ADMINS?.split(',').map(email => email.trim()) || []
    
    if (adminEmails.length === 0) {
      console.error('No admin emails configured in PYPE_ADMINS environment variable')
      return NextResponse.json(
        { error: 'Admin emails not configured' },
        { status: 500 }
      )
    }

    // Get the Loops template ID for this email type
    const transactionalId = LOOPS_TEMPLATE_IDS[type as keyof typeof LOOPS_TEMPLATE_IDS]
    
    if (!transactionalId) {
      return NextResponse.json(
        { error: `Loops template ID not configured for type: ${type}. Please add ${type === 'agent_permission' ? 'LOOPS_AGENT_PERMISSION_TEMPLATE_ID' : 'LOOPS_PHONE_NUMBER_TEMPLATE_ID'} to your environment variables.` },
        { status: 500 }
      )
    }

    // Prepare data variables for Loops template
    const dataVariables = {
      userEmail,
      userName,
      requestType: type === 'agent_permission' ? 'Agent Creation Permission' : 'Incoming Phone Number',
      timestamp: new Date().toLocaleString(),
      description: description || 'No description provided',
    }

    console.log('📧 Sending emails via Loops with template:', transactionalId)

    // Send emails to all admins using Loops.so
    const emailPromises = adminEmails.map(async (adminEmail) => {
      try {
        const response = await fetch('https://app.loops.so/api/v1/transactional', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionalId: transactionalId,
            email: adminEmail,
            dataVariables: dataVariables,
            addToAudience: false, // Don't add admins to marketing audience
          }),
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error(`Failed to send email to ${adminEmail}:`, response.status, errorData)
          return { success: false, email: adminEmail, error: errorData }
        }

        const data = await response.json()
        console.log(`✅ Email sent successfully to ${adminEmail} via Loops`)
        return { success: true, email: adminEmail, response: data }
      } catch (error) {
        console.error(`Error sending email to ${adminEmail}:`, error)
        return { success: false, email: adminEmail, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Wait for all emails to be sent
    const results = await Promise.all(emailPromises)
    
    // Count successful sends
    const successfulSends = results.filter(result => result.success).length
    const failedSends = results.filter(result => !result.success)

    if (successfulSends === 0) {
      return NextResponse.json(
        { error: 'Failed to send emails to any admin', details: failedSends },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Emails sent to ${successfulSends}/${adminEmails.length} admins`,
      results: results,
      failedSends: failedSends.length > 0 ? failedSends : undefined
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in notify-admins API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}