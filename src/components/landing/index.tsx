'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Header, { Brand } from './landing-header'

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-sw-sans', display: 'swap' })

const STEPS = [
  { title: 'Install the SDK', body: 'Add Whispey to your agent project.' },
  { title: 'Connect your agent', body: 'Create the observer with your agent ID and API key. Whispey works with LiveKit agents.' },
  { title: 'Start a session', body: 'Start tracking when the call begins. Calls then appear in your dashboard.' },
]

const CODE = `pip install whispey

whispey = LivekitObserve(
    agent_id="your-agent-id",
    apikey=os.getenv("WHISPEY_API_KEY"),
)

session_id = whispey.start_session(
    session=session,
)`

const TURNS = [
  { who: 'Agent', text: 'Hello, you have reached the clinic. How can I help you today?' },
  { who: 'Patient', text: 'I need to move my appointment to Tuesday.' },
  { who: 'Agent', text: 'Sure. Let me check what is open on Tuesday.' },
]

const QA_STEPS = ['Flagged', 'In review', 'Resolved']
const LATENCY = [
  { label: 'Speech to text', w: '28%' },
  { label: 'Language model', w: '62%' },
  { label: 'Text to speech', w: '38%' },
]

const PAGE_CSS = `
  .wl-page { background:
      radial-gradient(60% 40% at 6% 0%, #f1e6fa 0%, rgba(241,230,250,0) 70%),
      radial-gradient(46% 36% at 96% 22%, #ffe9e6 0%, rgba(255,233,230,0) 70%),
      #fffafa;
    color: #1e0a52; font-family: var(--font-satoshi), system-ui, sans-serif; }
  .dark .wl-page { background:
      radial-gradient(60% 40% at 6% 0%, rgba(124,58,237,0.3) 0%, rgba(124,58,237,0) 70%),
      radial-gradient(46% 36% at 96% 22%, rgba(255,107,107,0.14) 0%, rgba(255,107,107,0) 70%),
      #1e0a52;
    color: #fff5f5; }
  .wl-header { background: rgba(255,250,250,0.82); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(75,0,130,0.1); }
  .dark .wl-header { background: rgba(30,10,82,0.78); border-bottom-color: rgba(255,255,255,0.08); }
  .wl-title { font-family: var(--font-sw-sans), system-ui, sans-serif; font-weight: 700; letter-spacing: -0.03em; line-height: 1.08; text-wrap: balance; }
  .wl-h1 { font-size: clamp(2.5rem, 6vw, 4.6rem); }
  .wl-h2 { font-size: clamp(1.9rem, 3.6vw, 2.8rem); }
    .wl-em { color: #ff6b6b; }
  .wl-muted { color: #6b6485; } .dark .wl-muted { color: #b3a9d4; }
  .wl-link { color: #1e0a52; text-decoration: none; } .wl-link:hover { text-decoration: underline; text-underline-offset: 4px; }
  .dark .wl-link { color: #fff5f5; }
  .wl-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; font-weight: 600;
    background: #ff6b6b; color: #1e0a52; padding: 0.8rem 1.6rem; font-size: 0.95rem;
    box-shadow: 0 10px 24px -12px rgba(255,107,107,0.7); transition: transform .15s ease, box-shadow .15s ease; }
  .wl-btn:hover { transform: translateY(-1px); } .wl-btn:disabled { opacity: .6; }
  .wl-btn-sm { padding: 0.5rem 1.1rem; font-size: 0.85rem; }
  .wl-btn-ghost { background: transparent; color: #1e0a52; box-shadow: none; border: 1px solid rgba(75,0,130,0.25); }
  .dark .wl-btn-ghost { color: #fff5f5; border-color: rgba(255,255,255,0.22); }
  .wl-rule { border-top: 1px solid rgba(75,0,130,0.14); } .dark .wl-rule { border-top-color: rgba(255,255,255,0.1); }
  .wl-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82rem; line-height: 1.6; overflow-x: auto;
    background: rgba(255,255,255,0.75); border: 1px solid rgba(75,0,130,0.14); border-radius: 12px; padding: 0.9rem 1rem; }
  .dark .wl-code { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); }
  .wl-frame { border-radius: 18px; border: 1px solid rgba(75,0,130,0.18); box-shadow: 0 30px 70px -34px rgba(30,10,82,0.55); overflow: hidden; background: #fff; text-align: left; }
  .dark .wl-frame { border-color: rgba(255,255,255,0.14); background: #25105e; }
  .wl-eyebrow { font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600; color: #4b0082; }
  .dark .wl-eyebrow { color: #ff8a8a; }
  .wl-band { background: #f6f1fa; color: #1e0a52; }
  .dark .wl-band { background: #150640; color: #fff5f5; }
  .wl-card { border: 1px solid rgba(75,0,130,0.14); background: #fff; border-radius: 20px; padding: 1.6rem; display: flex; flex-direction: column; gap: 1.1rem;
    box-shadow: 0 18px 40px -30px rgba(30,10,82,0.45); }
  .dark .wl-card { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); box-shadow: none; }
  .wl-card p { color: #6b6485; line-height: 1.6; } .dark .wl-card p { color: #b3a9d4; }
  .wl-mock { margin-top: auto; border: 1px solid rgba(75,0,130,0.12); background: #faf6fc; border-radius: 14px; padding: 1rem; font-size: 0.82rem; }
  .dark .wl-mock { border-color: rgba(255,255,255,0.1); background: rgba(30,10,82,0.6); }
  .wl-tag { font-size: 0.66rem; letter-spacing: 0.12em; text-transform: uppercase; color: #8a80a8; } .dark .wl-tag { color: #8a80a8; }
  .wl-ink { color: #1e0a52; } .dark .wl-ink { color: #ece6ff; }
  .wl-soft { color: #6b6485; } .dark .wl-soft { color: #b3a9d4; }
  .wl-track { background: rgba(75,0,130,0.1); } .dark .wl-track { background: rgba(255,255,255,0.08); }
  .wl-pill { border: 1px solid rgba(75,0,130,0.22); border-radius: 9999px; padding: 0.25rem 0.7rem; color: #6b6485; }
  .dark .wl-pill { border-color: rgba(255,255,255,0.16); color: #b3a9d4; }
  .wl-pill-on { background: #ff6b6b; border-color: transparent; color: #1e0a52; }
  .dark .wl-pill-on { color: #1e0a52; }
  .wl-code-dark { display: none; }
  .wl-num { font-family: var(--font-sw-sans), system-ui, sans-serif; font-weight: 700; font-size: 2rem; line-height: 1; color: #4b0082; }
  .dark .wl-num { color: #ff8a8a; }
`

