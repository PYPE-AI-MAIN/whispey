/**
 * Pi may only link to a path inside this app, and only one a tool result gave
 * it. Anything else — an absolute URL it composed (it used to resolve agent
 * links against the chat page it was on and emit
 * https://.../<project>/pi/<session>/agents/<id>), or a URL that rode in on
 * data it read back, such as an agent prompt or a call transcript — renders as
 * plain text instead of a clickable link, so neither a hallucination nor an
 * injected one can be clicked.
 */
export function internalPiHref(href: string | undefined): string | null {
  if (!href) return null
  // `//host` is protocol-relative and `/\host` is treated as `//host` by
  // browsers — both leave the app despite the leading slash.
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\')) return null
  if (/[\s\p{Cc}]/u.test(href)) return null
  return href
}
