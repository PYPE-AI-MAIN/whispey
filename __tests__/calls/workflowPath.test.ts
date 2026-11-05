import { describe, expect, it } from 'vitest'
import { visibleMetadata, workflowPath } from '@/components/calls/v2/split/callData'
import type { CallLog } from '@/types/logs'

const call = (metadata: unknown) => ({ metadata }) as unknown as CallLog

describe('workflowPath', () => {
  it('splits the recorded steps in order and keeps them out of the metadata list', () => {
    const c = call({ workflow_path: 'Greet > Confirm > Greet', age: '30' })
    expect(workflowPath(c)).toEqual(['Greet', 'Confirm', 'Greet'])
    expect(visibleMetadata(c).map(([k]) => k)).toEqual(['age'])
  })

  it('is empty for calls without a path', () => {
    expect(workflowPath(call({}))).toEqual([])
    expect(workflowPath(call(null))).toEqual([])
  })
})
