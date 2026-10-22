import { describe, it, expect } from 'vitest'
import { computeAutoLayout } from '@/lib/workflow/autoLayout'

function wf(nodes: { id: string }[], edges: { source: string; target: string }[]) {
  return { nodes, edges } as Parameters<typeof computeAutoLayout>[0]
}

describe('computeAutoLayout', () => {
  it('positions every node in a simple linear chain', () => {
    const positions = computeAutoLayout(
      wf(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
        ]
      )
    )
    expect(Object.keys(positions).sort()).toEqual(['a', 'b', 'c'])
    // Left-to-right rank order: each node further along the chain sits further right.
    expect(positions.a.x).toBeLessThan(positions.b.x)
    expect(positions.b.x).toBeLessThan(positions.c.x)
  })

  it('skips edges referencing a node id that is not in the graph', () => {
    const positions = computeAutoLayout(
      wf([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'ghost' }])
    )
    // Doesn't throw, and both real nodes still get a position — the dangling
    // edge is simply never added to the dagre graph.
    expect(positions.a).toBeDefined()
    expect(positions.b).toBeDefined()
  })

  it('returns positions with no isolated nodes and no edges at all', () => {
    const positions = computeAutoLayout(wf([{ id: 'solo' }], []))
    expect(positions.solo).toBeDefined()
    expect(Number.isFinite(positions.solo.x)).toBe(true)
    expect(Number.isFinite(positions.solo.y)).toBe(true)
  })

  it('separates fan-out branches into lanes', () => {
    const positions = computeAutoLayout(
      wf(
        [{ id: 'root' }, { id: 'left' }, { id: 'right' }],
        [
          { source: 'root', target: 'left' },
          { source: 'root', target: 'right' },
        ]
      )
    )
    // Same rank (both direct children of root) but distinct lanes.
    expect(positions.left.x).toBe(positions.right.x)
    expect(positions.left.y).not.toBe(positions.right.y)
  })

  it('keeps the steps of a stage together so stage areas do not overlap', () => {
    const nodes = [
      { id: 'a1', stage: 'A' }, { id: 'a2', stage: 'A' }, { id: 'b1', stage: 'B' }, { id: 'b2', stage: 'B' }, { id: 'end', stage: null },
    ]
    const edges = [
      { source: 'a1', target: 'b1' }, { source: 'a1', target: 'a2' }, { source: 'b1', target: 'b2' },
      { source: 'a2', target: 'b2' }, { source: 'b2', target: 'end' }, { source: 'a2', target: 'end' },
    ]
    const p = computeAutoLayout({ nodes, edges } as Parameters<typeof computeAutoLayout>[0])
    const box = (ids: string[]) => ({
      x0: Math.min(...ids.map((i) => p[i].x)), x1: Math.max(...ids.map((i) => p[i].x)) + 220,
      y0: Math.min(...ids.map((i) => p[i].y)), y1: Math.max(...ids.map((i) => p[i].y)) + 76,
    })
    const [a, b] = [box(['a1', 'a2']), box(['b1', 'b2'])]
    const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0
    expect(apart).toBe(true)
  })
})
