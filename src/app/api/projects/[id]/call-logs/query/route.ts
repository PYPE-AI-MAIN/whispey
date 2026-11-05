import { NextRequest } from 'next/server'
import { withDataPlane } from '@/server/data-plane'
import { handleCallLogsQuery } from '@/server/callLogs/queryHandler'

export const POST = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => handleCallLogsQuery(dp, request, { kind: 'project', projectId: (await params).id }))
