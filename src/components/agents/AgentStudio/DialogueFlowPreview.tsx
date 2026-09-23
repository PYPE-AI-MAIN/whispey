'use client'

import { MessageSquare, ArrowDown } from 'lucide-react'

interface DialogueTurn {
  speaker: 'agent' | 'user'
  label: string
  text: string
}

// Placeholder flow — real generation comes from the MCP later. Shape mirrors
// what that will eventually hand this component: an ordered list of turns.
const EXAMPLE_FLOW: DialogueTurn[] = [
  { speaker: 'agent', label: 'Greeting', text: "Hi, this is Ava from Acme Roofing — got a minute?" },
  { speaker: 'user', label: 'Response', text: 'Sure, what is this about?' },
  { speaker: 'agent', label: 'Context', text: 'You requested a quote on our site last week for roof repair — following up on that.' },
  { speaker: 'user', label: 'Response', text: 'Oh right, yes.' },
  { speaker: 'agent', label: 'Qualify', text: 'Are you the homeowner, and is this for a repair or a full replacement?' },
  { speaker: 'user', label: 'Response', text: "I'm the homeowner, just a repair — there's a leak near the chimney." },
  { speaker: 'agent', label: 'Qualify', text: 'Got it. How long has the leak been happening, and has it caused any visible damage inside?' },
  { speaker: 'user', label: 'Response', text: 'About two weeks. Small water stain on the ceiling.' },
  { speaker: 'agent', label: 'Qualify', text: "Understood — we'll flag that for the inspector. Roughly what's your timeline to get this fixed?" },
  { speaker: 'user', label: 'Response', text: 'As soon as possible, ideally this week.' },
  { speaker: 'agent', label: 'Book', text: "Great — I have Tuesday 10am or Wednesday 2pm for a free inspection. Which works?" },
  { speaker: 'user', label: 'Response', text: 'Wednesday 2pm works.' },
  { speaker: 'agent', label: 'Confirm', text: "Booked — Wednesday 2pm. You'll get a text confirmation shortly. Anything else before I let you go?" },
  { speaker: 'user', label: 'Response', text: 'No, that covers it, thanks.' },
  { speaker: 'agent', label: 'Close', text: 'Perfect, thanks for your time — see you Wednesday!' },
]

export default function DialogueFlowPreview() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">Turns</h2>
        <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 dark:border-gray-800">
          example
        </span>
      </div>

      <div className="flex flex-col items-stretch gap-2">
        {EXAMPLE_FLOW.map((turn, i) => (
          <div key={i} className="flex flex-col items-stretch gap-2">
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${
                turn.speaker === 'agent'
                  ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'
                  : 'border-transparent bg-transparent'
              }`}
            >
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    {turn.speaker === 'agent' ? 'Agent' : 'Caller'}
                  </span>
                  <span className="text-[10px] text-gray-400">· {turn.label}</span>
                </div>
                <p className="text-[13px] leading-snug text-gray-700 dark:text-gray-300">{turn.text}</p>
              </div>
            </div>
            {i < EXAMPLE_FLOW.length - 1 && (
              <ArrowDown className="mx-auto h-3 w-3 text-gray-300 dark:text-gray-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
