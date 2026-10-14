'use client';

/**
 * The /sign-in page in Pype's brand (pypeai.com): indigo and coral, Plus Jakarta Sans,
 * the same headline as the main site, pill-shaped fields and a coral button.
 *
 * One page, one column: brand and a link to Pype at the top, the headline, one
 * line, the form, the access note, a footer. Light and dark (the glow dims in
 * dark). The only motion is the small waveform; it stops for people who ask
 * their system to reduce motion. Says nothing it cannot back up.
 */
import { ClerkLoaded, ClerkLoading, SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-sw-sans', display: 'swap' });

interface AuthPageProps {
  redirectUrl?: string
}

// Clerk's own CSS outranks Tailwind utilities, so its colours go through its variables.
const CLERK_VARIABLES = {
  light: { colorBackground: '#ffffff', colorText: '#1e0a52', colorTextSecondary: '#6b6485', colorInputBackground: '#ffffff', colorInputText: '#1e0a52', colorPrimary: '#4b0082', colorTextOnPrimaryBackground: '#ffffff', colorNeutral: '#1e0a52', borderRadius: '0.75rem', fontFamily: 'var(--font-satoshi), system-ui, sans-serif' },
  dark: { colorBackground: '#1e0a52', colorText: '#fff5f5', colorTextSecondary: '#b3a9d4', colorInputBackground: '#25105e', colorInputText: '#fff5f5', colorPrimary: '#ff6b6b', colorTextOnPrimaryBackground: '#1e0a52', colorNeutral: '#fff5f5', borderRadius: '0.75rem', fontFamily: 'var(--font-satoshi), system-ui, sans-serif' },
} as const;
const FIELD = {
  light: { background: 'rgba(255,255,255,0.88)', border: '1px solid #e3dcee', boxShadow: '0 6px 22px -12px rgba(30,10,82,0.3)' },
  dark: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: 'none' },
} as const;

const PAGE_CSS = `
  .sw-page { background:
      radial-gradient(60% 52% at 6% 4%, #f1e6fa 0%, rgba(241,230,250,0) 70%),
      radial-gradient(46% 46% at 96% 38%, #ffe9e6 0%, rgba(255,233,230,0) 70%),
      radial-gradient(54% 42% at 50% 104%, #f6eefb 0%, rgba(246,238,251,0) 70%),
      #fffafa;
    color: #1e0a52; font-family: var(--font-satoshi), system-ui, sans-serif; }
  .dark .sw-page { background:
      radial-gradient(60% 52% at 6% 4%, rgba(124,58,237,0.3) 0%, rgba(124,58,237,0) 70%),
      radial-gradient(46% 46% at 96% 38%, rgba(255,107,107,0.14) 0%, rgba(255,107,107,0) 70%),
      radial-gradient(54% 42% at 50% 104%, rgba(75,0,130,0.4) 0%, rgba(75,0,130,0) 70%),
      #1e0a52;
    color: #fff5f5; }
  .sw-title { font-family: var(--font-sw-sans), system-ui, sans-serif; font-weight: 700; color: #1e0a52;
    font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.08; letter-spacing: -0.03em; text-wrap: balance; }
  .dark .sw-title { color: #fff5f5; }
  .sw-em { color: #ff6b6b; }
  .sw-muted { color: #6b6485; } .dark .sw-muted { color: #b3a9d4; }
  .sw-link { color: #1e0a52; text-decoration: none; } .sw-link:hover { text-decoration: underline; text-underline-offset: 4px; }
  .dark .sw-link { color: #fff5f5; }
  .sw-bar { width: 3px; border-radius: 2px; background: linear-gradient(to top, #4b0082, #ff6b6b); transform-origin: center; animation: sw-bar 1.5s ease-in-out infinite; }
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
const WAVE_BARS = Array.from({ length: 34 }, (_, n) => {
  const shape = Math.sin((n / 33) * Math.PI) * (0.55 + 0.45 * Math.abs(Math.sin(n * 1.7)));
  return { id: `bar-${n}`, h: Math.max(6, Math.round(shape * 40)), delay: (n * 0.07) % 1.4 };
});

function Waveform() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px] align-middle" style={{ height: '1em', marginLeft: '0.3em' }}>
      {WAVE_BARS.map((bar) => (
        <span key={bar.id} className="sw-bar" style={{ height: bar.h, animationDelay: `${bar.delay}s` }} />
      ))}
    </span>
  );
}

const SKELETON_ROWS = ['google', 'email', 'continue'];

function FormSkeleton() {
  return (
    <output className="block space-y-4" aria-label="Loading the sign-in form">
      {SKELETON_ROWS.map((row) => (
        <div key={row} className="h-[3.25rem] animate-pulse rounded-full bg-card/70" />
      ))}
    </output>
  );
}

export default function AuthPage({ redirectUrl }: Readonly<AuthPageProps>) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const field = FIELD[mode];

  return (
    <div className={`${sans.variable} sw-page flex min-h-screen flex-col`}>
      <style>{PAGE_CSS}</style>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <Brand />
        <ThemeToggle />
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-3 text-center">
        <h1 className="sw-title">
          AI that answers every patient call <span className="sw-em">reliably.</span>
          <Waveform />
        </h1>
        <p className="sw-muted mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          Sign in to Whispey, where Pype&apos;s healthcare voice agents are built and every call is reviewed.
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
                    minHeight: '3.25rem', borderRadius: '999px', fontSize: '1rem', fontWeight: 600, border: 'none', color: '#1e0a52',
                    background: '#ff6b6b', boxShadow: '0 12px 28px -10px rgba(255,107,107,0.6)',
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
        <p className="border-t pt-4 text-center text-sm sw-muted" style={{ borderColor: 'rgba(75,0,130,0.14)' }}>
          © {new Date().getFullYear()} Pype
        </p>
      </footer>
    </div>
  );
}
