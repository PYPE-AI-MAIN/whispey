'use client';

/**
 * The /sign-in page, in the same visual family as Pype's Shortwire site: a soft
 * glow, an editorial serif headline with one italic blue word, pill-shaped fields,
 * and a gradient button, in Whispey's own blue.
 *
 * One page, one column: brand and a link to Pype at the top, the headline, one
 * line, the form, the access note, a footer. Light and dark (the glow dims in
 * dark). The only motion is the small waveform; it stops for people who ask
 * their system to reduce motion. Says nothing it cannot back up.
 */
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';
import { useTheme } from 'next-themes';

const serif = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-sw-serif', display: 'swap' });
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sw-sans', display: 'swap' });

interface AuthPageProps {
  redirectUrl?: string
}

// Clerk's own CSS outranks Tailwind utilities, so its colours go through its variables.
const CLERK_VARIABLES = {
  light: { colorBackground: '#ffffff', colorText: '#0b1b3b', colorTextSecondary: '#5b6b86', colorInputBackground: '#ffffff', colorInputText: '#0b1b3b', colorPrimary: '#1d4ed8', colorTextOnPrimaryBackground: '#ffffff', colorNeutral: '#0b1b3b', borderRadius: '0.75rem', fontFamily: 'var(--font-sw-sans), system-ui, sans-serif' },
  dark: { colorBackground: '#050a14', colorText: '#eef4ff', colorTextSecondary: '#9db0d0', colorInputBackground: '#0b1424', colorInputText: '#eef4ff', colorPrimary: '#60a5fa', colorTextOnPrimaryBackground: '#ffffff', colorNeutral: '#eef4ff', borderRadius: '0.75rem', fontFamily: 'var(--font-sw-sans), system-ui, sans-serif' },
} as const;
const FIELD = {
  light: { background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(37,99,235,0.16)', boxShadow: '0 6px 22px -12px rgba(30,64,160,0.35)' },
  dark: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: 'none' },
} as const;

const PAGE_CSS = `
  .sw-page { background:
      radial-gradient(60% 52% at 6% 4%, #d3e2ff 0%, rgba(211,226,255,0) 70%),
      radial-gradient(46% 46% at 96% 38%, #d9ecff 0%, rgba(217,236,255,0) 70%),
      radial-gradient(54% 42% at 50% 104%, #e6eeff 0%, rgba(230,238,255,0) 70%),
      #f8fbff;
    color: #0b1b3b; font-family: var(--font-sw-sans), system-ui, sans-serif; }
  .dark .sw-page { background:
      radial-gradient(60% 52% at 6% 4%, rgba(59,130,246,0.28) 0%, rgba(59,130,246,0) 70%),
      radial-gradient(46% 46% at 96% 38%, rgba(14,165,233,0.16) 0%, rgba(14,165,233,0) 70%),
      radial-gradient(54% 42% at 50% 104%, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0) 70%),
      #050a14;
    color: #eef4ff; }
  .sw-title { font-family: var(--font-sw-serif), Georgia, serif; font-weight: 400; color: #0b1b3b;
    font-size: clamp(2.3rem, 5.4vw, 4.1rem); line-height: 1.02; letter-spacing: -0.02em; }
  .dark .sw-title { color: #eef4ff; }
  .sw-em { font-style: italic; padding-right: 0.06em; color: transparent;
    background-image: linear-gradient(90deg, #1d4ed8, #3b82f6); -webkit-background-clip: text; background-clip: text; }
  .dark .sw-em { background-image: linear-gradient(90deg, #60a5fa, #7dd3fc); }
  .sw-muted { color: #5b6b86; } .dark .sw-muted { color: #9db0d0; }
  .sw-link { color: #0b1b3b; text-decoration: none; } .sw-link:hover { text-decoration: underline; text-underline-offset: 4px; }
  .dark .sw-link { color: #eef4ff; }
  .sw-bar { width: 3px; border-radius: 2px; background: linear-gradient(to top, #93c5fd, #7dd3fc); transform-origin: center; animation: sw-bar 1.5s ease-in-out infinite; }
  @keyframes sw-bar { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) { .sw-bar { animation: none; } }
`;

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" aria-label="Pype AI" className="rounded-md">
        <Image src="/logo-light.png" alt="" width={34} height={34} priority unoptimized className="dark:hidden" style={{ objectFit: 'contain' }} />
        <Image src="/logo-dark.png" alt="" width={34} height={34} priority unoptimized className="hidden dark:block" style={{ objectFit: 'contain' }} />
      </a>
      <div className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold leading-none">Whispey</span>
        <span className="sw-muted flex items-center gap-1.5 self-end">
          <span className="text-[11px] font-semibold">by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pype-wordmark.png" alt="Pype" style={{ height: '9px', width: 'auto' }} />
        </span>
      </div>
    </div>
  );
}

/** A short voice waveform: decoration for the headline, it carries no data. */
function Waveform() {
  const bars = Array.from({ length: 34 }, (_, i) => {
    const shape = Math.sin((i / 33) * Math.PI) * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7)));
    return { h: Math.max(6, Math.round(shape * 40)), delay: (i * 0.07) % 1.4 };
  });
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px] align-middle" style={{ height: '1em', marginLeft: '0.3em' }}>
      {bars.map((b, i) => (
        <span key={i} className="sw-bar" style={{ height: b.h, animationDelay: `${b.delay}s` }} />
      ))}
    </span>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading the sign-in form">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[3.25rem] animate-pulse rounded-full bg-white/70 dark:bg-white/10" />
      ))}
    </div>
  );
}

export default function AuthPage({ redirectUrl }: AuthPageProps) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const field = FIELD[mode];

  return (
    <div className={`${serif.variable} ${sans.variable} sw-page flex min-h-screen flex-col`}>
      <style>{PAGE_CSS}</style>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Brand />
        <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" className="sw-link text-sm font-medium">
          from <span className="font-semibold">Pype</span> ↗
        </a>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-3 text-center">
        <h1 className="sw-title">
          Create voice agents and see how patients <span className="sw-em">engage.</span>
          <Waveform />
        </h1>
        <p className="sw-muted mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          Build agents with Pype, then follow every call: what was said, how the patient responded, and what to fix.
        </p>

        <div className="mt-7 w-full max-w-md text-left">
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
                  socialButtonsBlockButton: { minHeight: '3.25rem', borderRadius: '999px', ...field },
                  formFieldInput: { minHeight: '3.25rem', borderRadius: '999px', padding: '0 1.25rem', fontSize: '1rem', ...field },
                  formButtonPrimary: {
                    minHeight: '3.25rem', borderRadius: '999px', fontSize: '1rem', fontWeight: 600, border: 'none', color: '#ffffff',
                    background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', boxShadow: '0 12px 28px -10px rgba(37,99,235,0.6)',
                  },
                },
                layout: { socialButtonsPlacement: 'top' },
              }}
              redirectUrl={redirectUrl ?? '/projects'}
            />
          </ClerkLoaded>
        </div>

        <p className="sw-muted mt-6 text-sm">Need access? Ask your team admin to invite you.</p>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-4 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm sw-muted" style={{ borderColor: 'rgba(37,99,235,0.14)' }}>
          <span>© {new Date().getFullYear()} <span className="font-semibold">Pype</span></span>
          <span>Whispey is built by <span className="font-semibold">Pype</span></span>
        </div>
      </footer>
    </div>
  );
}
