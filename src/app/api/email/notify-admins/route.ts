// src/app/api/email/notify-admins/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'

// Email templates
const EMAIL_TEMPLATES: Record<'agent_permission' | 'phone_number_request', { subject: string; html: (userEmail: string, userName: string, description?: string) => string }> = {
  agent_permission: {
    subject: 'Agent Creation Permission Request',
    html: (userEmail: string, userName: string, description?: string) => {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Agent Creation Permission Request</h2>
          <p>Hello,</p>
          <p>I would like to request permission to create an agent for monitoring purposes.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Requested by:</strong> ${userName} (${userEmail})</p>
            <p><strong>Request Type:</strong> Agent Creation Permission</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            ${description ? `<p><strong>Description:</strong><br>${description}</p>` : ''}
          </div>
          <p>Please review and approve this request in the admin dashboard.</p>
          <p>Best regards,<br>${userName}</p>
        </div>
      `
    }
  },
  phone_number_request: {
    subject: 'Phone Number Request',
    html: (userEmail: string, userName: string, description?: string) => {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Phone Number Request</h2>
          <p>Hello,</p>
          <p>I would like to request an incoming phone number for my voice agent.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Requested by:</strong> ${userName} (${userEmail})</p>
            <p><strong>Request Type:</strong> Incoming Phone Number</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            ${description ? `<p><strong>Description:</strong><br>${description}</p>` : ''}
          </div>
          <p>Please review and assign a phone number in the admin dashboard.</p>
          <p>Best regards,<br>${userName}</p>
        </div>
      `
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body - email type and optional description
    const body = await request.json()
    const { type, description } = body

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      )
    }

    // Validate email type
    if (!EMAIL_TEMPLATES[type as keyof typeof EMAIL_TEMPLATES]) {
      return NextResponse.json(
        { error: 'Invalid email type. Must be: agent_permission or phone_number_request' },
        { status: 400 }
      )
    }

    // Fetch user data from Clerk
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

    // Get email template
    const template = EMAIL_TEMPLATES[type as keyof typeof EMAIL_TEMPLATES]
    const subject = template.subject
    const html = template.html(userEmail, userName, description)

    // Send emails to all admins
    const emailPromises = adminEmails.map(async (adminEmail) => {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Pype AI Notifications <onboarding@resend.dev>', // ✅ safe sender
            to: [adminEmail],
            subject: subject,
            html: html,
            reply_to: userEmail, // ✅ so admin can reply to the actual requester
          }),
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error(`Failed to send email to ${adminEmail}:`, response.status, errorData)
          return { success: false, email: adminEmail, error: errorData }
        }

        const data = await response.json()
        console.log(`Email sent successfully to ${adminEmail}:`, data.id)
        return { success: true, email: adminEmail, messageId: data.id }
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
