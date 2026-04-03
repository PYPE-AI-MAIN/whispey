import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const { userId } = await auth()
  const supabase = createServiceRoleClient()

  const { data: mapping } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('project_id')
    .eq('invite_token', token)
    .eq('is_active', true)
    .maybeSingle()

  // Invalid or expired token — show error page (works for unauthenticated users too)
  if (!mapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">🔗</div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Invalid Invite Link
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            This invite link is invalid or has expired. Please ask your admin to send a new invite.
          </p>
          <a
            href="/sign-in"
            className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    )
  }

  const projectPath = `/${mapping.project_id}/agents`

  if (userId) {
    redirect(projectPath)
  }

  // Build full absolute URL so Clerk can redirect correctly after sign-in/sign-up
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.whispey.xyz').replace(/\/$/, '')
  const fullRedirectUrl = `${appUrl}${projectPath}`
  redirect(`/sign-in?redirect_url=${encodeURIComponent(fullRedirectUrl)}`)
}
