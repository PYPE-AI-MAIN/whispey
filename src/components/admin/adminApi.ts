export async function adminCall<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(json.error || 'Something went wrong'), { body: json })
  return json as T
}
export const post = (url: string, body: unknown, method = 'POST') =>
  adminCall(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
