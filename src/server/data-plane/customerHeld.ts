import { NextResponse } from 'next/server'
import { DataPlaneError } from './errors'
import { getDataPlaneResolver } from './resolver'

export const NOT_AVAILABLE_CODE = 'not_available_for_customer_held_project'

/**
 * Analytics, journeys and Pi chat read Pype's database directly, which cannot
 * reach a customer-held project's data. Returns the typed 501 for such a project
 * (503 if the registry cannot be read), or null when the feature is available.
 */
export async function customerHeldResponse(projectId: string): Promise<NextResponse | null> {
  try {
    if (!(await getDataPlaneResolver().isCustomerHeld(projectId))) return null
  } catch (e) {
    if (!(e instanceof DataPlaneError)) throw e
    return NextResponse.json({ error: e.message, code: e.code, retryable: true }, { status: 503, headers: { 'Retry-After': '5' } })
  }
  return NextResponse.json(
    {
      error: 'not_available',
      code: NOT_AVAILABLE_CODE,
      message: "Not available yet: this project's call data is held in the customer's own database, and this feature cannot read it.",
    },
    { status: 501 }
  )
}
