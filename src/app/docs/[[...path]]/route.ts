// The Whispey docs, signed-in only. The middleware has already checked the
// Clerk session for every /docs request (pages and their files alike); this
// serves the docs site built into .docs-build by `npm run build:docs`.
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT = path.join(process.cwd(), '.docs-build')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
}

/** The file for a docs path, or null. Page paths map to their index.html. Never leaves ROOT. */
async function resolveFile(parts: string[]): Promise<string | null> {
  const target = path.resolve(ROOT, ...parts.map((p) => decodeURIComponent(p)))
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null
  for (const candidate of [target, path.join(target, 'index.html'), `${target}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate
    } catch {
      // not this one
    }
  }
  return null
}

function fileResponse(body: Buffer, file: string, status = 200) {
  const ext = path.extname(file).toLowerCase()
  // Hashed build assets never change; pages are revalidated so new docs show up on deploy.
  const cache = /\.[0-9a-f]{8,}\./.test(path.basename(file)) ? 'private, max-age=31536000, immutable' : 'private, no-cache'
  return new NextResponse(new Uint8Array(body), {
    status,
    headers: {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': cache,
      'X-Robots-Tag': 'noindex',
    },
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path: parts = [] } = await params
  const file = await resolveFile(parts)
  if (file) return fileResponse(await readFile(file), file)

  const notFound = path.join(ROOT, '404.html')
  try {
    return fileResponse(await readFile(notFound), notFound, 404)
  } catch {
    return new NextResponse(
      'The docs are not built. Run `npm run build:docs` and reload.',
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  }
}
