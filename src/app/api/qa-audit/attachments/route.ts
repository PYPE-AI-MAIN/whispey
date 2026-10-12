import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
    : {}),
})

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX_BYTES = 5 * 1024 * 1024
const keyPattern = /^qa\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/

async function ticketAccess(ticketId: string) {
  const { data: ticket } = await qaDb.from('qa_flag_tickets').select('agent_id').eq('id', ticketId).maybeSingle()
  if (!ticket) return { error: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }) }
  const access = await resolveAgentAccess(ticket.agent_id)
  if (isQaDenied(access)) return { error: NextResponse.json({ error: access.error }, { status: access.status }) }
  return { access }
}

/** QA team only: upload one image for a ticket; returns the key to attach to a comment. */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const ticketId = String(form?.get('ticketId') ?? '')
  const file = form?.get('file')
  if (!/^[0-9a-f-]{36}$/.test(ticketId) || !(file instanceof File)) return NextResponse.json({ error: 'ticketId and file are required' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Only PNG, JPG, WebP or GIF images' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 })

  const { access, error } = await ticketAccess(ticketId)
  if (error) return error
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can attach images' }, { status: 403 })
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) return NextResponse.json({ error: 'Image storage is not configured' }, { status: 500 })

  const key = `qa/${ticketId}/${randomUUID()}.${ext}`
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type }))
  return NextResponse.json({ key, name: file.name.slice(0, 120) })
}

/** Stream an attached image to anyone who can see the ticket (the bucket stays private). */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? ''
  if (!keyPattern.test(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  const { error } = await ticketAccess(key.split('/')[1])
  if (error) return error
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) return NextResponse.json({ error: 'Image storage is not configured' }, { status: 500 })

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return new NextResponse(Buffer.from(await obj.Body!.transformToByteArray()), {
      headers: { 'Content-Type': obj.ContentType ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}
