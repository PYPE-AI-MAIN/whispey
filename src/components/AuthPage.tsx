'use client';

/**
 * The /sign-in page. Same wording as before; the design is calmer and plainer:
 * a flat dark brand panel (no gradient or pattern), the form as the one focal
 * point, one accent (the app's blue), light and dark on the form side, and a
 * single column on a phone. Features are hairline rows, not icon tiles.
 */
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface AuthPageProps {
  redirectUrl?: string
}

const FEATURES = [
  { title: 'Smart Transcription', body: 'Real-time voice-to-text with context awareness' },
  { title: 'Instant Insights', body: 'AI-powered analysis and action items' },
  { title: 'Completely Private', body: 'Open Source' },
];

// Clerk's own CSS outranks Tailwind utilities, so colours go through its variables.
const CLERK_VARIABLES = {
  light: { colorBackground: '#ffffff', colorText: '#0f172a', colorTextSecondary: '#475569', colorInputBackground: '#ffffff', colorInputText: '#0f172a', colorPrimary: '#0f172a', colorTextOnPrimaryBackground: '#ffffff', colorNeutral: '#0f172a', borderRadius: '0.5rem' },
  dark: { colorBackground: '#020617', colorText: '#f1f5f9', colorTextSecondary: '#94a3b8', colorInputBackground: '#0f172a', colorInputText: '#f1f5f9', colorPrimary: '#f1f5f9', colorTextOnPrimaryBackground: '#0f172a', colorNeutral: '#f1f5f9', borderRadius: '0.5rem' },
} as const;

function Brand({ tone, size }: Readonly<{ tone: 'on-dark' | 'adaptive'; size: 'lg' | 'md' }>) {
  const logo = size === 'lg' ? 40 : 32;
  const name = tone === 'on-dark' ? 'text-slate-100' : 'text-slate-900 dark:text-slate-100';
  const by = tone === 'on-dark' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <div className="flex items-center gap-3">
      <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" aria-label="Pype AI" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
        {tone === 'on-dark' ? (
          <Image src="/logo-dark.png" alt="" width={logo} height={logo} style={{ objectFit: 'contain' }} />
        ) : (
          <>
            <Image src="/logo-light.png" alt="" width={logo} height={logo} className="dark:hidden" style={{ objectFit: 'contain' }} />
            <Image src="/logo-dark.png" alt="" width={logo} height={logo} className="hidden dark:block" style={{ objectFit: 'contain' }} />
          </>
        )}
      </a>
      <div className="flex flex-col gap-1.5">
        <span className={`font-semibold leading-none ${name} ${size === 'lg' ? 'text-xl' : 'text-lg'}`}>Whispey</span>
        <span className="flex items-center gap-1.5 self-end">
          <span className={`text-[11px] font-semibold ${by}`}>by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pype-wordmark.png" alt="Pype" style={{ height: size === 'lg' ? '10px' : '9px', width: 'auto' }} />
        </span>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading the sign-in form">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export default function AuthPage({ redirectUrl }: AuthPageProps) {
  const { resolvedTheme } = useTheme();
  const variables = CLERK_VARIABLES[resolvedTheme === 'dark' ? 'dark' : 'light'];
  return (
    <div className="flex min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Brand panel: desktop only, always dark so the logo reads the same in both themes */}
      <aside className="hidden border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:px-14 lg:py-12 xl:px-20">
        <Brand tone="on-dark" size="lg" />

        <div className="max-w-lg py-16">
          <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight text-white">
            Monitor your LiveKit Voice AI agents.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Join hundreds of engineers and get complete observability into your Voice AI Applications.
          </p>

          <dl className="mt-12 divide-y divide-slate-800 border-y border-slate-800">
            {FEATURES.map((f) => (
              <div key={f.title} className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="font-semibold text-slate-100">{f.title}</dt>
                <dd className="text-slate-400">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <span aria-hidden="true" />
      </aside>

      {/* Form side: the focal point */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Brand tone="adaptive" size="md" />
          </div>

          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Welcome back</h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">Sign in to your account to continue</p>

          <div className="mt-8">
            <ClerkLoading>
              <FormSkeleton />
            </ClerkLoading>
            <ClerkLoaded>
              <SignIn
                routing="hash"
                appearance={{
                  variables,
                  elements: {
                    rootBox: { width: '100%' },
                    cardBox: { width: '100%', border: 'none', boxShadow: 'none', background: 'transparent' },
                    card: { width: '100%', padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' },
                    footer: { background: 'transparent' },
                    headerTitle: { display: 'none' },
                    headerSubtitle: { display: 'none' },
                    socialButtonsBlockButton: { minHeight: '3rem', boxShadow: 'none' },
                    formFieldInput: { minHeight: '3rem', fontSize: '1rem', boxShadow: 'none' },
                    formButtonPrimary: { minHeight: '3rem', fontSize: '1rem', fontWeight: 500, boxShadow: 'none' },
                  },
                  layout: { socialButtonsPlacement: 'top' },
                }}
                redirectUrl={redirectUrl ?? '/projects'}
              />
            </ClerkLoaded>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
            <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
              <span>Secure</span>
              <span>Open Source</span>
            </p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">Protected by industry-leading security standards</p>
          </div>
        </div>
      </div>
    </div>
  );
}
