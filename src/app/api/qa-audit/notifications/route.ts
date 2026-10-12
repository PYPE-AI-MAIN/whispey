import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { qaDb } from '@/server/qa/access'

async function myEmail() {
  const { userId } = await auth()
  if (!userId) return null
  return ((await currentUser())?.emailAddresses?.[0]?.emailAddress ?? '').toLowerCase() || null
}

/** The caller's own bell notifications, newest first. */
export async function GET() {
  const email = await myEmail()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await qaDb
    .from('qa_inbox')
    .select('id, title, body, link, read_at, created_at')
    .eq('recipient_email', email)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [], unread: (data ?? []).filter((n) => !n.read_at).length })
}

/** Mark all of the caller's notifications read. */
export async function PATCH() {
  const email = await myEmail()
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await qaDb.from('qa_inbox').update({ read_at: new Date().toISOString() }).eq('recipient_email', email).is('read_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
