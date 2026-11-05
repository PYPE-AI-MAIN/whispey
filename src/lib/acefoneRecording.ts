// Calls placed through Acefone have their telephony recording in Acefone's
// console. The link needs a per-recording token from Acefone's CDR API, which
// /api/acefone-recording resolves server-side on each click.

/** The Acefone call id from a call's metadata, or null when it isn't an Acefone call. */
export function acefoneCallIdOf(metadata: any): string | null {
  return metadata?.acefone_call_id
    || (metadata?.provider === 'acefone' ? (metadata?.callId || metadata?.callid || metadata?.call_id) : null)
    || null
}

export async function openAcefoneRecording(callId: string, agentId: string) {
  // Open the tab synchronously so popup blockers don't eat it, then navigate.
  const win = window.open('', '_blank')
  try {
    const res = await fetch('/api/acefone-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, agentId }),
    })
    const d = res.ok ? await res.json() : null
    if (d?.recordingUrl && win) {
      win.location.href = d.recordingUrl
    } else {
      win?.close()
      alert('Telephony recording not found for this call')
    }
  } catch {
    win?.close()
    alert('Failed to fetch telephony recording')
  }
}
