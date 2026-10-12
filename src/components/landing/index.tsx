'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google'
import Header, { Brand } from './landing-header'

const serif = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-sw-serif', display: 'swap' })
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sw-sans', display: 'swap' })

const FEATURES = [
  { title: 'Call logs and recordings', body: 'Open any call to read the transcript, hear the recording and follow each turn of the conversation.' },
  { title: 'Latency and cost', body: 'See how long the agent took to respond on every turn, and what each call cost.' },
  { title: 'QA Audit', body: 'Flag a call that went wrong. The Pype QA team reviews it and updates the status. You can also ask for a weekly review of an agent.' },
  { title: 'Bug reports', body: 'Report a problem by voice during a test call, then find it later alongside that call in the logs.' },
]

const STEPS = [
  { title: 'Install the SDK', body: 'Add Whispey to your agent project.', code: 'pip install whispey' },
  { title: 'Connect your agent', body: 'Create the observer with your agent ID and API key. Whispey works with LiveKit agents.', code: 'whispey = LivekitObserve(\n  agent_id="your-agent-id",\n  apikey=os.getenv("WHISPEY_API_KEY")\n)' },
  { title: 'Start a session', body: 'Start tracking when the call begins. Calls then appear in your dashboard.', code: 'session_id = whispey.start_session(\n  session=session\n)' },
]

const PAGE_CSS = `
  .wl-page { background:
      radial-gradient(60% 40% at 6% 0%, #d3e2ff 0%, rgba(211,226,255,0) 70%),
      radial-gradient(46% 36% at 96% 22%, #d9ecff 0%, rgba(217,236,255,0) 70%),
      #f8fbff;
    color: #0b1b3b; font-family: var(--font-sw-sans), system-ui, sans-serif; }
  .dark .wl-page { background:
      radial-gradient(60% 40% at 6% 0%, rgba(59,130,246,0.26) 0%, rgba(59,130,246,0) 70%),
      radial-gradient(46% 36% at 96% 22%, rgba(14,165,233,0.14) 0%, rgba(14,165,233,0) 70%),
      #050a14;
    color: #eef4ff; }
  .wl-header { background: rgba(248,251,255,0.82); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(37,99,235,0.1); }
  .dark .wl-header { background: rgba(5,10,20,0.78); border-bottom-color: rgba(255,255,255,0.08); }
  .wl-title { font-family: var(--font-sw-serif), Georgia, serif; font-weight: 400; letter-spacing: -0.02em; line-height: 1.04; }
  .wl-h1 { font-size: clamp(2.5rem, 6vw, 4.6rem); }
  .wl-h2 { font-size: clamp(1.9rem, 3.6vw, 2.8rem); }
  .wl-em { font-style: italic; padding-right: 0.06em; color: transparent;
    background-image: linear-gradient(90deg, #1d4ed8, #3b82f6); -webkit-background-clip: text; background-clip: text; }
  .dark .wl-em { background-image: linear-gradient(90deg, #60a5fa, #7dd3fc); }
  .wl-muted { color: #5b6b86; } .dark .wl-muted { color: #9db0d0; }
  .wl-link { color: #0b1b3b; text-decoration: none; } .wl-link:hover { text-decoration: underline; text-underline-offset: 4px; }
  .dark .wl-link { color: #eef4ff; }
  .wl-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; color: #fff; font-weight: 600;
    background: linear-gradient(90deg, #1d4ed8, #3b82f6); padding: 0.8rem 1.6rem; font-size: 0.95rem;
    box-shadow: 0 10px 24px -12px rgba(29,78,216,0.75); transition: transform .15s ease, box-shadow .15s ease; }
  .wl-btn:hover { transform: translateY(-1px); } .wl-btn:disabled { opacity: .6; }
  .wl-btn-sm { padding: 0.5rem 1.1rem; font-size: 0.85rem; }
  .wl-btn-ghost { background: transparent; color: #0b1b3b; box-shadow: none; border: 1px solid rgba(37,99,235,0.25); }
  .dark .wl-btn-ghost { color: #eef4ff; border-color: rgba(255,255,255,0.22); }
  .wl-rule { border-top: 1px solid rgba(37,99,235,0.14); } .dark .wl-rule { border-top-color: rgba(255,255,255,0.1); }
  .wl-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; line-height: 1.6; overflow-x: auto;
    background: rgba(255,255,255,0.75); border: 1px solid rgba(37,99,235,0.14); border-radius: 12px; padding: 0.9rem 1rem; }
  .dark .wl-code { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
  .wl-frame { border-radius: 18px; border: 1px solid rgba(37,99,235,0.18); box-shadow: 0 30px 70px -34px rgba(30,64,160,0.55); overflow: hidden; background: #0b1424; }
  .dark .wl-frame { border-color: rgba(255,255,255,0.14); }
  .wl-num { font-family: var(--font-sw-serif), Georgia, serif; font-size: 2rem; line-height: 1; color: #2563eb; }
  .dark .wl-num { color: #60a5fa; }
`

export default function LandingPage() {
  return (
    <div className={`${serif.variable} ${sans.variable} wl-page min-h-screen`}>
      <style>{PAGE_CSS}</style>
      <Header />

      <main>
        <section className="mx-auto max-w-4xl px-6 pb-10 pt-16 text-center sm:pt-24">
          <h1 className="wl-title wl-h1">
            Create voice agents and see how patients <span className="wl-em">engage.</span>
          </h1>
          <p className="wl-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
            Whispey is the observability platform from Pype AI. Follow every call: what was said, how the patient responded, and what to fix.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-in" className="wl-btn">Get started</Link>
            <a href="https://docs.whispey.pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-btn wl-btn-ghost">Read the docs</a>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="wl-frame">
            <Image src="/hero-banner-whispey.png" alt="A call in Whispey with its recording, conversation turns and latency per turn" width={2436} height={1420} priority className="h-auto w-full" />
          </div>
        </section>

        <section id="features" className="wl-rule scroll-mt-16">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="wl-title wl-h2 max-w-2xl">What you can follow in every call</h2>
            <dl className="mt-12 grid gap-x-16 gap-y-10 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="wl-rule pt-5">
                  <dt className="text-lg font-semibold">{f.title}</dt>
                  <dd className="wl-muted mt-2 leading-relaxed">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="how-it-works" className="wl-rule scroll-mt-16">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="wl-title wl-h2 max-w-2xl">Start in three steps</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((s, n) => (
                <li key={s.title}>
                  <span className="wl-num">{n + 1}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="wl-muted mt-2 leading-relaxed">{s.body}</p>
                  <pre className="wl-code mt-4"><code>{s.code}</code></pre>
                </li>
              ))}
            </ol>
            <div className="mt-14">
              <Link href="/sign-in" className="wl-btn">Get started</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="wl-rule">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <Brand />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="https://docs.whispey.pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-link">Docs</a>
            <Link href="/privacy-policy" className="wl-link">Privacy policy</Link>
            <Link href="/terms-of-service" className="wl-link">Terms of service</Link>
            <a href="https://pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-link">Pype AI</a>
            <a href="https://pypeai.com/contact" target="_blank" rel="noopener noreferrer" className="wl-link">Contact</a>
          </nav>
          <p className="wl-muted text-sm">&copy; {new Date().getFullYear()} Pype</p>
        </div>
      </footer>
    </div>
  )
}
