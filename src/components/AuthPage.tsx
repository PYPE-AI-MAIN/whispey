'use client';

/**
 * The /sign-in page: one centered column. Logo, a heading, one line, the form.
 * Nothing else. Light and dark, and the same on a phone. Wording follows what Pype AI does (voice
 * agents for hospitals and clinics) and claims nothing it cannot back up.
 */
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface AuthPageProps {
  redirectUrl?: string
}

// Clerk's own CSS outranks Tailwind utilities, so its colours go through its variables.
const CLERK_VARIABLES = {
  light: { colorBackground: '#ffffff', colorText: '#0f172a', colorTextSecondary: '#475569', colorInputBackground: '#ffffff', colorInputText: '#0f172a', colorPrimary: '#0f172a', colorTextOnPrimaryBackground: '#ffffff', colorNeutral: '#0f172a', borderRadius: '0.5rem' },
  dark: { colorBackground: '#020617', colorText: '#f1f5f9', colorTextSecondary: '#94a3b8', colorInputBackground: '#0f172a', colorInputText: '#f1f5f9', colorPrimary: '#f1f5f9', colorTextOnPrimaryBackground: '#0f172a', colorNeutral: '#f1f5f9', borderRadius: '0.5rem' },
} as const;
const BORDER = { light: '#cbd5e1', dark: '#334155' } as const;

function Brand({ tone, size }: Readonly<{ tone: 'on-dark' | 'adaptive'; size: 'lg' | 'md' }>) {
  const logo = size === 'lg' ? 40 : 32;
  const name = tone === 'on-dark' ? 'text-white' : 'text-slate-900 dark:text-slate-100';
  const by = tone === 'on-dark' ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400';
  return (
    <div className="flex items-center gap-3">
      <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" aria-label="Pype AI" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
        {tone === 'on-dark' ? (
          <Image src="/logo-dark.png" alt="" width={logo} height={logo} priority unoptimized style={{ objectFit: 'contain' }} />
        ) : (
          <>
            <Image src="/logo-light.png" alt="" width={logo} height={logo} priority unoptimized className="dark:hidden" style={{ objectFit: 'contain' }} />
            <Image src="/logo-dark.png" alt="" width={logo} height={logo} priority unoptimized className="hidden dark:block" style={{ objectFit: 'contain' }} />
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
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const border = BORDER[mode];

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Brand tone="adaptive" size="lg" />
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in to Whispey</h1>
        <p className="mt-2 text-center text-base text-slate-600 dark:text-slate-400">
          Create voice agents and see how patients engage.
        </p>

        <div className="mt-8">
            <ClerkLoading>
              <FormSkeleton />
            </ClerkLoading>
            <ClerkLoaded>
              <SignIn
                routing="hash"
                appearance={{
                  variables: CLERK_VARIABLES[mode],
                  elements: {
                    rootBox: { width: '100%' },
                    cardBox: { width: '100%', border: 'none', boxShadow: 'none', background: 'transparent' },
                    card: { width: '100%', padding: 0, border: 'none', boxShadow: 'none', background: 'transparent' },
                    footer: { background: 'transparent' },
                    headerTitle: { display: 'none' },
                    headerSubtitle: { display: 'none' },
                    socialButtonsBlockButton: { minHeight: '3rem', boxShadow: 'none', border: `1px solid ${border}` },
                    formFieldInput: { minHeight: '3rem', fontSize: '1rem', boxShadow: 'none', border: `1px solid ${border}` },
                    formButtonPrimary: { minHeight: '3rem', fontSize: '1rem', fontWeight: 500, boxShadow: 'none' },
                  },
                  layout: { socialButtonsPlacement: 'top' },
                }}
                redirectUrl={redirectUrl ?? '/projects'}
              />
            </ClerkLoaded>
        </div>

        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Need access? Ask your team admin to invite you.
        </p>
      </div>
    </div>
  );
}
