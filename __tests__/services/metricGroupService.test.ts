import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetricGroupService } from '@/services/metricGroupService'
import { MetricGroup } from '@/types/metricGroups'

const mockGroup: MetricGroup = {
  id: 'group-1',
  name: 'Test Group',
  project_id: 'proj-1',
  agent_id: 'agent-1',
  user_email: 'test@example.com',
  metrics: [],
  order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('MetricGroupService.getMetricGroups', () => {
  it('returns metric groups on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: [mockGroup] }))
    const result = await MetricGroupService.getMetricGroups('proj-1', 'agent-1', 'test@example.com')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('group-1')
  })

  it('returns empty array on fetch error (non-ok response)', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Not found' }, false, 404))
    const result = await MetricGroupService.getMetricGroups('proj-1', 'agent-1', 'test@example.com')
    expect(result).toEqual([])
  })

  it('returns empty array when data is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: null }))
    const result = await MetricGroupService.getMetricGroups('proj-1', 'agent-1', 'test@example.com')
    expect(result).toEqual([])
  })

  it('returns empty array on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await MetricGroupService.getMetricGroups('proj-1', 'agent-1', 'test@example.com')
    expect(result).toEqual([])
  })

  it('builds correct query params', async () => {
    const fetchMock = mockFetch({ data: [] })
    vi.stubGlobal('fetch', fetchMock)
    await MetricGroupService.getMetricGroups('proj-1', 'agent-1', 'test@example.com')
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('projectId=proj-1')
    expect(calledUrl).toContain('agentId=agent-1')
  })
})

describe('MetricGroupService.createMetricGroup', () => {
  const newGroup = { name: 'New', project_id: 'p', agent_id: 'a', user_email: 'u@e.com', metrics: [], order: 0 }

  it('returns success with data on 200', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: { ...newGroup, id: 'new-id', created_at: '', updated_at: '' } }))
    const result = await MetricGroupService.createMetricGroup(newGroup)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('new-id')
  })

  it('returns error on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Validation failed' }, false, 400))
    const result = await MetricGroupService.createMetricGroup(newGroup)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Validation failed')
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const result = await MetricGroupService.createMetricGroup(newGroup)
    expect(result.success).toBe(false)
    expect(result.error).toBe('timeout')
  })

  it('sends POST to /api/metric-groups', async () => {
    const fetchMock = mockFetch({ data: mockGroup })
    vi.stubGlobal('fetch', fetchMock)
    await MetricGroupService.createMetricGroup(newGroup)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/metric-groups')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})

describe('MetricGroupService.updateMetricGroup', () => {
  it('returns success with updated data', async () => {
    const updated = { ...mockGroup, name: 'Updated' }
    vi.stubGlobal('fetch', mockFetch({ data: updated }))
    const result = await MetricGroupService.updateMetricGroup('group-1', { name: 'Updated' })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('Updated')
  })

  it('returns error on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Not found' }, false, 404))
    const result = await MetricGroupService.updateMetricGroup('group-1', { name: 'x' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not found')
  })

  it('sends PATCH to correct URL', async () => {
    const fetchMock = mockFetch({ data: mockGroup })
    vi.stubGlobal('fetch', fetchMock)
    await MetricGroupService.updateMetricGroup('group-1', { name: 'x' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/metric-groups/group-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await MetricGroupService.updateMetricGroup('group-1', {})
    expect(result.success).toBe(false)
  })
})

describe('MetricGroupService.deleteMetricGroup', () => {
  it('returns success on ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const result = await MetricGroupService.deleteMetricGroup('group-1', 'p', 'a', 'u@e.com')
    expect(result.success).toBe(true)
  })

  it('returns error on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Forbidden' }, false, 403))
    const result = await MetricGroupService.deleteMetricGroup('group-1', 'p', 'a', 'u@e.com')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Forbidden')
  })

  it('sends DELETE to correct URL', async () => {
    const fetchMock = mockFetch({})
    vi.stubGlobal('fetch', fetchMock)
    await MetricGroupService.deleteMetricGroup('group-1', 'p', 'a', 'u@e.com')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/metric-groups/group-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const result = await MetricGroupService.deleteMetricGroup('group-1', 'p', 'a', 'u@e.com')
    expect(result.success).toBe(false)
  })
})

describe('MetricGroupService.reorderGroups', () => {
  const groups = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }]

  it('returns success on ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const result = await MetricGroupService.reorderGroups(groups, 'p', 'a', 'u@e.com')
    expect(result.success).toBe(true)
  })

  it('returns error on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Server error' }, false, 500))
    const result = await MetricGroupService.reorderGroups(groups, 'p', 'a', 'u@e.com')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Server error')
  })

  it('sends POST with correct body', async () => {
    const fetchMock = mockFetch({})
    vi.stubGlobal('fetch', fetchMock)
    await MetricGroupService.reorderGroups(groups, 'proj-1', 'agent-1', 'u@e.com')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.projectId).toBe('proj-1')
    expect(body.agentId).toBe('agent-1')
    expect(body.groups).toEqual(groups)
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const result = await MetricGroupService.reorderGroups(groups, 'p', 'a', 'u@e.com')
    expect(result.success).toBe(false)
  })
})
