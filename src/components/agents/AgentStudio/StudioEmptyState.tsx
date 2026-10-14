'use client'

import { ArrowRight, Link2, Plug, Sparkles, Terminal } from 'lucide-react'

const STEPS = [
  {
    icon: Plug,
    title: 'Connect the Whispey MCP',
    body: 'Add the Whispey MCP server to your AI client, e.g. Claude Desktop or Claude Code.',
  },
  {
    icon: Terminal,
    title: 'Run /whispey',
    body: 'Pick a template or describe the agent — the MCP writes the flow and deploys it.',
  },
  {
    icon: Link2,
    title: 'Open the link it gives you',
    body: 'It lands you right here, with the flow, a live test panel and performance insights.',
  },
]

export default function StudioEmptyState({ onPreview }: Readonly<{ onPreview: () => void }>) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-xl">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-50">Build this agent through the MCP</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Agent Studio is where agents created through the Whispey MCP live — their conversation flow, a live test
            panel, and how the agent is performing. This agent wasn’t created that way yet.
          </p>

          <ol className="mt-6 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <step.icon className="h-3.5 w-3.5" />
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    <span className="mr-1.5 tabular-nums text-gray-400 dark:text-gray-500">{i + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Slot for the MCP connection instructions (to be provided). */}
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              MCP setup
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Connection instructions are coming soon.</p>
          </div>
        </div>

        <button
          onClick={onPreview}
          className="group mx-auto mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          See what Studio looks like with sample data
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
