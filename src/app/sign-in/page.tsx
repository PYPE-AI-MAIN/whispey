// src/app/sign-in/page.tsx
import type { Metadata } from "next";
import AuthPage from "@/components/AuthPage";

export const metadata: Metadata = {
  title: "Sign in | Whispey",
  description: "Sign in to Whispey, the observability platform from Pype AI.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const params = await searchParams
  return <AuthPage redirectUrl={params.redirect_url} />
}
