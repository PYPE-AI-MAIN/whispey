export type FilterOperator =
  | 'eq'
  | 'neq'
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
