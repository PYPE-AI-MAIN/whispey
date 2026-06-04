import 'server-only'

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

function filePath(projectName: string, agentName: string): string {
  return `prompts/${safeSegment(projectName)}/${safeSegment(agentName)}/prompt.md`
}

async function getCurrentSha(path: string): Promise<string | null> {
  if (!REPO || !TOKEN) return null
  try {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
      headers: ghHeaders(),
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

  const body: Record<string, unknown> = {
    message: `${commitMessage}\n\nAuthor: ${authorEmail}`,
    content: Buffer.from(promptContent).toString('base64'),
    branch: 'main',
  }
  if (currentSha) body.sha = currentSha

  try {
    const res = await fetch(`${BASE}/repos/${REPO}/contents/${path}`, {
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
    const sha: string = data.commit?.sha ?? data.content?.sha ?? ''
    return { sha }
  } catch (err) {
    console.error('[github-prompts] Unexpected error:', err)
    return null
  }
}
