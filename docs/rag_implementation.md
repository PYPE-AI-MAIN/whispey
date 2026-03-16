# RAG Implementation – Knowledge Base

This document combines: (1) **user guide** for non-technical users setting up the Knowledge Base from the frontend, (2) **chat-ready instructions** to copy-paste in support, and (3) **backend contract** for developers implementing the APIs and RAG tool.

---

# Part 1: User Guide (Frontend – Anyone Can Do This)

Use this to teach your voice agent your own documents and web pages so it can answer from that content during calls. No technical setup—everything is done in the app.

## What is the Knowledge Base?

The **Knowledge Base** lets you add your own files (PDFs, Word, text, etc.) or web page links. When someone talks to your voice agent, it can search this content and answer using your information instead of only general knowledge.

## Step 1: Open Your Agent

1. Go to your **Project**.
2. Open the **Agent** you want to add knowledge to.
3. In the left sidebar, click **Knowledge** (or **Knowledge Base**).

You should see a page titled **Knowledge Base** with an upload area and a box to add a URL.

## Step 2: Add Your Content

### Option A – Upload a file

- **Allowed types:** PDF, TXT, Word (.doc, .docx), CSV  
- **Max size:** 20 MB per file  

**What to do:**

1. In the **“Add content”** section, find the dashed box that says **“Drag and drop or click to upload”**.
2. Either:
   - **Drag** a file from your computer onto that box, or  
   - **Click** the box and choose the file from your computer.
3. Wait until you see the file listed under **“Documents in this knowledge base”**.  
   If you see an error (e.g. “Unsupported file type” or “File too large”), use a different file or a smaller one.

### Option B – Add a web page (URL)

1. In the same section, find **“Add from URL”**.
2. Paste the full web address (e.g. `https://example.com/your-page`) into the box.
3. Click **Add**.
4. Wait until the URL appears in the document list below.

## Step 3: Turn On the Knowledge Base for Your Agent

Adding files or URLs is not enough by itself. You must **enable** the Knowledge Base in your agent settings.

1. Go back to your agent (use the **Back** arrow on the Knowledge Base page, or open the agent again).
2. Open **Agent configuration** (or **Config** / **Settings** for the agent).
3. Find **Advanced** or **RAG Settings** and open that section.
4. Turn **“Enable Knowledge Base search”** **ON** (toggle to enabled).
5. (Optional) **Top K** – This is “how many pieces of your documents to use per question.”  
   - Default is **5**. You can leave it as is.  
   - If answers feel incomplete, try **7–10**. If answers feel too long or noisy, try **3**.
6. **Save** your agent configuration so the changes apply.

## Step 4: Remove Something from the Knowledge Base

1. Go to **Knowledge** for that agent (sidebar).
2. Under **“Documents in this knowledge base”**, find the file or URL you want to remove.
3. Hover over that row; a **trash** (delete) icon appears on the right.
4. Click the trash icon to delete that document. It will disappear from the list and no longer be used by the agent.

## Quick Checklist

- [ ] Opened the right **Agent** and went to **Knowledge**.
- [ ] Added at least one **file** (PDF, TXT, Word, CSV) or one **URL**.
- [ ] Saw the document in the list under **“Documents in this knowledge base”**.
- [ ] In Agent config, turned **“Enable Knowledge Base search”** **ON**.
- [ ] **Saved** the agent configuration.

After this, your voice agent will use your uploaded content when answering during calls.

## Troubleshooting (Simple)

| What you see | What to do |
|--------------|------------|
| “Unsupported file type” | Use only PDF, TXT, Word (.doc/.docx), or CSV. |
| “File too large” | Use a file under 20 MB, or split into smaller files. |
| “Upload failed” or “URL ingestion failed” | Check your internet; try again. If it keeps failing, your admin may need to check the backend. |
| Agent doesn’t use my documents | Make sure **“Enable Knowledge Base search”** is ON in agent config and you clicked **Save**. |
| Too much or too little from my docs in answers | Change **Top K** in RAG settings (e.g. 3 for less, 7–10 for more). |

---

# Part 2: Copy-Paste Instructions for Chat

Use this short version to send in chat so anyone can set up the Knowledge Base from the frontend.

**Copy from here ↓**

---

**How to set up the Knowledge Base (so your voice agent uses your documents):**

1. **Go to your agent** → In the left menu click **Knowledge** (Knowledge Base page).

