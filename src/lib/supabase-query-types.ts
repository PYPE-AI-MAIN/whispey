export type FilterOperator =
  | 'eq'
  | 'neq'
  /** SQL inequality; safe if operator text is ever concatenated into raw SQL (neq is not valid SQL). */
  | '<>'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'not.is'

export interface Filter {
  column: string
  operator: FilterOperator
  value: unknown
}

export interface QueryOptions {
  select?: string | null
  filters?: Filter[]
  orderBy?: { column: string; ascending: boolean }
  limit?: number
  auth?: { agentId?: string; projectId?: string }
}

export interface InfiniteQueryOptions extends QueryOptions {
  pageSize: number
  cursorColumn: string
  enabled?: boolean
}
