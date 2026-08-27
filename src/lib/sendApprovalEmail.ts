// Loops.so transactional emails for the new-domain signup-approval gate.
// Same fetch pattern as sendInviteEmail.ts — no new dependency.

async function sendLoopsEmail(transactionalId: string | undefined, email: string, dataVariables: Record<string, string>) {
  if (!transactionalId) {
    console.warn(`[approval-email] Missing Loops template id for ${email} — skipping send`)
    return
  }
  if (!process.env.LOOPS_API_KEY) {
    console.warn('[approval-email] LOOPS_API_KEY not configured — skipping send')
    return
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transactionalId, email, dataVariables, addToAudience: false }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Loops API error ${response.status}: ${errorText}`)
  }
}

export async function sendPendingApprovalNotice({
  adminEmails,
  userEmail,
  userName,
  reviewLink,
}: {
  adminEmails: string[]
  userEmail: string
  userName: string
  reviewLink: string
}): Promise<void> {
  const transactionalId = process.env.LOOPS_PENDING_ADMIN_NOTICE_TEMPLATE_ID
  await Promise.all(
    adminEmails.map((adminEmail) =>
      sendLoopsEmail(transactionalId, adminEmail, { userEmail, userName, reviewLink }).catch((err) =>
        console.error(`[approval-email] Failed to notify admin ${adminEmail}:`, err)
      )
    )
  )
}

export async function sendAccountApprovedEmail({
  email,
  orgName,
  appLink,
}: {
  email: string
  orgName: string
  appLink: string
}): Promise<void> {
  await sendLoopsEmail(process.env.LOOPS_ACCOUNT_APPROVED_TEMPLATE_ID, email, { orgName, appLink })
}

export async function sendAccountDeclinedEmail({ email }: { email: string }): Promise<void> {
  await sendLoopsEmail(process.env.LOOPS_ACCOUNT_DECLINED_TEMPLATE_ID, email, {})
}