2. **Add content**
   - **Files:** Drag and drop (or click) in the upload box. Allowed: PDF, TXT, Word (.doc, .docx), CSV. Max 20 MB per file.
   - **Web page:** In “Add from URL” paste the link (e.g. https://yoursite.com/page) and click **Add**.

3. **Turn it on**  
   Go back to your agent → open **Agent config** → find **RAG Settings** / **Advanced** → turn **“Enable Knowledge Base search”** **ON** → **Save**.

4. **Remove something**  
   On the Knowledge page, hover over a document in the list and click the **trash** icon.

That’s it. After saving, the agent will use your uploaded files and URLs when answering on calls.

**If you get “Unsupported file type”** → use only PDF, TXT, Word, or CSV.  
**If the agent doesn’t use your docs** → make sure “Enable Knowledge Base search” is ON and you clicked Save.

---

**Copy until here ↑**

---

# Part 3: Backend Contract (For Developers)

The frontend implements a **Knowledge Base** UI per agent. Users can upload files (PDF, TXT, DOC, DOCX, CSV) or add URLs. The frontend calls your backend; you are responsible for storing content in a **vector DB**, indexing it by `agent_id`, and exposing a **tool** so the LiveKit voice agent can retrieve relevant chunks during conversations.

## 1. API endpoints (backend must implement)

Base URL: same as your existing agent API (e.g. `NEXT_PUBLIC_PYPEAI_API_URL`). All requests use header: `x-api-key: <your-api-key>` (e.g. `pype-api-v1`).

### 1.1 Upload file

- **Method:** `POST`
- **Path:** `/knowledge/upload`
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `agent_id` (string, required): Agent ID (same as used in agent config / LiveKit).
  - `file` (file, required): One of PDF, TXT, DOC, DOCX, CSV. Max size enforced by frontend: 20MB.
- **Success:** `200` with JSON body (e.g. `{ id, name, ... }`).
- **Failure:** `4xx`/`5xx` with JSON `{ error: "message" }`.

Backend should: accept file, parse text (and/or extract text from PDF/DOC), chunk text, compute embeddings, store in vector DB with metadata `agent_id`, return a document identifier.

### 1.2 Ingest URL

- **Method:** `POST`
- **Path:** `/knowledge/url`
- **Content-Type:** `application/json`
- **Body:** `{ "url": "https://...", "agent_id": "<agent_id>" }`
- **Success:** `200` with JSON (e.g. `{ id, url, ... }`).
- **Failure:** `4xx`/`5xx` with JSON `{ error: "message" }`.

Backend should: fetch URL content (HTML/text), extract main content, chunk, embed, store in vector DB with `agent_id`.

### 1.3 List documents

- **Method:** `GET`
- **Path:** `/knowledge/documents?agent_id=<agent_id>`
- **Success:** `200` with JSON: `{ "documents": [ { "id", "name"?, "filename"?, "type"?: "file"|"url", "url"?, "created_at"?, ... } ] }`.
- **Failure:** `4xx`/`5xx` with JSON `{ error: "message" }`.

Return all documents (files + URLs) stored for the given `agent_id`.

### 1.4 Delete document

- **Method:** `DELETE`
- **Path:** `/knowledge/documents/:id`
- **Success:** `200` (body optional, e.g. `{ "success": true }`).
- **Failure:** `4xx`/`5xx` with JSON `{ error: "message" }`.

Remove the document and its chunks from the vector DB.

## 2. Agent tool (RAG retrieval)

So that the **Voice AI agent** (LiveKit) can use the knowledge base during a call:

1. **Register a tool** (e.g. `knowledge_search` or `rag_retrieve`) in the same way you register other tools (e.g. in agent config / save-and-deploy flow).
2. **Tool input:** e.g. `query` (string). Optionally `agent_id` or derive from current session.
3. **Tool implementation:**  
   - Take the user/agent query, optionally filter by `agent_id`.  
   - Query your vector DB (similarity search).  
   - Return top-k relevant chunks (or a single concatenated answer) as the tool result.
4. The LLM uses this result to answer the user within the voice conversation.

Tool name/parameters should match what you use in your agent runtime (e.g. LiveKit agent’s tool definitions). The frontend does **not** define this tool; it only provides the UI for uploading/list/delete. You add the tool in the backend and in the agent config so the running agent can call it.

## 3. agent_id = agent name

**Important:** For all knowledge API calls, `agent_id` must be the **agent name** (e.g. `Test_a2e7a0fa_c64c_4840_a063_dad5a3df685e`), i.e. the same value used in `/agent_config/{agent_name}` and in the agent list. The frontend resolves this from the Supabase agent record: `{display_name}_{agent_uuid_with_underscores}`.

## 4. Summary

| Action        | Frontend → Next.js API        | Next.js API → Your backend      |
|---------------|------------------------------|---------------------------------|
| Upload file   | `POST /api/knowledge/upload`  | `POST {base}/knowledge/upload`   |
| Add URL       | `POST /api/knowledge/url`     | `POST {base}/knowledge/url`      |
| List docs     | `GET /api/knowledge/documents?agent_id=` | `GET {base}/knowledge/documents?agent_id=` |
| Delete doc    | `DELETE /api/knowledge/documents/:id`    | `DELETE {base}/knowledge/documents/:id`   |

- **Vector DB:** Your choice (e.g. Pinecone, Weaviate, pgvector, Chroma). Store chunks keyed by `agent_id`.
- **RAG tool:** Backend auto-injects `knowledge_search` when the agent has KB documents; the frontend optionally triggers a config save after upload/URL so the assistant is regenerated without the user pressing Save.
