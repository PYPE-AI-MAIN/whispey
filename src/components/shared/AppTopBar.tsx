'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignedIn } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronRight, HelpCircle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import NotificationBell from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

const DOCS_URL = 'https://docs.whispey.pypeai.com'
const SUPPORT_URL = 'https://pypeai.com/contact'

const LABELS: Record<string, string> = {
  agents: 'Agents',
  analytics: 'Analytics',
  campaigns: 'Campaigns',
  create: 'Create',
  settings: 'Settings',
  users: 'Users',
  dnc: 'Do not call',
  'phone-numbers': 'Phone numbers',
  pi: 'Ask Pi',
  observability: 'Observability',
  qa: 'QA Audit',
  config: 'Agent config',
  livekit: 'LiveKit',
  pipecat: 'Pipecat',
  knowledge: 'Knowledge base',
  knowledgebase: 'Knowledge base',
  studio: 'Agent studio',
  'phone-call-config': 'Phone calls',
  'prompt-forge': 'Prompt forge',
  workflow: 'Workflow',
  playground: 'Playground',
  'web-call': 'Web call',
  vapi: 'Vapi',
  retell: 'Retell',
  'api-keys': 'API keys',
  'sip-management': 'SIP management',
}

type Crumb = { label: string; href: string }

// Route segments only: ids (agent, campaign, session, user) carry no name here, so an
// agent id reads as "Agent" and any other id is left out.
function crumbsFor(pathname: string): Crumb[] {
  const [projectId, ...rest] = pathname.split('/').filter(Boolean)
  const out: Crumb[] = []
  let href = `/${projectId}`
  rest.forEach((seg, i) => {
    href += `/${seg}`
    if (LABELS[seg]) out.push({ label: LABELS[seg], href })
    else if (rest[i - 1] === 'agents') out.push({ label: 'Agent', href })
  })
  return out
}

export default function AppTopBar() {
  const pathname = usePathname() ?? ''
  const projectId = pathname.split('/').filter(Boolean)[0]
  const { data: projects } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    },
    staleTime: 30000,
  })
  const orgName = projects?.find((p) => p.id === projectId)?.name
  const crumbs = [...(orgName ? [{ label: orgName, href: `/${projectId}/agents` }] : []), ...crumbsFor(pathname)]

  return (
    <header className="sticky top-0 z-30 flex h-12 flex-none items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-4 w-4 flex-none text-muted-foreground/60" />}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-none items-center gap-2">
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Docs</span>
        </a>
        <SignedIn>
          <NotificationBell />
        </SignedIn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Help"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Documentation</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Contact support</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle plain />
      </div>
    </header>
  )
}
