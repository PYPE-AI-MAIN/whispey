import { redirect } from 'next/navigation'

// The Do Not Call list lives on Settings → Do Not Call (superadmins).
export default async function DncRedirect({ params }: Readonly<{ params: Promise<{ projectid: string }> }>) {
  const { projectid } = await params
  redirect(`/${projectid}/settings/users?tab=dnc`)
}
