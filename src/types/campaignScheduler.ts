/**
 * What the dashboard assumes of the campaign scheduler API. The scheduler for
 * customer-held campaigns is built elsewhere; every field here is optional on the
 * wire, and the dashboard falls back to today's behaviour when one is missing.
 *
 * Auth (every call): `Authorization: Bearer <service JWT>` (same token as the
 * voice-agent calls), `x-pype-user-id` (Clerk user) and, when known, `x-pype-project-id`.
 */

/** Statuses of one contact. `calling` = a call is in flight right now. */
export const CONTACT_STATUSES = ['pending', 'queued', 'calling', 'in_progress', 'completed', 'failed'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

export interface StatusCounts {
  pending: number
  calling: number
  completed: number
  failed: number
  total: number
}

/**
 * GET /api/v1/campaigns/{id}/contacts?limit=&status=&lastKey=|cursor=
 * Today: { contacts, pagination: { hasMore, nextKey } }.
 * New:   { items, nextCursor }. The dashboard route accepts either and always answers in the first shape.
 */
export interface ContactsPage {
  contacts: Record<string, unknown>[]
  pagination: { hasMore: boolean; nextKey: string | null }
}

/**
 * GET /api/v1/projects/{projectId}/campaigns/counts?ids=a,b,c
 * One call for every campaign on the page, instead of one COUNT per list item.
 * Response: { counts: { [campaignId]: StatusCounts } }. A 404 means "not supported yet".
 */
export interface CampaignCounts {
  counts: Record<string, StatusCounts>
}

export interface ImportReject {
  row: number
  phone?: string
  reason: string
}

/**
 * POST /api/v1/campaigns/upload-file may answer { accepted, rejected, rejects: ImportReject[] }.
 * GET  /api/v1/campaigns/{id}/import answers the live import:
 *   { status: 'processing' | 'done' | 'failed', processed, total, accepted, rejected, rejects }.
 * A 404 means "not supported yet".
 */
export interface ImportStatus {
  status: 'processing' | 'done' | 'failed'
  processed: number
  total: number
  accepted?: number
  rejected?: number
  rejects?: ImportReject[]
}
