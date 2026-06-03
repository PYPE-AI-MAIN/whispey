# Prompt Version Control with GitHub Sync

**Date:** 2026-06-03  
**Branch:** feature/prompt-github-sync  
**Status:** Approved for implementation

---

## 1. Problem Statement

Today, agent prompts are saved as part of a large `config_snapshot` JSON blob in `pype_agent_config_versions`. There is no:
- Commit message on a save to explain *why* the prompt changed
- Human-readable audit trail in GitHub showing prompt history per agent
- Guardrail preventing someone from editing a production agent's prompt directly
- One-click way to promote a tested dev prompt to a prod agent

This feature adds all four.

---

## 2. Scope

- **In scope:** Prompt field only (`assistant[0].prompt` inside `config_snapshot`). All other config fields (tools, VAD, STT, TTS, etc.) are unaffected.
- **Out of scope:** Non-pype agents (Retell, VAPI, Livekit), rollback to a previous version (read-only history only for now), per-user GitHub OAuth.

---

## 3. Core Concepts

### Dev vs Prod agents
Agents have an `environment` field in `pype_voice_agents` (Supabase). Default is `'dev'`. Admins flip it to `'prod'` manually via Supabase. This field is the single source of truth for edit permissions.

- **Dev agent** — prompt is editable, every save creates a versioned commit
- **Prod agent** — prompt editor is read-only in the UI; only writable via the merge flow

### Version = commit
Every time a dev agent's prompt is saved, a row is inserted into `pype_agent_config_versions` with a `commit_message` written by the user. This is the "commit". The same save also pushes the prompt to GitHub as a file update.

### Merge = promote
A specific version row can be "merged" to a prod agent. Merging copies the prompt to the prod agent, triggers a full save-and-deploy for the prod agent (updating DynamoDB and local YAML files), and creates a new version row for the prod agent as well.

---

## 4. Data Model

### 4.1 Existing table: `pype_agent_config_versions`

Already has: `id`, `agent_id`, `project_id`, `version_number`, `config_snapshot` (full JSON), `commit_message` (exists, currently null), `prompt_snapshot` (exists, currently null), `created_by_email`, `created_by_user_id`, `created_at`.

### 4.2 New columns (ALTER TABLE only — no new table)

```sql
ALTER TABLE pype_agent_config_versions
  ADD COLUMN github_sha           text,         -- SHA of the GitHub commit; null if push failed
  ADD COLUMN github_push_ok       boolean DEFAULT false,  -- false = GitHub diverged, show warning
  ADD COLUMN merged_to_agent_id   uuid REFERENCES pype_voice_agents(id),  -- set after merge
  ADD COLUMN merged_at            timestamptz,
  ADD COLUMN merged_by_email      text;
```

### 4.3 `prompt_snapshot` usage
On every save, extract `config_snapshot.agent.assistant[0].prompt` and store it in `prompt_snapshot`. This avoids parsing the large JSON blob on every history list render.

### 4.4 Env variables

```
PROMPT_GITHUB_REPO=org/repo-name       # e.g. PYPE-AI-MAIN/whispey-prompts
PROMPT_GITHUB_TOKEN=ghp_xxxx           # Fine-grained PAT, contents:write on that repo
```

---

## 5. GitHub Repo Structure

One dedicated repo. Folder structure:

```
prompts/
  {project-name}/
    {agent-name}/
      prompt.md
```

Example:
```
prompts/
  sarvodaya/
    Sarvodaya_Miss_dev/
      prompt.md
    Sarvodaya_Miss_prod/
      prompt.md
```

Each `prompt.md` is always overwritten in-place. GitHub's native commit history IS the version trail for that file. The Supabase rows are the operational index (fast reads, merge metadata).

---

## 6. New Server Module: `src/lib/github-prompts.ts`

Handles all GitHub API calls. Server-only (`import 'server-only'`).

```typescript
// Upsert prompt.md for a given project + agent name
pushPromptToGitHub(
  projectName: string,
  agentName: string,
  promptContent: string,
  commitMessage: string,
  authorEmail: string
): Promise<{ sha: string } | null>  // null = push failed (non-throwing)
```

