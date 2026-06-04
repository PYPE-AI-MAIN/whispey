# Prompt GitHub Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub-backed prompt versioning with commit messages, prod-agent read-only enforcement, and a one-click merge-to-prod flow.

**Architecture:** Extend `pype_agent_config_versions` with 5 new columns. On every dev agent save, insert a version row + push `prompts/{project}/{agent}/prompt.md` to GitHub. A merge action copies the prompt to a target prod agent, calls save-and-deploy, and creates a version row for the prod agent too.

**Tech Stack:** Next.js App Router API routes, Supabase (service role client), GitHub Contents API (PUT/GET), React, Tailwind, shadcn/ui (Dialog, Select, Button, Badge).

---

## File Map

| Action | Path |
|---|---|
| Modify | `.env.local` |
| Modify | `src/app/api/agents/[id]/history/route.ts` |
| Create | `src/app/api/agents/[id]/history/[versionId]/merge/route.ts` |
| Create | `src/app/api/agents/prod-list/route.ts` |
| Create | `src/lib/github-prompts.ts` |
| Modify | `src/hooks/useConfigHistory.ts` |
| Modify | `src/app/[projectid]/agents/[agentid]/config/pipecat/page.tsx` |
| Modify | `src/app/[projectid]/agents/[agentid]/config/livekit/page.tsx` |
| Modify | `src/components/agents/AgentConfig/Pipecat/PipecatAgentConfig.tsx` |
| Modify | `src/components/agents/AgentConfig/ConfigHistory.tsx` |

---

## Task 1: Env vars + DB migration

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add env vars to `.env.local`**

Append these two lines (use `tinkalpype/Prompt` format, not the full URL):

```bash
PROMPT_GITHUB_REPO=tinkalpype/Prompt
PROMPT_GITHUB_TOKEN=REDACTED
```

- [ ] **Step 2: Run this SQL in Supabase SQL Editor to add the 5 new columns**

```sql
ALTER TABLE pype_agent_config_versions
  ADD COLUMN IF NOT EXISTS github_sha         text,
  ADD COLUMN IF NOT EXISTS github_push_ok     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_to_agent_id uuid REFERENCES pype_voice_agents(id),
  ADD COLUMN IF NOT EXISTS merged_at          timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by_email    text;
```

- [ ] **Step 3: Verify columns exist**

Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pype_agent_config_versions'
ORDER BY ordinal_position;
```

Expected: you should see `github_sha`, `github_push_ok`, `merged_to_agent_id`, `merged_at`, `merged_by_email` in the list alongside the existing columns.

---

## Task 2: GitHub prompts library

**Files:**
- Create: `src/lib/github-prompts.ts`

- [ ] **Step 1: Create `src/lib/github-prompts.ts`**

```typescript
import 'server-only'

const REPO = process.env.PROMPT_GITHUB_REPO ?? ''
const TOKEN = process.env.PROMPT_GITHUB_TOKEN ?? ''
const BASE = 'https://api.github.com'

function headers() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function filePath(projectName: string, agentName: string) {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, '_')
  return `prompts/${safe(projectName)}/${safe(agentName)}/prompt.md`
}

async function getCurrentSha(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
      headers: headers(),
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    const data = await res.json()
    return data.sha ?? null
  } catch {
    return null
  }
}