export default function LandingPage() {
  return (
    <div className={`${sans.variable} wl-page min-h-screen`}>
      <style>{PAGE_CSS}</style>
      <Header />

      <div>
        <section className="mx-auto max-w-4xl px-6 pb-10 pt-16 text-center sm:pt-24">
          <h1 className="wl-title wl-h1">
            AI that answers every patient call <span className="wl-em">reliably.</span>
          </h1>
          <p className="wl-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
            Whispey is where Pype builds its healthcare voice agents. Build them, run them, and review every call: what was said, how the patient responded, and what to fix.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-in" className="wl-btn">Get started</Link>
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="wl-btn wl-btn-ghost">Read the docs</a>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="wl-frame">
            <Image src="/call-logs-light.webp" alt="The call logs page in Whispey, listing each call with its status, duration and flag" width={2000} height={1130} priority className="h-auto w-full dark:hidden" />
            <Image src="/call-logs-dark.webp" alt="" width={2000} height={1136} priority className="hidden h-auto w-full dark:block" />
          </div>
        </section>

        <section id="features" className="wl-band scroll-mt-16">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="wl-eyebrow">What you can follow</p>
            <h2 className="wl-title wl-h2 mt-3 max-w-2xl">Every call, from the first word to the follow-up</h2>
            <div className="mt-12 grid gap-5 lg:grid-cols-6">
              <article className="wl-card lg:col-span-4">
                <div>
                  <h3 className="text-xl font-semibold">Call logs and recordings</h3>
                  <p className="mt-2">Open any call to read the transcript, hear the recording and follow each turn of the conversation.</p>
                </div>
                <div className="wl-mock" aria-hidden="true">
                  <p className="wl-tag mb-3">Example</p>
                  <ul className="space-y-2.5">
                    {TURNS.map((t) => (
                      <li key={t.text} className="flex gap-3">
                        <span className="wl-tag w-14 shrink-0 pt-0.5">{t.who}</span>
                        <span className="wl-ink">{t.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="wl-card lg:col-span-2">
                <div>
                  <h3 className="text-xl font-semibold">Latency and cost</h3>
                  <p className="mt-2">See how long the agent took to respond on every turn, and what each call cost.</p>
                </div>
                <div className="wl-mock" aria-hidden="true">
                  <p className="wl-tag mb-3">Example</p>
                  <ul className="space-y-3">
                    {LATENCY.map((l) => (
                      <li key={l.label}>
                        <span className="wl-soft">{l.label}</span>
                        <span className="wl-track mt-1.5 block h-1.5 rounded-full">
                          <span className="block h-1.5 rounded-full" style={{ width: l.w, background: 'linear-gradient(90deg, #4b0082, #ff6b6b)' }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="wl-card lg:col-span-3">
                <div>
                  <h3 className="text-xl font-semibold">QA Audit</h3>
                  <p className="mt-2">Flag a call that went wrong. The Pype QA team reviews it and updates the status. You can also ask for a weekly review of an agent.</p>
                </div>
                <div className="wl-mock" aria-hidden="true">
                  <p className="wl-tag mb-3">Example</p>
                  <div className="flex flex-wrap gap-2">
                    {QA_STEPS.map((q, n) => (
                      <span key={q} className={n === 1 ? 'wl-pill wl-pill-on' : 'wl-pill'}>{q}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="wl-card lg:col-span-3">
                <div>
                  <h3 className="text-xl font-semibold">Bug reports</h3>
                  <p className="mt-2">Report a problem by voice during a test call, then find it later alongside that call in the logs.</p>
                </div>
                <div className="wl-mock" aria-hidden="true">
                  <p className="wl-tag mb-3">Example</p>
                  <p className="wl-ink">&ldquo;The agent repeated the question twice.&rdquo;</p>
                  <p className="wl-soft mt-2">Attached to turn 4 of this call</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
            <div>
              <p className="wl-eyebrow">How it works</p>
              <h2 className="wl-title wl-h2 mt-3">Start in three steps</h2>
              <ol className="mt-10 space-y-7">
                {STEPS.map((s, n) => (
                  <li key={s.title} className="flex gap-5">
                    <span className="wl-num w-6 shrink-0">{n + 1}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{s.title}</h3>
                      <p className="wl-muted mt-1 leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <pre className="wl-code" style={{ fontSize: '0.9rem', lineHeight: 1.8, padding: '1.4rem 1.5rem' }}><code>{CODE}</code></pre>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="wl-band rounded-3xl px-8 py-14 text-center sm:px-14">
            <h2 className="wl-title wl-h2 mx-auto max-w-2xl">See how your agents perform on real calls</h2>
            <p className="wl-soft mx-auto mt-4 max-w-xl">
              Sign in to Whispey, or talk to the Pype team about voice agents for your hospital or clinic.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/sign-in" className="wl-btn">Get started</Link>
              <a href="https://calendly.com/dhruv-pypeai/onboarding" target="_blank" rel="noopener noreferrer" className="wl-btn wl-btn-ghost">Talk to Pype</a>
            </div>
          </div>
        </section>
      </div>

      <footer className="wl-rule">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <Brand />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="wl-link">Docs</a>
            <Link href="/privacy-policy" className="wl-link">Privacy policy</Link>
            <Link href="/terms-of-service" className="wl-link">Terms of service</Link>
            <a href="https://pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-link">Pype AI</a>
            <a href="https://calendly.com/dhruv-pypeai/onboarding" target="_blank" rel="noopener noreferrer" className="wl-link">Contact</a>
          </nav>
          <p className="wl-muted text-sm">&copy; {new Date().getFullYear()} Pype</p>
        </div>
      </footer>
    </div>
  )
}
