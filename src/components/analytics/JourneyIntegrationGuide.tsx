'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const DOCS_URL = 'https://docs.whispey.pypeai.com/analytics/send-events/'
const INK = 'text-gray-900 dark:text-gray-100'
const MUTED = 'text-gray-500 dark:text-gray-400'
const CODE = 'rounded bg-gray-100 px-1 dark:bg-gray-800'

type Lang = 'curl' | 'python' | 'javascript'
const LANGS: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
]

/** One working request per language. The values you replace are in angle brackets. */
export function eventSnippet(lang: Lang, base: string, campaignKey: string): string {
  const url = `${base}/api/journeys/events`
  if (lang === 'python') {
    return `import requests

requests.post(
    "${url}",
    headers={"x-pype-token": "<YOUR_PYPE_TOKEN>"},
    json={
        "campaign_key": "${campaignKey}",
        "identity_key": "<your own member or lead id>",
        "channel": "whatsapp",
        "step": "<the step this person just reached>",
        "action": "message_sent",
        "payload": {"delivery_status": "delivered"},
    },
    timeout=10,
).raise_for_status()`
  }
  if (lang === 'javascript') {
    return `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-pype-token": "<YOUR_PYPE_TOKEN>",
  },
  body: JSON.stringify({
    campaign_key: "${campaignKey}",
    identity_key: "<your own member or lead id>",
    channel: "whatsapp",
    step: "<the step this person just reached>",
    action: "message_sent",
    payload: { delivery_status: "delivered" },
  }),
})
if (!res.ok) throw new Error(await res.text())`
  }
  return String.raw`curl -X POST ${url} \
  -H "Content-Type: application/json" \
  -H "x-pype-token: <YOUR_PYPE_TOKEN>" \
  -d '{
    "campaign_key": "${campaignKey}",
    "identity_key": "<your own member or lead id>",
    "channel": "whatsapp",
    "step": "<the step this person just reached>",
    "action": "message_sent",
    "payload": { "delivery_status": "delivered" }
  }'`
}

const FIELDS: { name: string; required: boolean; what: string }[] = [
  { name: 'campaign_key', required: true, what: 'A name you pick for the whole campaign, such as onboarding. The first request with a new name creates the campaign.' },
  { name: 'identity_key', required: true, what: 'Your own id for the person, such as member_42. The same id always means the same person.' },
  { name: 'channel', required: true, what: 'How you reached them: whatsapp, voice_call, sms or any name you use.' },
  { name: 'step', required: true, what: 'The step they just reached. It becomes a row in the funnel.' },
  { name: 'action', required: true, what: 'What happened at that step: message_sent, call_completed, and so on.' },
  { name: 'outcome', required: false, what: 'Send it when the person is finished, such as booked or not_interested. It marks the workflow completed.' },
  { name: 'payload', required: false, what: 'Anything else you want on the timeline, as a JSON object.' },
  { name: 'external_ref', required: false, what: 'Your own reference for this event, such as a message id.' },
  { name: 'agent_id', required: false, what: 'A Whispey agent id, so you can filter the tab by agent.' },
]

const REPLIES: { code: string; means: string }[] = [
  { code: '200', means: 'Saved. The reply holds the workflow id: {"journey_id": "..."}.' },
  { code: '400', means: 'A field is missing or too long. The reply names which one.' },
  { code: '401', means: 'The token is missing or wrong. Send your project API key in the x-pype-token header.' },
  { code: '413', means: 'The request is over 8 KB. Send less in payload.' },
  { code: '429', means: 'More than 600 requests in a minute on this token. Slow down and retry.' },
]

function Snippet({ lang, setLang, code }: Readonly<{ lang: Lang; setLang: (l: Lang) => void; code: string }>) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLang(l.id)}
            className={cn('rounded-md px-2 py-1 text-xs font-medium', lang === l.id ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : cn(MUTED, 'hover:bg-gray-100 dark:hover:bg-gray-800'))}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="max-h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{code}</pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 rounded-md border border-gray-700 bg-gray-800 p-1.5 text-gray-300 hover:bg-gray-700"
          title="Copy"
          aria-label="Copy snippet"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

function Step({ n, children }: Readonly<{ n: number; children: React.ReactNode }>) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{n}</span>
      <span className={cn('pt-0.5 text-sm', INK)}>{children}</span>
    </li>
  )
}

/**
 * How to send data into this tab, start to finish: get the token, send one event, see it arrive.
 * Used in the empty state and in the Integration popover, so both say the same thing.
 */
export function JourneyIntegrationGuide({ campaignKey, projectId, scroll }: Readonly<{ campaignKey: string | null; projectId: string; scroll?: boolean }>) {
  const [lang, setLang] = useState<Lang>('curl')
  const base = globalThis.location?.origin ?? 'https://whispey.xyz'
  const key = campaignKey ?? 'onboarding'
  return (
    <div className={cn('space-y-5', scroll && 'max-h-[70vh] overflow-y-auto pr-1')}>
      <div>
        <p className={cn('text-sm font-medium', INK)}>Send events from your own system</p>
        <p className={cn('mt-1 text-xs', MUTED)}>
          Each time a person reaches a step, your system sends one small request. Whispey builds the funnel, the charts and each person&apos;s timeline from them.
          There is nothing to set up first: the first request creates the campaign and the workflow.
        </p>
      </div>

      <ol className="space-y-3">
        <Step n={1}>
          Copy your token from{' '}
          <Link href={`/${projectId}/agents/api-keys`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">API key</Link>
          . It is the same key the SDK uses.
        </Step>
        <Step n={2}>Send a request like this one, with your token and your own values in the angle brackets.</Step>
      </ol>

      <Snippet lang={lang} setLang={setLang} code={eventSnippet(lang, base, key)} />

      <ol start={3} className="space-y-3">
        <Step n={3}>
          Reload this tab. The campaign appears by its key, with the person under <strong>Recent workflows</strong>. Send the next step for the same{' '}
          <code className={CODE}>campaign_key</code> and <code className={CODE}>identity_key</code> as they move on.
        </Step>
      </ol>

      <div>
        <p className={cn('mb-1.5 text-xs font-medium uppercase tracking-wide', MUTED)}>What to send</p>
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs dark:divide-gray-800 dark:border-gray-800">
          {FIELDS.map((f) => (
            <div key={f.name} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
              <dt>
                <code className={CODE}>{f.name}</code>
                <span className={cn('mt-0.5 block text-[10px] uppercase tracking-wide', f.required ? 'text-blue-600 dark:text-blue-400' : MUTED)}>{f.required ? 'Required' : 'Optional'}</span>
              </dt>
              <dd className={MUTED}>{f.what}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className={cn('mb-1.5 text-xs font-medium uppercase tracking-wide', MUTED)}>What comes back</p>
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs dark:divide-gray-800 dark:border-gray-800">
          {REPLIES.map((r) => (
            <div key={r.code} className="grid grid-cols-[3rem_1fr] gap-2 px-3 py-2">
              <dt className="font-mono font-semibold">{r.code}</dt>
              <dd className={MUTED}>{r.means}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className={cn('list-disc space-y-1 pl-4 text-xs', MUTED)}>
        <li>The funnel lists steps in the order each one is first seen, so send a step the first time it happens in order.</li>
        <li>One event per request. Sending the same event twice records it twice.</li>
        <li>Limits: 8 KB per request and 600 requests a minute for each token.</li>
      </ul>

      <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
        Read the full guide <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
