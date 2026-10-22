import { currentUser } from '@clerk/nextjs/server'

/** Chats are matched on the Clerk user id, or on the signed-in user's verified primary email (covers chats saved under an older login id). */
export async function verifiedEmail(): Promise<string | null> {
  const user = await currentUser()
  const primary = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId) ?? user?.emailAddresses?.[0]
  return primary?.verification?.status === 'verified' ? primary.emailAddress.toLowerCase() : null
}

export const ownsSession = (row: { user_id?: string | null; user_email?: string | null }, userId: string, email: string | null) =>
  row.user_id === userId || (!!email && row.user_email?.toLowerCase() === email)