**GitHub API flow:**
1. `GET /repos/{owner}/{repo}/contents/prompts/{project}/{agent}/prompt.md` — get current file SHA (needed for update)
2. `PUT /repos/{owner}/{repo}/contents/...` — create or update the file with the new content and commit message
3. Return the new commit SHA

**Error handling:** If GitHub is unreachable or returns non-2xx, log the error and return `null`. The calling route stores `github_push_ok = false` and shows a warning badge in the UI. The save to Supabase and DynamoDB always proceeds regardless.

---

## 7. API Routes

### 7.1 Modified: `POST /api/agents/[id]/history`

**What changes:**
- Accept `commit_message` (required, non-empty string) in request body
- Accept `userEmail` (already accepted)
- Extract `prompt_snapshot` from the config before inserting
- After Supabase insert, call `pushPromptToGitHub()` and store the returned SHA + push status
- **Guard:** If `pype_voice_agents.environment = 'prod'` → return `403 Forbidden`. Prompt versioning from the UI is dev-only.

**Updated request body:**
```json
{
  "config": { ... },
  "commit_message": "Improved greeting flow for missed calls",
  "userEmail": "joel@pypeai.com",
  "userId": "user_xxx"
}
```

**Updated insert payload:**
```typescript
{
  agent_id, project_id, version_number,
  config_snapshot: snapshot,
  prompt_snapshot: snapshot?.agent?.assistant?.[0]?.prompt ?? null,
  commit_message,
  created_by_email: userEmail,
  created_by_user_id: userId,
  github_sha: githubResult?.sha ?? null,
  github_push_ok: githubResult !== null,
}
```

### 7.2 Modified: `GET /api/agents/[id]/history`

**What changes:** Include `commit_message`, `prompt_snapshot`, `github_push_ok`, `merged_to_agent_id`, `merged_at` in the select fields (for history list display).

### 7.3 New: `POST /api/agents/[id]/history/[versionId]/merge`

Promotes a specific dev prompt version to a target prod agent.

**Request body:**
```json
{
  "target_agent_id": "uuid-of-prod-agent",
  "userEmail": "joel@pypeai.com",
  "userId": "user_xxx"
}
```

**Steps (all or nothing — stop and return error on any failure):**

1. Fetch the source version row from `pype_agent_config_versions` (verify it belongs to agent `[id]`)
2. Fetch the target prod agent from `pype_voice_agents` — verify `environment = 'prod'`, verify it belongs to the caller's Clerk org
3. Fetch the target prod agent's current full config from Supabase
4. Merge the `prompt_snapshot` into the prod agent's config: `prodConfig.agent.assistant[0].prompt = promptSnapshot`
5. Call `POST /api/agents/save-and-deploy` with the merged prod config → updates DynamoDB + local YAML files
6. Insert a new row into `pype_agent_config_versions` for the prod agent (with the same `prompt_snapshot`, commit message = `"Merged from dev v{version_number} by {userEmail}"`)
7. Push to GitHub under the prod agent's folder via `pushPromptToGitHub()`
8. Update the source version row: set `merged_to_agent_id`, `merged_at`, `merged_by_email`
9. Return `{ success: true, prod_version_number: N }`

### 7.4 New: `GET /api/agents/prod-list?org_id=xxx`

Returns all agents across the organisation where `environment = 'prod'`. Used to populate the merge target dropdown. Scoped to the caller's Clerk org so users only see agents they own.

```json
{
  "agents": [
    { "id": "uuid", "name": "Sarvodaya_Miss_prod", "project_name": "sarvodaya" },
    ...
  ]
}
```

---

## 8. UI Changes

### 8.1 Prompt editor on agent config page

**For dev agents (`environment = 'dev'`):**
- Prompt textarea remains editable (no change)
- Existing "Save" / "Deploy" button is extended: clicking it opens a small modal with a `commit_message` input before submitting
- Modal: title "Save prompt version", one text field "Describe this change", a "Save & Deploy" button
- On success: history panel refreshes

