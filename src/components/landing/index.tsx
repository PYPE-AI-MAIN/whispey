'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google'
import Header, { Brand } from './landing-header'

const serif = Instrument_Serif({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-sw-serif', display: 'swap' })
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sw-sans', display: 'swap' })

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
  .wl-title { font-family: var(--font-sw-serif), Georgia, serif; font-weight: 400; letter-spacing: -0.012em; line-height: 1.08; }
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
  .wl-frame { border-radius: 18px; border: 1px solid rgba(37,99,235,0.18); box-shadow: 0 30px 70px -34px rgba(30,64,160,0.55); overflow: hidden; background: #fff; text-align: left; }
  .dark .wl-frame { border-color: rgba(255,255,255,0.14); background: #0b1424; }
  .wl-eyebrow { font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600; color: #2563eb; }
  .dark .wl-eyebrow { color: #60a5fa; }
  .wl-band { background: #eef4ff; color: #0b1b3b; }
  .dark .wl-band { background: #08101f; color: #eef4ff; }
  .wl-card { border: 1px solid rgba(37,99,235,0.14); background: #fff; border-radius: 20px; padding: 1.6rem; display: flex; flex-direction: column; gap: 1.1rem;
    box-shadow: 0 18px 40px -30px rgba(30,64,160,0.45); }
  .dark .wl-card { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.035); box-shadow: none; }
  .wl-card p { color: #5b6b86; line-height: 1.6; } .dark .wl-card p { color: #9db0d0; }
  .wl-mock { margin-top: auto; border: 1px solid rgba(37,99,235,0.12); background: #f6f9ff; border-radius: 14px; padding: 1rem; font-size: 0.82rem; }
  .dark .wl-mock { border-color: rgba(255,255,255,0.1); background: rgba(5,10,20,0.6); }
  .wl-tag { font-size: 0.66rem; letter-spacing: 0.12em; text-transform: uppercase; color: #7488aa; } .dark .wl-tag { color: #6f84a8; }
  .wl-ink { color: #0b1b3b; } .dark .wl-ink { color: #dbe7ff; }
  .wl-soft { color: #5b6b86; } .dark .wl-soft { color: #9db0d0; }
  .wl-track { background: rgba(37,99,235,0.1); } .dark .wl-track { background: rgba(255,255,255,0.08); }
  .wl-pill { border: 1px solid rgba(37,99,235,0.22); border-radius: 9999px; padding: 0.25rem 0.7rem; color: #5b6b86; }
  .dark .wl-pill { border-color: rgba(255,255,255,0.16); color: #9db0d0; }
  .wl-pill-on { background: linear-gradient(90deg, #1d4ed8, #3b82f6); border-color: transparent; color: #fff; }
  .dark .wl-pill-on { color: #fff; }
  .wl-code-dark { display: none; }
  .wl-num { font-family: var(--font-sw-serif), Georgia, serif; font-size: 2rem; line-height: 1; color: #2563eb; }
  .dark .wl-num { color: #60a5fa; }
`

export default function LandingPage() {
  return (
    <div className={`${serif.variable} ${sans.variable} wl-page min-h-screen`}>
      <style>{PAGE_CSS}</style>
      <Header />

      <div>
        <section className="mx-auto max-w-4xl px-6 pb-10 pt-16 text-center sm:pt-24">
          <h1 className="wl-title wl-h1">
            Create voice agents and see how patients <span className="wl-em">engage.</span>
          </h1>
          <p className="wl-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
            Whispey is Pype AI's workspace for voice agents. Build them, run them, and review every call: what was said, how the patient responded, and what to fix.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-in" className="wl-btn">Get started</Link>
            <a href="https://docs.whispey.pypeai.com" target="_blank" rel="noopener noreferrer" className="wl-btn wl-btn-ghost">Read the docs</a>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="wl-frame">
            <Image src="/call-logs-light.webp" alt="The call logs page in Whispey, listing each call with its status, duration and flag" width={2000} height={1146} priority className="h-auto w-full dark:hidden" />
            <Image src="/call-logs-dark.webp" alt="" width={2000} height={1152} priority className="hidden h-auto w-full dark:block" />
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
                          <span className="block h-1.5 rounded-full" style={{ width: l.w, background: 'linear-gradient(90deg, #1d4ed8, #60a5fa)' }} />
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
              <a href="https://pypeai.com/contact" target="_blank" rel="noopener noreferrer" className="wl-btn wl-btn-ghost">Talk to Pype</a>
            </div>
          </div>
        </section>
      </div>

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