export async function pushPromptToGitHub(
  projectName: string,
  agentName: string,
  promptContent: string,
  commitMessage: string,
  authorEmail: string,
): Promise<{ sha: string } | null> {
  if (!REPO || !TOKEN) return null

  const path = filePath(projectName, agentName)
  const currentSha = await getCurrentSha(path)

  const body: Record<string, any> = {
    message: `${commitMessage}\n\nAuthor: ${authorEmail}`,
    content: Buffer.from(promptContent).toString('base64'),
    branch: 'main',
  }
  if (currentSha) body.sha = currentSha

  try {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[github-prompts] PUT failed:', res.status, err)
      return null
    }

    const data = await res.json()
    return { sha: data.commit?.sha ?? data.content?.sha ?? '' }
  } catch (err) {
    console.error('[github-prompts] Unexpected error:', err)
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `github-prompts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/github-prompts.ts .env.local
git commit -m "feat: add GitHub prompts push library and env vars"
```

---

## Task 3: Extend `useConfigHistory` types

**Files:**
- Modify: `src/hooks/useConfigHistory.ts`

The hook's `ConfigHistoryEntry` type needs the new fields so the UI can render badges and merge buttons.

- [ ] **Step 1: Update `ConfigHistoryEntry` interface**

In `src/hooks/useConfigHistory.ts`, replace the existing `ConfigHistoryEntry` interface:

```typescript
export interface ConfigHistoryEntry {
  id: string
  version_number: number
  created_by_email: string | null
  created_at: string
  commit_message: string | null
  prompt_snapshot: string | null
  github_push_ok: boolean | null
  merged_to_agent_id: string | null
  merged_at: string | null
}
```

- [ ] **Step 2: Update the GET select string in `fetchHistory`**

In `fetchHistory`, update the fetch URL to explicitly request the new fields (the API now returns them — see Task 4):

No change needed to the hook itself — the API response already includes these fields and TypeScript will infer them from the interface. Just adding them to the type is enough.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useConfigHistory.ts
git commit -m "feat: extend ConfigHistoryEntry type with github and merge fields"
```

---

## Task 4: Modify `POST` and `GET /api/agents/[id]/history`

**Files:**
- Modify: `src/app/api/agents/[id]/history/route.ts`

- [ ] **Step 1: Replace the entire file content**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushPromptToGitHub } from '@/lib/github-prompts'

const supabase = createServiceRoleClient()

function sanitizeSnapshot(config: any): any {
  if (!config) return config
  const clone = JSON.parse(JSON.stringify(config))
  if (clone?.agent) {
    delete clone.agent.whispey_api_key
    delete clone.agent.token_hash
    delete clone.agent.whispey_key_id
  }
  return clone
}

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt
    ?? config?.agent?.prompt
    ?? null
}

// POST /api/agents/[id]/history — save a version checkpoint
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await req.json()
    const { config, userEmail, userId, commit_message } = body

    if (!config) {
      return NextResponse.json({ message: 'config is required' }, { status: 400 })
    }
    if (!commit_message || !commit_message.trim()) {
      return NextResponse.json({ message: 'commit_message is required' }, { status: 400 })
    }

    // Fetch agent — check environment + get project info
    const { data: agent, error: agentErr } = await supabase
      .from('pype_voice_agents')
      .select('project_id, environment, name')
      .eq('id', agentId)
      .single()

    if (agentErr || !agent) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }

    if (agent.environment === 'prod') {
      return NextResponse.json(
        { message: 'Cannot save versions for a production agent. Edit the dev agent instead.' },
        { status: 403 }
      )
    }

    const snapshot = sanitizeSnapshot(config)
    const promptSnapshot = extractPromptSnapshot(snapshot)

    // Get next version number
    const { data: latest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (latest?.version_number ?? 0) + 1

    // Fetch project name for GitHub folder path
    const { data: project } = await supabase
      .from('pype_projects')
      .select('name')
      .eq('id', agent.project_id)
      .single()

    const projectName = project?.name ?? agent.project_id
    const agentName = agent.name ?? agentId

    // Push to GitHub (non-blocking on failure)
    const githubResult = promptSnapshot
      ? await pushPromptToGitHub(
          projectName,
          agentName,
          promptSnapshot,
          commit_message.trim(),
          userEmail ?? 'unknown',
        )
      : null

    // Insert version row
    const { error } = await supabase.from('pype_agent_config_versions').insert({
      agent_id: agentId,
      project_id: agent.project_id,
      version_number: nextVersion,
      config_snapshot: snapshot,
      prompt_snapshot: promptSnapshot ?? null,
      commit_message: commit_message.trim(),
      created_by_email: userEmail ?? null,
      created_by_user_id: userId ?? null,
      github_sha: githubResult?.sha ?? null,
      github_push_ok: githubResult !== null,
    })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    // Enforce 100-version retention
    const { data: allVersions } = await supabase
      .from('pype_agent_config_versions')
      .select('id')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: true })

    if (allVersions && allVersions.length > 100) {
      const toDelete = allVersions.slice(0, allVersions.length - 100).map((v: { id: string }) => v.id)
      await supabase.from('pype_agent_config_versions').delete().in('id', toDelete)
    }

    return NextResponse.json({ success: true, version_number: nextVersion, github_push_ok: githubResult !== null })
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to save checkpoint', error: err.message }, { status: 500 })
  }
}

// GET /api/agents/[id]/history?page=1&limit=20
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('pype_agent_config_versions')
      .select(
        'id, version_number, created_by_email, created_at, commit_message, prompt_snapshot, github_push_ok, merged_to_agent_id, merged_at',
        { count: 'exact' }
      )
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      history: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
        hasMore: offset + limit < (count ?? 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { message: 'Failed to fetch history', error: err.message },
      { status: 500 }
    )
  }
}
```

> **Note on project table name:** The query uses `pype_projects`. If the actual Supabase table name is different (e.g. `projects`), update line `from('pype_projects')` to match. If no project table exists, replace `project?.name` with a fallback of `agent.project_id`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `history/route.ts` or `github-prompts.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agents/\[id\]/history/route.ts
git commit -m "feat: history POST now requires commit_message, extracts prompt_snapshot, pushes to GitHub, guards prod agents"
```

---

## Task 5: New `GET /api/agents/prod-list` route

**Files:**
- Create: `src/app/api/agents/prod-list/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

// GET /api/agents/prod-list?project_id=xxx
// Returns all prod-tagged agents in the same project (used for merge target dropdown)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ message: 'project_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pype_voice_agents')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('environment', 'prod')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json({ agents: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to fetch prod agents', error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agents/prod-list/route.ts
git commit -m "feat: add prod-list API route for merge target dropdown"
```

---

## Task 6: New `POST /api/agents/[id]/history/[versionId]/merge` route

**Files:**
- Create: `src/app/api/agents/[id]/history/[versionId]/merge/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pushPromptToGitHub } from '@/lib/github-prompts'

const supabase = createServiceRoleClient()

function extractPromptSnapshot(config: any): string | null {
  return config?.agent?.assistant?.[0]?.prompt
    ?? config?.agent?.prompt
    ?? null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: sourceAgentId, versionId } = await params
    const body = await req.json()
    const { target_agent_id, userEmail, userId } = body

    if (!target_agent_id) {
      return NextResponse.json({ message: 'target_agent_id is required' }, { status: 400 })
    }

    // 1. Load source version
    const { data: version, error: vErr } = await supabase
      .from('pype_agent_config_versions')
      .select('*')
      .eq('id', versionId)
      .eq('agent_id', sourceAgentId)
      .single()

    if (vErr || !version) {
      return NextResponse.json({ message: 'Version not found' }, { status: 404 })
    }

    const promptSnapshot = version.prompt_snapshot ?? extractPromptSnapshot(version.config_snapshot)
    if (!promptSnapshot) {
      return NextResponse.json({ message: 'This version has no prompt snapshot and cannot be merged.' }, { status: 400 })
    }

    // 2. Load target prod agent
    const { data: targetAgent, error: taErr } = await supabase
      .from('pype_voice_agents')
      .select('id, name, project_id, environment, configuration')
      .eq('id', target_agent_id)
      .single()

    if (taErr || !targetAgent) {
      return NextResponse.json({ message: 'Target agent not found' }, { status: 404 })
    }

    if (targetAgent.environment !== 'prod') {
      return NextResponse.json({ message: 'Target agent is not a production agent.' }, { status: 403 })
    }

    // 3. Load target agent full config snapshot (latest version)
    const { data: latestProdVersion } = await supabase
      .from('pype_agent_config_versions')
      .select('config_snapshot')
      .eq('agent_id', target_agent_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Merge prompt into prod config
    let prodConfig = latestProdVersion?.config_snapshot
      ? JSON.parse(JSON.stringify(latestProdVersion.config_snapshot))
      : null

    // If no prod version exists, use the target agent's Supabase configuration field as base
    if (!prodConfig && targetAgent.configuration) {
      prodConfig = { agent: targetAgent.configuration }
    }

    if (!prodConfig) {
      return NextResponse.json({ message: 'Could not load target agent config to merge into.' }, { status: 500 })
    }

    // Inject the prompt
    if (prodConfig?.agent?.assistant?.[0]) {
      prodConfig.agent.assistant[0].prompt = promptSnapshot
    } else if (prodConfig?.agent) {
      prodConfig.agent.prompt = promptSnapshot
    }

    // 4. Call save-and-deploy for the prod agent
    const deployRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/agents/save-and-deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: prodConfig.agent,
        metadata: { agentId: target_agent_id, agentName: targetAgent.name },
      }),
    })

    if (!deployRes.ok) {
      const deployErr = await deployRes.json().catch(() => ({}))
      return NextResponse.json(
        { message: `Deploy failed: ${deployErr.message ?? 'unknown error'}` },
        { status: 502 }
      )
    }

    // 5. Insert version row for prod agent
    const { data: prodLatest } = await supabase
      .from('pype_agent_config_versions')
      .select('version_number')
      .eq('agent_id', target_agent_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextProdVersion = (prodLatest?.version_number ?? 0) + 1

    // 6. Push to GitHub under prod agent folder
    const { data: project } = await supabase
      .from('pype_projects')
      .select('name')
      .eq('id', targetAgent.project_id)
      .single()

    const projectName = project?.name ?? targetAgent.project_id
    const commitMsg = `Merged from dev v${version.version_number} by ${userEmail ?? 'unknown'}`

    const githubResult = await pushPromptToGitHub(
      projectName,
      targetAgent.name,
      promptSnapshot,
      commitMsg,
      userEmail ?? 'unknown',
    )

    await supabase.from('pype_agent_config_versions').insert({
      agent_id: target_agent_id,
      project_id: targetAgent.project_id,
      version_number: nextProdVersion,
      config_snapshot: prodConfig,
      prompt_snapshot: promptSnapshot,
      commit_message: commitMsg,
      created_by_email: userEmail ?? null,
      created_by_user_id: userId ?? null,
      github_sha: githubResult?.sha ?? null,
      github_push_ok: githubResult !== null,
    })

    // 7. Mark source version as merged
    await supabase
      .from('pype_agent_config_versions')
      .update({
        merged_to_agent_id: target_agent_id,
        merged_at: new Date().toISOString(),
        merged_by_email: userEmail ?? null,
      })
      .eq('id', versionId)

    return NextResponse.json({
      success: true,
      prod_version_number: nextProdVersion,
      github_push_ok: githubResult !== null,
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Merge failed', error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/agents/[id]/history/[versionId]/merge/route.ts"
git commit -m "feat: add merge-to-prod route for prompt version promotion"
```

---

## Task 7: Pass `environment` prop from config pages to components

**Files:**
- Modify: `src/app/[projectid]/agents/[agentid]/config/pipecat/page.tsx`
- Modify: `src/app/[projectid]/agents/[agentid]/config/livekit/page.tsx`

### 7a — Pipecat page

- [ ] **Step 1: Add `environment` to the Supabase select**

In `src/app/[projectid]/agents/[agentid]/config/pipecat/page.tsx`, find the `useSupabaseQuery` call and change `select` from:
```typescript
select: 'id, name, configuration',
```
to:
```typescript
select: 'id, name, configuration, environment',
```

- [ ] **Step 2: Pass `environment` prop to `PipecatAgentConfig`**

Find the `<PipecatAgentConfig ...>` JSX and add the prop:
```tsx
<PipecatAgentConfig
  agentId={agentid}
  projectId={projectId}
  pipecatAgentId={pipecatAgentId}
  agentName={agent?.name || ''}
  environment={agent?.environment ?? 'dev'}
/>
```

### 7b — LiveKit page

- [ ] **Step 3: Add `environment` to the Supabase select in the livekit page**

In `src/app/[projectid]/agents/[agentid]/config/livekit/page.tsx`, find the `useSupabaseQuery` call and change `select` to include `environment`:
```typescript
select: 'id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted, environment',
```

- [ ] **Step 4: Pass `environment` as a prop/context to the LiveKit config component**

Find the main LiveKit config component usage in that file and pass `environment={agentDataResponse?.[0]?.environment ?? 'dev'}`. (If it's an inline page component rather than a separate component, skip this step and handle read-only mode directly in that page file — add a `const isProd = agentDataResponse?.[0]?.environment === 'prod'` check before the save handler.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/[projectid]/agents/[agentid]/config/pipecat/page.tsx" \
        "src/app/[projectid]/agents/[agentid]/config/livekit/page.tsx"
git commit -m "feat: pass environment field from config pages to agent components"
```

---

## Task 8: Modify `PipecatAgentConfig` — commit message modal + prod read-only

**Files:**
- Modify: `src/components/agents/AgentConfig/Pipecat/PipecatAgentConfig.tsx`

This is the biggest change. We're replacing the silent checkpoint banner ("Save as a version?") with a commit message modal, and adding read-only mode for prod agents.

- [ ] **Step 1: Add `environment` to `PipecatAgentConfigProps`**

Find the `interface PipecatAgentConfigProps` block and add the field:

```typescript
interface PipecatAgentConfigProps {
  agentId: string
  projectId: string
  pipecatAgentId: string
  agentName: string
  environment?: string   // 'dev' | 'prod' — defaults to 'dev'
}
```

- [ ] **Step 2: Destructure `environment` in the component function**

Find:
```typescript
export default function PipecatAgentConfig({
  agentId, projectId, pipecatAgentId, agentName,
}: PipecatAgentConfigProps) {
```

Replace with:
```typescript
export default function PipecatAgentConfig({
  agentId, projectId, pipecatAgentId, agentName, environment = 'dev',
}: PipecatAgentConfigProps) {
```

- [ ] **Step 3: Add commit message modal state variables**

Find the block of `useState` declarations near the top of the component body and add:

```typescript
const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
const [commitMessage, setCommitMessage] = useState('')
const [isSavingVersion, setIsSavingVersion] = useState(false)
const [versionSaveError, setVersionSaveError] = useState<string | null>(null)
```

- [ ] **Step 4: Replace `handleSaveCheckpoint` with the new modal-based version handler**

Find the existing `handleSaveCheckpoint` function:
```typescript
const handleSaveCheckpoint = async () => {
  if (!pendingCheckpoint) return
  ...
}
```

Replace it with:

```typescript
const handleOpenCommitModal = () => {
  setCommitMessage('')
  setVersionSaveError(null)
  setIsCommitModalOpen(true)
}

const handleSaveVersion = async () => {
  if (!pendingCheckpoint || !commitMessage.trim()) return
  setIsSavingVersion(true)
  setVersionSaveError(null)
  try {
    const res = await fetch(`/api/agents/${agentId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pendingCheckpoint,
        commit_message: commitMessage.trim(),
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      setVersionSaveError(err.message ?? 'Failed to save version')
      return
    }
    setIsCommitModalOpen(false)
    setCommitMessage('')
    setPendingCheckpoint(null)
  } catch (err: any) {
    setVersionSaveError(err.message ?? 'Unexpected error')
  } finally {
    setIsSavingVersion(false)
  }
}
```

- [ ] **Step 5: Replace the checkpoint banner JSX with the commit modal**

Find the checkpoint banner block (around line 1312–1352):
```tsx
{/* Checkpoint banner — identical to LiveKit */}
{pendingCheckpoint && (
  <div className="fixed top-[10px] left-1/2 ...">
    ...
    <Button onClick={handleSaveCheckpoint} ...>
      Save version
    </Button>
    ...
  </div>
)}
```

Replace the entire block with:

```tsx
{/* Checkpoint notification + commit modal */}
{pendingCheckpoint && !isCommitModalOpen && (
  <div className="fixed top-[10px] left-1/2 -translate-x-1/2 z-50">
    <div className="relative bg-background border shadow-lg rounded-xl overflow-hidden whitespace-nowrap animate-in slide-in-from-top-4 duration-300">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-muted/50">
        <div className="h-full bg-primary" style={{ animation: 'version-progress 15s linear forwards' }} />
      </div>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 text-sm">
        <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
        <span className="text-foreground text-xs">Config saved. Save as a version?</span>
        <Button type="button" size="sm" className="h-7 text-xs" onClick={handleOpenCommitModal}>
          Save version
        </Button>
        <Button
          type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
          onClick={() => { setPendingCheckpoint(null) }}
        >
          Skip
        </Button>
      </div>
    </div>
  </div>
)}

{/* Commit message dialog */}
<Dialog open={isCommitModalOpen} onOpenChange={v => { if (!v && !isSavingVersion) { setIsCommitModalOpen(false) } }}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="text-sm font-semibold">Save prompt version</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Describe this change</label>
        <Textarea
          placeholder="e.g. Fixed greeting for missed calls"
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          className="text-sm resize-none"
          rows={3}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveVersion()
          }}
        />
        <p className="text-[11px] text-muted-foreground">Press ⌘↵ to save quickly.</p>
      </div>
      {versionSaveError && (
        <p className="text-xs text-destructive">{versionSaveError}</p>
      )}
    </div>
    <div className="flex justify-end gap-2 pt-1">
      <Button
        variant="outline" size="sm" className="h-8 text-xs"
        onClick={() => { setIsCommitModalOpen(false) }}
        disabled={isSavingVersion}
      >
        Cancel
      </Button>
      <Button
        size="sm" className="h-8 text-xs"
        onClick={handleSaveVersion}
        disabled={isSavingVersion || !commitMessage.trim()}
      >
        {isSavingVersion ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</> : 'Save & commit'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Add the `Dialog` and `DialogContent` imports**

At the top of the file, find the existing imports and add Dialog imports if not already present:

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
```

- [ ] **Step 7: Add prod read-only banner**

In the JSX, find the prompt `<Textarea>` (there will be a large text area for the prompt). Find where it's rendered and add a `readOnly` prop conditionally:

```tsx
<Textarea
  ...existing props...
  readOnly={environment === 'prod'}
  className={`...existing classes... ${environment === 'prod' ? 'opacity-70 cursor-not-allowed' : ''}`}
/>
```

Also find the "Update Config" button and add a disabled condition:

```tsx
<Button
  size="sm"
  className="h-8 text-xs"
  onClick={handleSave}
  disabled={isSaving || !isDirty || environment === 'prod'}
>
```

And add the prod banner just after the `{saveError && ...}` block:

```tsx
{environment === 'prod' && (
  <div className="px-6 py-2 flex-shrink-0">
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-400">
        <span className="font-semibold">Production agent — read only.</span>{' '}
        Edit the dev agent and use Merge to Prod to update this prompt.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 9: Commit**

```bash
git add "src/components/agents/AgentConfig/Pipecat/PipecatAgentConfig.tsx"
git commit -m "feat: replace checkpoint banner with commit message modal, add prod read-only mode"
```

---

## Task 9: Extend `ConfigHistory.tsx` with merge UI and GitHub badges

**Files:**
- Modify: `src/components/agents/AgentConfig/ConfigHistory.tsx`

This task adds three things to the existing history sheet:
1. **Commit message** shown on each history row
2. **GitHub sync badge** (green = synced, orange = failed)
3. **Merge to Prod button** with target agent dropdown + confirmation

- [ ] **Step 1: Add new imports to `ConfigHistory.tsx`**

Add these to the existing import block:

```typescript
import { GitBranch, GitMerge, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useUser } from '@clerk/nextjs'
```

- [ ] **Step 2: Add `projectId` prop to `ConfigHistory`**

Find the `interface Props` block:
```typescript
interface Props {
  open: boolean
  onClose: () => void
  agentId: string
}
```

Replace with:
```typescript
interface Props {
  open: boolean
  onClose: () => void
  agentId: string
  projectId: string
  agentEnvironment?: string   // 'dev' | 'prod'
}
```

Update the function signature:
```typescript
export default function ConfigHistory({ open, onClose, agentId, projectId, agentEnvironment = 'dev' }: Props) {
```

- [ ] **Step 3: Add merge dialog state + logic to the main `ConfigHistory` component**

Inside the `ConfigHistory` function body, after the existing state declarations, add:

```typescript
const { user } = useUser()
const [mergeVersionId, setMergeVersionId] = useState<string | null>(null)
const [prodAgents, setProdAgents] = useState<{ id: string; name: string }[]>([])
const [selectedProdAgentId, setSelectedProdAgentId] = useState('')
const [isMerging, setIsMerging] = useState(false)
const [mergeError, setMergeError] = useState<string | null>(null)
const [mergeSuccess, setMergeSuccess] = useState<string | null>(null)

const openMergeDialog = useCallback(async (versionId: string) => {
  setMergeVersionId(versionId)
  setSelectedProdAgentId('')
  setMergeError(null)
  setMergeSuccess(null)
  if (prodAgents.length === 0) {
    const res = await fetch(`/api/agents/prod-list?project_id=${projectId}`)
    if (res.ok) {
      const data = await res.json()
      setProdAgents(data.agents ?? [])
    }
  }
}, [projectId, prodAgents.length])

const handleMerge = useCallback(async () => {
  if (!mergeVersionId || !selectedProdAgentId) return
  setIsMerging(true)
  setMergeError(null)
  try {
    const res = await fetch(`/api/agents/${agentId}/history/${mergeVersionId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_agent_id: selectedProdAgentId,
        userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
        userId: user?.id ?? null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMergeError(data.message ?? 'Merge failed')
      return
    }
    const targetName = prodAgents.find(a => a.id === selectedProdAgentId)?.name ?? 'prod agent'
    setMergeSuccess(`Merged to ${targetName} (v${data.prod_version_number})`)
    // Refresh history to show merged chip
    await fetchHistory(currentPage)
    setTimeout(() => {
      setMergeVersionId(null)
      setMergeSuccess(null)
    }, 2000)
  } catch (err: any) {
    setMergeError(err.message ?? 'Unexpected error')
  } finally {
    setIsMerging(false)
  }
}, [mergeVersionId, selectedProdAgentId, agentId, user, prodAgents, fetchHistory, currentPage])
```

- [ ] **Step 4: Add `GitHubBadge` and `MergedChip` helper components** (inside the file, before `export default`)

```typescript
function GitHubBadge({ ok }: { ok: boolean | null }) {
  if (ok === null || ok === undefined) return null
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 font-medium">
        <CheckCircle2 className="w-2.5 h-2.5" /> GitHub
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" /> Sync failed
    </span>
  )
}

function MergedChip({ mergedAt }: { mergedAt: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border font-medium">
      <GitMerge className="w-2.5 h-2.5" /> Merged
    </span>
  )
}
```

- [ ] **Step 5: Update `HistoryEntryRow` to show commit message, badges, and merge button**

Find the `HistoryEntryRow` function and update its props interface to include the new fields:

```typescript
function HistoryEntryRow({
  entry,
  isCompareBaseline,
  isComparePickMode,
  copiedId,
  showMergeButton,
  onView,
  onCopy,
  onSelectForCompare,
  onCancelBaseline,
  onMerge,
}: {
  entry: {
    id: string
    version_number: number
    created_by_email: string | null
    created_at: string
    commit_message?: string | null
    prompt_snapshot?: string | null
    github_push_ok?: boolean | null
    merged_to_agent_id?: string | null
    merged_at?: string | null
  }
  isCompareBaseline: boolean
  isComparePickMode: boolean
  copiedId: string | null
  showMergeButton: boolean
  onView: (id: string) => void
  onCopy: (id: string) => void
  onSelectForCompare: (id: string) => void
  onCancelBaseline: () => void
  onMerge: (id: string) => void
}) {
```

Then inside the row body, find the metadata section that shows `entry.created_by_email` and add below it:

```tsx
{/* Commit message */}
{entry.commit_message && (
  <p className="text-xs text-foreground/80 mt-1 font-medium truncate max-w-[260px]" title={entry.commit_message}>
    "{entry.commit_message}"
  </p>
)}

{/* Badges row */}
<div className="flex items-center gap-1.5 mt-1 flex-wrap">
  <GitHubBadge ok={entry.github_push_ok ?? null} />
  {entry.merged_to_agent_id && entry.merged_at && (
    <MergedChip mergedAt={entry.merged_at} />
  )}
</div>
```

And in the action buttons area (where Copy and Compare buttons are), add the Merge button:

```tsx
{showMergeButton && !entry.merged_to_agent_id && entry.prompt_snapshot && (
  <button
    onClick={() => onMerge(entry.id)}
    title="Merge to prod"
    className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
  >
    <GitMerge className="w-3 h-3" />
    Merge
  </button>
)}
```

- [ ] **Step 6: Update the `HistoryEntryRow` usage in the list to pass new props**

Find where `<HistoryEntryRow ... />` is rendered in the list and add:

```tsx
showMergeButton={agentEnvironment === 'dev'}
onMerge={openMergeDialog}
```

- [ ] **Step 7: Add the merge dialog JSX** — add this just before the closing `</>` of the Sheet/Dialog return block:

```tsx
{/* Merge to Prod dialog */}
<Dialog open={!!mergeVersionId} onOpenChange={v => { if (!v && !isMerging) setMergeVersionId(null) }}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-sm font-semibold flex items-center gap-2">
        <GitMerge className="w-4 h-4" />
        Merge to Production
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-3 py-2">
      {mergeSuccess ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400 font-medium">{mergeSuccess}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Select the production agent to update with this prompt version.
          </p>
          {prodAgents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No production agents found in this project.
            </p>
          ) : (
            <Select value={selectedProdAgentId} onValueChange={setSelectedProdAgentId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select production agent..." />
              </SelectTrigger>
              <SelectContent>
                {prodAgents.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mergeError && (
            <p className="text-xs text-destructive">{mergeError}</p>
          )}
        </>
      )}
    </div>
    {!mergeSuccess && (
      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="outline" size="sm" className="h-8 text-xs"
          onClick={() => setMergeVersionId(null)}
          disabled={isMerging}
        >
          Cancel
        </Button>
        <Button
          size="sm" className="h-8 text-xs"
          onClick={handleMerge}
          disabled={isMerging || !selectedProdAgentId}
        >
          {isMerging ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Merging...</> : 'Merge & Deploy'}
        </Button>
      </div>
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 8: Update all call sites that render `<ConfigHistory>`**

Search for `<ConfigHistory` in the codebase and add the new required props:

```bash
grep -rn "<ConfigHistory" /Users/tinkalkumar/Documents/GitHub/whispey/src --include="*.tsx"
```

For each usage found, add `projectId={projectId}` and `agentEnvironment={environment ?? 'dev'}`.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 10: Commit**

```bash
git add "src/components/agents/AgentConfig/ConfigHistory.tsx"
git commit -m "feat: add commit message, GitHub badge, and merge-to-prod UI to history panel"
```

---

## Task 10: Fix project table name + final verification

This task handles the one unknown: the `pype_projects` table name used in Tasks 4 and 6.

- [ ] **Step 1: Find the actual project table name**

```bash
grep -rn "from('pype_\|from('projects\|pype_projects\|projects'" \
  /Users/tinkalkumar/Documents/GitHub/whispey/src/app/api \
  --include="*.ts" | grep "supabase\|from(" | head -20
```

- [ ] **Step 2: If the table name is NOT `pype_projects`, fix it**

In `src/app/api/agents/[id]/history/route.ts` and `src/app/api/agents/[id]/history/[versionId]/merge/route.ts`, find and replace `pype_projects` with the correct table name. If no project name lookup table exists at all, replace the lookup with a fallback:

```typescript
// Replace this block:
const { data: project } = await supabase
  .from('pype_projects')
  .select('name')
  .eq('id', agent.project_id)
  .single()
const projectName = project?.name ?? agent.project_id

// With just:
const projectName = agent.project_id  // use ID as folder name if no project table
```

- [ ] **Step 3: Run a full TypeScript check**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Start the dev server and do a manual end-to-end test**

```bash
cd /Users/tinkalkumar/Documents/GitHub/whispey && npm run dev
```

Test checklist:
1. Open a **dev** agent config page → prompt textarea is editable, "Update Config" button is enabled
2. Change the prompt → click "Update Config" → banner appears "Config saved. Save as a version?"
3. Click "Save version" → commit modal opens → type a message → click "Save & commit"
4. Open the History sheet → new version row appears with the commit message and GitHub badge
5. Click "Merge" on the new row → dropdown shows prod agents → select one → click "Merge & Deploy"
6. The row shows a "Merged" chip after success
7. Open a **prod** agent config page → amber banner shows, prompt textarea is read-only, "Update Config" is disabled
8. History sheet on prod agent: no "Merge" buttons visible

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: prompt GitHub sync — full implementation complete"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Dev/prod enforcement (Task 8 — prod banner + disabled save, Task 4 — 403 guard in API)
- ✅ Commit message on save (Task 8 — modal replaces banner)
- ✅ GitHub push on save (Task 2 — lib, Task 4 — called in POST route)
- ✅ `prompt_snapshot` extracted and stored (Task 4)
- ✅ Version history with badges (Task 9)
- ✅ Merge to prod (Task 6 — route, Task 9 — UI)
- ✅ Prod agent also gets a version row + GitHub push on merge (Task 6)
- ✅ Old rows (no `prompt_snapshot`) — Merge button hidden (Task 9, step 5 — `entry.prompt_snapshot` check)
- ✅ GitHub failure is non-fatal (Task 4 — `github_push_ok = false`, badge shown)

**Type consistency:**
- `ConfigHistoryEntry.commit_message` defined in Task 3, used in Task 9 ✅
- `ConfigHistoryEntry.github_push_ok` defined in Task 3, used in Task 9 ✅
- `pushPromptToGitHub` signature in Task 2, called in Tasks 4 and 6 ✅
- `agentEnvironment` prop added in Task 9 step 2, passed in Task 9 step 8 ✅

**One known unknown:** Project table name (`pype_projects`) — handled explicitly in Task 10.
