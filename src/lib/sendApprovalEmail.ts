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
  approveLink,
  declineLink,
}: {
  adminEmails: string[]
  userEmail: string
  userName: string
  approveLink: string
  declineLink: string
}): Promise<void> {
  const transactionalId = process.env.LOOPS_PENDING_ADMIN_NOTICE_TEMPLATE_ID
  await Promise.all(
    adminEmails.map((adminEmail) =>
      sendLoopsEmail(transactionalId, adminEmail, { userEmail, userName, approveLink, declineLink }).catch((err) =>
        console.error(`[approval-email] Failed to notify admin ${adminEmail}:`, err)
      )
    )
  )
}

export async function sendAccountApprovedEmail({
  email,
  appLink,
}: {
  email: string
  appLink: string
}): Promise<void> {
  await sendLoopsEmail(process.env.LOOPS_ACCOUNT_APPROVED_TEMPLATE_ID, email, { appLink })
}

export async function sendAccountDeclinedEmail({ email }: { email: string }): Promise<void> {
  await sendLoopsEmail(process.env.LOOPS_ACCOUNT_DECLINED_TEMPLATE_ID, email, {})
}

// Shared by the Clerk webhook and the /api/user/create fallback so a pending
// signup always notifies admins, whichever path created the row.
export async function notifyAdminsOfPendingSignup({
  rowId,
  approvalToken,
  userEmail,
  userName,
}: {
  rowId: string
  approvalToken: string
  userEmail: string
  userName: string
}): Promise<void> {
  try {
    const adminEmails = process.env.APPROVAL_NOTICE_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) ?? []
    if (adminEmails.length === 0) {
      console.warn('APPROVAL_NOTICE_EMAILS not configured — skipping pending-approval notice')
      return
    }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')
    const base = `${appUrl}/api/admin/pending-users/${rowId}/action?token=${approvalToken}`
    await sendPendingApprovalNotice({
      adminEmails,
      userEmail,
      userName: userName || userEmail,
      approveLink: `${base}&decision=approve`,
      declineLink: `${base}&decision=decline`,
    })
  } catch (err) {
    console.error('Failed to notify admins of pending signup:', err)
  }
}
