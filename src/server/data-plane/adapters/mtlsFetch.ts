/**
 * fetch() with a TLS client certificate, for a destination whose front end requires mTLS
 * (config.mtls = true). Built on node:https so no HTTP-client dependency is added; it covers
 * what the PostgREST adapter uses: method, headers, string body, abort signal, buffered response.
 */
import https from 'node:https'

export interface ClientCert { cert: string; key: string }

export function mtlsFetch(tls: ClientCert, agentOptions: https.AgentOptions = {}): typeof fetch {
  const agent = new https.Agent({ cert: tls.cert, key: tls.key, keepAlive: true, ...agentOptions })
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      const body = init?.body == null ? undefined : String(init.body)
      if (url.protocol !== 'https:') return reject(new TypeError('mTLS needs an https URL'))
      const req = https.request(
        url,
        { method: init?.method ?? 'GET', headers: Object.fromEntries(headers), agent, signal: init?.signal ?? undefined },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('error', reject)
          res.on('end', () => {
            const out = new Headers()
            for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) out.set(k, Array.isArray(v) ? v.join(', ') : v)
            const status = res.statusCode ?? 0
            const nullBody = status === 204 || status === 304 || init?.method === 'HEAD'
            resolve(new Response(nullBody ? null : Buffer.concat(chunks), { status, statusText: res.statusMessage, headers: out }))
          })
        }
      )
      req.on('error', reject)
      if (body !== undefined) req.write(body)
      req.end()
    })
}
