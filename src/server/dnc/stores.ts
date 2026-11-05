import { projectIdForAgent, type DncStore, type PlaneSource } from '@/server/data-plane'

/**
 * Global DNC entries always stay in Pype. Project and agent entries live in the
 * project's data plane. `all` is every store that can hold an entry that applies
 * to the project (just Pype's when the project is not customer-held).
 */
export async function dncStoresFor(dp: PlaneSource, projectId: string | null | undefined) {
  const pype = dp.pype().dnc
  if (!projectId || !(await dp.isCustomerHeld(projectId))) return { pype, scoped: pype, all: [pype], customerHeld: false }
  const scoped = (await dp.forProject(projectId)).dnc
  return { pype, scoped, all: [pype, scoped], customerHeld: true }
}

/** The project of a request that names a project and/or an agent (the agent wins: a client cannot pair a foreign project with its agent). */
export async function dncProjectId(projectId: string | null | undefined, agentId: string | null | undefined) {
  return agentId ? await projectIdForAgent(agentId) : (projectId ?? null)
}

export type { DncStore }
