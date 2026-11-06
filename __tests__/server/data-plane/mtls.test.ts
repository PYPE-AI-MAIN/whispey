import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import https from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mtlsFetch } from '@/server/data-plane/adapters/mtlsFetch'
import { createPostgrestPlane } from '@/server/data-plane/adapters/postgrest'
import { DataPlaneResolver } from '@/server/data-plane/resolver'

const haveOpenssl = (() => { try { execFileSync('openssl', ['version']); return true } catch { return false } })()

describe.skipIf(!haveOpenssl)('mTLS to a destination', () => {
  let ca = ''
  let server: https.Server
  let port = 0
  let client: { cert: string; key: string }
  const seen: { cn?: string; auth?: string }[] = []

  beforeAll(async () => {
    const d = mkdtempSync(join(tmpdir(), 'mtls-'))
    const sh = (...a: string[]) => execFileSync('openssl', a, { cwd: d, stdio: 'pipe' })
    sh('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-subj', '/CN=test-ca', '-days', '2')
    const leaf = (name: string, cn: string, ext?: string) => {
      sh('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${cn}`)
      if (ext) writeFileSync(join(d, `${name}.ext`), ext)
      sh('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', `${name}.pem`, '-days', '2', ...(ext ? ['-extfile', `${name}.ext`] : []))
    }
    leaf('server', 'localhost', 'subjectAltName=DNS:localhost')
    leaf('client', 'pype-client')
    const read = (f: string) => readFileSync(join(d, f), 'utf8')
    ca = read('ca.pem')
    client = { cert: read('client.pem'), key: read('client.key') }
    server = https.createServer({ cert: read('server.pem'), key: read('server.key'), ca, requestCert: true, rejectUnauthorized: true }, (req, res) => {
      seen.push({ cn: (req.socket as any).getPeerCertificate().subject?.CN, auth: req.headers.authorization })
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ echoed: body, method: req.method })) })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as any).port
  })
  afterAll(() => server?.close())

  it('presents the client certificate, passes method, headers and body, reads JSON', async () => {
    const f = mtlsFetch(client, { ca, servername: 'localhost' })
    const res = await f(`https://localhost:${port}/x`, { method: 'POST', headers: { Authorization: 'Bearer t' }, body: '{"a":1}' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ echoed: '{"a":1}', method: 'POST' })
    expect(seen.at(-1)).toEqual({ cn: 'pype-client', auth: 'Bearer t' })
  })

  it('the server refuses a connection without the certificate', async () => {
    await expect(fetch(`https://localhost:${port}/x`)).rejects.toThrow()
  })

  it('a destination with mtls and no certificate fails closed', () => {
    const dest = { id: 'd', name: 'acme', config: { base_url: 'https://localhost:1', mtls: true } }
    expect(() => createPostgrestPlane(dest, 'pem')).toThrow(/client certificate/)
  })

  it('the resolver passes the resolved certificate to the plane, and errors when it cannot', async () => {
    const dest = { id: 'd1', name: 'acme', kind: 'postgrest' as const, config: { base_url: 'https://x', mtls: true }, secret_ref: 'env:ACME', schema_version: 1, status: 'healthy' }
    const route = (d: typeof dest) => [{ data_type: 'call_data' as const, state: 'active' as const, version: 1, effective_from: null, destination: d }, { data_type: 'qa' as const, state: 'active' as const, version: 1, effective_from: null, destination: d }, { data_type: 'dnc' as const, state: 'active' as const, version: 1, effective_from: null, destination: d }]
    let got: unknown
    const ok = new DataPlaneResolver({ registry: async () => route(dest), secrets: async () => 'pem', clientCert: async () => client, postgrestPlane: ((_d: unknown, _k: string, c: unknown) => { got = c; return {} as any }) as any })
    await ok.forProject('p')
    expect(got).toEqual(client)
    const plain = new DataPlaneResolver({ registry: async () => route({ ...dest, config: { base_url: 'https://x' } }), secrets: async () => 'pem', clientCert: async () => { throw new Error('should not be asked') }, postgrestPlane: ((_d: unknown, _k: string, c: unknown) => { got = c; return {} as any }) as any })
    await plain.forProject('p')
    expect(got).toBeUndefined()
    const missing = new DataPlaneResolver({ registry: async () => route(dest), secrets: async () => 'pem', clientCert: async () => { throw new Error('missing') }, postgrestPlane: (() => ({})) as any })
    await expect(missing.forProject('p')).rejects.toThrow('missing')
  })
})
