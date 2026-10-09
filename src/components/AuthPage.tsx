'use client';

/**
 * The /sign-in page: a brand panel with one headline, and the form. Nothing else.
 * One focal point (the form), one accent (the app's blue), light and dark on the
 * form side, one column on a phone. Wording follows what Pype AI does (voice
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
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const border = BORDER[mode];

  return (
    <div className="flex min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Brand panel: desktop only. Headline, one line, and the real product, bleeding off the corner. */}
      <aside className="relative hidden overflow-hidden text-slate-100 lg:flex lg:w-[48%] lg:flex-col lg:pl-14 xl:pl-20" style={{ background: '#060b16' }}>
        <div className="pr-14 pt-12 xl:pr-20">
          <Brand tone="on-dark" size="lg" />
        </div>

        <div className="fade-up max-w-lg pr-14 pt-14 xl:pr-20">
          <h1 className="font-semibold text-white" style={{ fontSize: 'clamp(2rem, 2.9vw, 2.75rem)', lineHeight: 1.12, letterSpacing: '-0.025em' }}>
            Create voice agents and see how patients engage.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-300">
            Build agents with Pype, then follow every call: what was said, how the patient responded, and what to fix.
          </p>
        </div>

        {/* A real screenshot of the call logs (numbers and emails blurred), cropped by the panel edge. */}
        <figure className="fade-up mt-auto pt-12" style={{ animationDelay: '150ms' }}>
          <div className="overflow-hidden rounded-tl-xl border-l border-t" style={{ borderColor: 'rgba(148,163,184,0.18)' }}>
            <Image
              src="/sign-in-preview.webp"
              alt="Whispey call logs: completed calls with their duration, and one call flagged with a note"
              width={1230}
              height={504}
              priority
              unoptimized
              className="block h-auto max-w-none"
              style={{ width: '106%' }}
            />
          </div>
        </figure>

        <style>{`
          @keyframes fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
          .fade-up { animation: fade-up 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
          @media (prefers-reduced-motion: reduce) { .fade-up { animation: none; } }
        `}</style>
      </aside>

      {/* Sign in: the focal point */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Brand tone="adaptive" size="md" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in to Whispey</h2>

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

          <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
            Need access? Ask your team admin to invite you.
          </p>
        </div>
      </div>
    </div>
  );
}
