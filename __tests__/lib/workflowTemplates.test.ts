import { describe, it, expect } from 'vitest'
import { WORKFLOW_TEMPLATES } from '@/lib/workflow/templates'
import { lintWorkflow, hasErrors } from '@/lib/workflow/linter'

describe('WORKFLOW_TEMPLATES', () => {
  it('has unique ids', () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const template of WORKFLOW_TEMPLATES) {
    describe(template.id, () => {
      it('builds a workflow that passes schema parsing and lint', () => {
        const wf = template.build('Test Agent')
        expect(wf.metadata?.name).toBe('Test Agent')
        expect(wf.nodes.length).toBeGreaterThan(0)
        expect(hasErrors(lintWorkflow(wf))).toBe(false)
      })

      it('has a start node that exists among its nodes', () => {
        const wf = template.build('Test Agent')
        expect(wf.nodes.some((n) => n.id === wf.start)).toBe(true)
      })

      it('only has edges referencing real node ids', () => {
        const wf = template.build('Test Agent')
        const nodeIds = new Set(wf.nodes.map((n) => n.id))
        for (const edge of wf.edges) {
          expect(nodeIds.has(edge.source)).toBe(true)
          expect(nodeIds.has(edge.target)).toBe(true)
        }
      })
    })
  }
})
