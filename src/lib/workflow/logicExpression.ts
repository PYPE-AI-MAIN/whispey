import type { Workflow, VarType } from './schema'

export interface KnownVariable {
  name: string
  type: VarType
}

/** Every variable name that could plausibly exist by the time a logic edge evaluates —
 * declared globals plus anything nodes extract or save into state at runtime. */
export function getKnownVariables(workflow: Workflow): KnownVariable[] {
  const seen = new Map<string, KnownVariable>()
  const add = (name: string | null | undefined, type: VarType = 'string') => {
    if (!name || seen.has(name)) return
    seen.set(name, { name, type })
  }
  for (const v of workflow.variables) add(v.key, v.type)
  for (const n of workflow.nodes) {
    if (n.type === 'extract_variable') {
      for (const f of n.extractions ?? []) add(f.variable, f.type)
    } else if ('saveAs' in n && n.saveAs) {
      add(n.saveAs)
    }
  }
  return Array.from(seen.values())
}

export const LOGIC_OPERATORS = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'does not equal' },
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
] as const

export interface ParsedCondition {
  variable: string
  operator: string
  value: string
}

// The value must be ONE token — quoted string, number, true/false, or a bare
// identifier — anchored to end-of-string, so "x > 1 && y == true" cannot match
// (there's no valid single-token value that also consumes the trailing "&& ...").
// Built from named pieces to keep each sub-pattern simple and readable.
const IDENT = String.raw`[a-zA-Z_]\w*`
const OPERATOR = String.raw`==|!=|>=|<=|>|<`
const QUOTED = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"`
const NUMBER = String.raw`-?\d+(?:\.\d+)?`
const VALUE = `${QUOTED}|${NUMBER}|true|false|${IDENT}`
const SIMPLE_RE = new RegExp(String.raw`^\s*(${IDENT})\s*(${OPERATOR})\s*(${VALUE})\s*$`)
const SINGLE_QUOTED = /^'(.*)'$/
const DOUBLE_QUOTED = /^"(.*)"$/

/** Best-effort parse of a single "variable OP value" expression for the builder UI.
 * Returns null for anything more complex (&&, ||, nested calls, ...) — those stay in Custom mode. */
export function parseSimpleExpression(expr: string): ParsedCondition | null {
  const m = SIMPLE_RE.exec(expr)
  if (!m) return null
  const [, variable, operator, rawValue] = m
  const quoted = SINGLE_QUOTED.exec(rawValue) ?? DOUBLE_QUOTED.exec(rawValue)
  const value = quoted ? quoted[1] : rawValue
  return { variable, operator, value }
}

export function buildSimpleExpression(c: ParsedCondition, valueType: VarType): string {
  // Escape backslashes FIRST, then single quotes, so a value like  a'b\c  can't
  // break out of the surrounding quotes when embedded in the logic expression.
  const escaped = c.value.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`)
  const val = valueType === 'string' ? `'${escaped}'` : c.value
  return `${c.variable} ${c.operator} ${val}`
}
