// src/app/sign-in/page.tsx
import AuthPage from "@/components/AuthPage";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const params = await searchParams
  return <AuthPage redirectUrl={params.redirect_url} />
}
