import 'server-only'
import yaml from 'js-yaml'

// Strip https://github.com/ prefix if user accidentally sets full URL
function normaliseRepo(raw: string): string {
  return raw.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
}

const REPO = normaliseRepo(process.env.PROMPT_GITHUB_REPO ?? '')
const TOKEN = process.env.PROMPT_GITHUB_TOKEN ?? ''
const BASE = 'https://api.github.com'

function ghHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_')
}

// Recursively normalize \r\n → \n so js-yaml uses block scalars instead of
// collapsing multi-line strings to a single quoted line.
function normalizeLineEndings(val: any): any {
  if (typeof val === 'string') return val.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (Array.isArray(val)) return val.map(normalizeLineEndings)
  if (val && typeof val === 'object') {
    const out: any = {}
    for (const k of Object.keys(val)) out[k] = normalizeLineEndings(val[k])
    return out
  }
  return val
}

function configFilePath(projectName: string, agentName: string): string {
  return `agents/${safeSegment(projectName)}/${safeSegment(agentName)}/config.yml`
}

async function getCurrentSha(path: string, ref: string = 'main'): Promise<string | null> {
  if (!REPO || !TOKEN) return null
  try {
    const res = await fetch(
      `${BASE}/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
      { headers: ghHeaders(), cache: 'no-store' }
    )
    if (res.status === 404) return null
    if (!res.ok) return null
    const data = await res.json()
    return (data as any).sha ?? null
  } catch {
    return null
  }
}

async function getDefaultBranchSha(): Promise<string | null> {
  if (!REPO || !TOKEN) return null
  try {
    const res = await fetch(`${BASE}/repos/${REPO}/git/ref/heads/main`, {
      headers: ghHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data as any).object?.sha ?? null
  } catch {
    return null
  }
}

/**
 * Appends supplemental settings (webhook, dropoff, callback) to a core agent
 * config snapshot so the resulting GitHub YAML shows all changed configuration.
 * Pass null/undefined for settings that are not present.
 */
export function enrichSnapshotForGitHub(
  baseSnapshot: any,
  webhooks: any[] | null | undefined,
  dropoff: any,
  callbackSettings: any,
): any {
  const enriched: any = { ...baseSnapshot }
  if (webhooks?.length) enriched.webhook_configs = webhooks
  if (dropoff) enriched.dropoff_settings = dropoff
  if (callbackSettings) enriched.callback_settings = callbackSettings
  return enriched
}

export async function pushPromptToGitHub(
  projectName: string,
  agentName: string,
  configSnapshot: any,
  commitMessage: string,
  authorEmail: string,
): Promise<{ sha: string } | null> {
  if (!REPO || !TOKEN) return null

  const path = configFilePath(projectName, agentName)
  const currentSha = await getCurrentSha(path)
  const yamlContent = yaml.dump(normalizeLineEndings(configSnapshot), { lineWidth: -1, noRefs: true, sortKeys: true })

  const authorName = authorEmail.split('@')[0]
  const body: Record<string, unknown> = {
    message: `${commitMessage}\n\nAuthor: ${authorEmail}`,
    content: Buffer.from(yamlContent, 'utf8').toString('base64'),
    branch: 'main',
    author: { name: authorName, email: authorEmail },
  }
  if (currentSha) body.sha = currentSha

  try {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: ghHeaders(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[github-prompts] PUT failed:', res.status, errText)
      return null
    }

    const data = await res.json()
    const sha: string = (data as any).commit?.sha ?? (data as any).content?.sha ?? ''
    return { sha }
  } catch (err) {
    console.error('[github-prompts] Unexpected error:', err)
    return null
  }
}

// Create a PR branch, push the full agent config as YAML, and open a GitHub PR.
// Returns { pr_number, pr_url, branch } on success, null on any failure.
export async function createMergePR(
  projectName: string,
  agentName: string,
  configSnapshot: any,
  prTitle: string,
  prBody: string,
  authorEmail: string,
  versionId: string,
): Promise<{ pr_number: number; pr_url: string; branch: string } | null> {
  if (!REPO || !TOKEN) return null

  const mainSha = await getDefaultBranchSha()
  if (!mainSha) {
    console.error('[github-prompts] Could not get main branch SHA')
    return null
  }

  const branchName = `merge/${safeSegment(agentName)}-${versionId.substring(0, 8)}`

  // Delete branch if it already exists from a previous partial attempt
  await fetch(`${BASE}/repos/${REPO}/git/refs/heads/${branchName}`, {
    method: 'DELETE',
    headers: ghHeaders(),
  }).catch(() => {})

  // Create branch from main
  const branchRes = await fetch(`${BASE}/repos/${REPO}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha }),
  })
  if (!branchRes.ok) {
    console.error('[github-prompts] Branch creation failed:', branchRes.status, await branchRes.text())
    return null
  }

  // Serialize the full agent config to YAML and push as config.yml
  const path = configFilePath(projectName, agentName)
  const yamlContent = yaml.dump(normalizeLineEndings(configSnapshot), { lineWidth: -1, noRefs: true, sortKeys: true })
  const existingSha = await getCurrentSha(path, branchName)

  const authorName = authorEmail.split('@')[0]
  const fileBody: Record<string, unknown> = {
    message: `${prTitle}\n\nAuthor: ${authorEmail}`,
    content: Buffer.from(yamlContent, 'utf8').toString('base64'),
    branch: branchName,
    author: { name: authorName, email: authorEmail },
  }
  if (existingSha) fileBody.sha = existingSha

  const fileRes = await fetch(`${BASE}/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify(fileBody),
  })
  if (!fileRes.ok) {
    console.error('[github-prompts] File push to branch failed:', fileRes.status, await fileRes.text())
    return null
  }

  // Create PR
  const prRes = await fetch(`${BASE}/repos/${REPO}/pulls`, {
    method: 'POST',
    headers: ghHeaders(),
    body: JSON.stringify({ title: prTitle, body: prBody, head: branchName, base: 'main' }),
  })
  if (!prRes.ok) {
    console.error('[github-prompts] PR creation failed:', prRes.status, await prRes.text())
    return null
  }

  const prData = await prRes.json() as any
  return { pr_number: prData.number, pr_url: prData.html_url, branch: branchName }
}
