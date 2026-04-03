interface InviteEmailParams {
  email: string
  orgName: string
  inviteLink: string
  isExistingUser: boolean
}

export async function sendInviteEmail({
  email,
  orgName,
  inviteLink,
  isExistingUser,
}: InviteEmailParams): Promise<void> {
  const transactionalId = isExistingUser
    ? process.env.LOOPS_EXISTING_USER_INVITE_TEMPLATE_ID
    : process.env.LOOPS_NEW_USER_INVITE_TEMPLATE_ID

  if (!transactionalId) {
    throw new Error(
      `Loops template ID not configured: ${
        isExistingUser
          ? 'LOOPS_EXISTING_USER_INVITE_TEMPLATE_ID'
          : 'LOOPS_NEW_USER_INVITE_TEMPLATE_ID'
      }`
    )
  }

  if (!process.env.LOOPS_API_KEY) {
    throw new Error('LOOPS_API_KEY not configured')
  }

  const response = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transactionalId,
      email,
      dataVariables: { orgName, inviteLink },
      addToAudience: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Loops API error ${response.status}: ${errorText}`)
  }
}