**For prod agents (`environment = 'prod'`):**
- Prompt textarea gets `readOnly` + a muted "Production — read only" label
- Save button is hidden
- A banner: `"This is a production agent. Edit the dev agent and merge to update this prompt."`

### 8.2 Version history panel (below prompt editor)

A collapsible `<PromptHistoryPanel agentId={id} />` component below the prompt textarea.

**List item shows:**
- Version number (e.g. `v14`)
- Commit message (truncated to 80 chars)
- Author email + relative timestamp (e.g. "joel@pypeai.com · 3 days ago")
- GitHub sync badge: green checkmark if `github_push_ok = true`, orange warning "GitHub sync failed" if false
- Merge status: if `merged_to_agent_id` is set → a grey "Merged to prod" chip with the prod agent name
- "Merge to Prod" button — only shown for dev agents, only on versions not yet merged

**Clicking "Merge to Prod":**
1. Opens a confirmation dialog
2. Shows a dropdown populated from `GET /api/agents/prod-list?project_id=xxx`
3. Dropdown label: "Select production agent to update"
4. Confirm button: "Merge & Deploy"
5. On success: toast "Prompt merged to [prod agent name] and deployed", version row updates to show "Merged" chip

### 8.3 Test this version
Each history list item also has a "Test" button (secondary, small). Clicking it opens the existing prompt-forge / playground page with the `prompt_snapshot` of that version pre-loaded, so the user can test the agent's behaviour for that specific prompt before deciding to merge.

---

## 9. Access Control Summary

| Action | Dev agent | Prod agent |
|---|---|---|
| View prompt | Yes | Yes (read-only) |
| Edit prompt textarea | Yes | No |
| Save with commit | Yes | No (403 from API) |
| View version history | Yes | Yes |
| Merge to prod | Yes (source) | Yes (target only) |
| Test a version | Yes | Yes |

---

## 10. Error Cases & Handling

| Scenario | Behaviour |
|---|---|
| GitHub push fails on save | Version still saved in Supabase + deployed to DynamoDB. `github_push_ok = false`. UI shows orange "GitHub sync failed" badge on that version. |
| `PROMPT_GITHUB_REPO` / `PROMPT_GITHUB_TOKEN` not set | `pushPromptToGitHub` returns `null` immediately. All saves/merges still work; GitHub badge always shows as failed. |
| Merge target is not a prod agent | API returns `403`. UI never shows non-prod agents in the dropdown. |
| `save-and-deploy` fails during merge | Merge is aborted. No Supabase version row is written for the prod agent. Source version's `merged_to_agent_id` is NOT set. User sees error toast. |
| User tries to save on a prod agent via API directly | `POST /api/agents/[id]/history` returns `403` after checking `environment` field. |
| Prompt exceeds DynamoDB 400KB limit | Existing overflow-to-S3 logic in the backend handles this unchanged. |
| Version has no `prompt_snapshot` (old rows) | "Test" button and merge are disabled with tooltip: "Prompt snapshot not available for this version." |

---

## 11. Implementation Order

1. **DB migration** — `ALTER TABLE` to add 5 columns
2. **`src/lib/github-prompts.ts`** — GitHub push module
3. **`POST /api/agents/[id]/history`** — add commit_message + prompt_snapshot + GitHub push + prod guard
4. **`GET /api/agents/[id]/history`** — extend select fields
5. **`GET /api/agents/prod-list`** — new route
6. **`POST /api/agents/[id]/history/[versionId]/merge`** — new merge route
7. **`<PromptHistoryPanel />`** — UI component with list, badges, merge dialog
8. **Prompt editor** — commit message modal on save + read-only mode for prod

---

## 12. Open Questions (resolve before implementation)

- [ ] Should merging require a second confirmation step showing a prompt diff (old prod vs new)?
- [ ] Should the 100-version retention cap apply to prod agent versions created via merge, or is merge history kept forever?
- [ ] Should the "GitHub sync failed" badge have a manual retry button?
