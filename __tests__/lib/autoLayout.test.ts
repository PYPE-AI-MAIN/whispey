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
    // Top-to-bottom rank order: each node further down the chain sits lower.
    expect(positions.a.y).toBeLessThan(positions.b.y)
    expect(positions.b.y).toBeLessThan(positions.c.y)
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

  it('separates fan-out branches horizontally', () => {
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
    expect(positions.left.y).toBe(positions.right.y)
    expect(positions.left.x).not.toBe(positions.right.x)
  })
})
