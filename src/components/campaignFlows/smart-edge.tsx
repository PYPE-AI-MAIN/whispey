'use client'

import * as React from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useNodes, type EdgeProps } from '@xyflow/react'
import { Plus, Trash2 } from 'lucide-react'

const NODE_FALLBACK_WIDTH = 240
const NODE_FALLBACK_HEIGHT = 70
const DETOUR_MARGIN = 24
const CORNER_RADIUS = 10

type Obstacle = { x: number; y: number; w: number; h: number }

/** Does the straight line from (x1,y1) to (x2,y2) pass through this rectangle? */
function lineHitsRect(x1: number, y1: number, x2: number, y2: number, r: Obstacle): boolean {
  const steps = 24
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true
  }
  return false
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Point `d` units from `from`, along the line toward `to`. */
function pointToward(from: { x: number; y: number }, to: { x: number; y: number }, d: number) {
  const len = dist(from, to) || 1
  const clamped = Math.min(d, len / 2)
  return { x: from.x + ((to.x - from.x) * clamped) / len, y: from.y + ((to.y - from.y) * clamped) / len }
}

/** An SVG path through straight segments, with each corner rounded off. */
function roundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const a = pointToward(corner, prev, radius)
    const b = pointToward(corner, next, radius)
    d += ` L ${a.x} ${a.y} Q ${corner.x} ${corner.y} ${b.x} ${b.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

/**
 * Boxy right-angle detour around a single obstacle: out to whichever side of
 * the box needs the smaller sideways jog, straight past it, then back in to
 * the target. Handles the normal top-to-bottom (or bottom-to-top) flow this
 * builder's edges actually run in — not general-purpose pathfinding.
 */
function detourPath(sourceX: number, sourceY: number, targetX: number, targetY: number, obstacle: Obstacle) {
  const goingDown = targetY >= sourceY
  const clearNear = goingDown ? obstacle.y - DETOUR_MARGIN : obstacle.y + obstacle.h + DETOUR_MARGIN
  const clearFar = goingDown ? obstacle.y + obstacle.h + DETOUR_MARGIN : obstacle.y - DETOUR_MARGIN

  // Where would the straight line be when it's level with the obstacle's
  // center? Whichever side of the box is closer to that x is the cheaper
  // detour.
  const obstacleMidY = obstacle.y + obstacle.h / 2
  const t = (obstacleMidY - sourceY) / ((targetY - sourceY) || 1)
  const lineXAtObstacle = sourceX + (targetX - sourceX) * t
  const leftX = obstacle.x - DETOUR_MARGIN
  const rightX = obstacle.x + obstacle.w + DETOUR_MARGIN
  const detourX = Math.abs(rightX - lineXAtObstacle) < Math.abs(leftX - lineXAtObstacle) ? rightX : leftX

  const points = [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: clearNear },
    { x: detourX, y: clearNear },
    { x: detourX, y: clearFar },
    { x: targetX, y: clearFar },
    { x: targetX, y: targetY },
  ]
  return { path: roundedPath(points, CORNER_RADIUS), labelX: detourX, labelY: (clearNear + clearFar) / 2 }
}

type EdgeHandlers = {
  onInsert?: (edgeId: string) => void
  onDelete?: (edgeId: string) => void
}

/**
 * Mostly a bendy bezier curve — the shape that reads best for a simple
 * sequence. Only detours around an obstacle — a boxy, right-angled path that
 * actually goes around the blocking node's edges, not just a curve that
 * still happens to cross behind it — when the direct path would otherwise
 * cut through an unrelated node. Hovering the line reveals a small toolbar
 * (insert a step here / delete this connection), the same interaction n8n's
 * own canvas uses.
 */
export function SmartEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const nodes = useNodes()
  const [hovered, setHovered] = React.useState(false)
  const { onInsert, onDelete } = (data as EdgeHandlers) ?? {}

  const obstacle = nodes.find((n) => {
    if (n.id === source || n.id === target) return false
    const w = n.measured?.width ?? NODE_FALLBACK_WIDTH
    const h = n.measured?.height ?? NODE_FALLBACK_HEIGHT
    return lineHitsRect(sourceX, sourceY, targetX, targetY, { x: n.position.x, y: n.position.y, w, h })
  })
  const obstacleRect = obstacle
    ? { x: obstacle.position.x, y: obstacle.position.y, w: obstacle.measured?.width ?? NODE_FALLBACK_WIDTH, h: obstacle.measured?.height ?? NODE_FALLBACK_HEIGHT }
    : undefined

  const [path, labelX, labelY] = obstacleRect
    ? (() => {
        const d = detourPath(sourceX, sourceY, targetX, targetY, obstacleRect)
        return [d.path, d.labelX, d.labelY] as const
      })()
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {/* Wider, invisible hit area — the visible line is too thin to hover reliably. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <EdgeLabelRenderer>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          {hovered ? (
            <div className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5 shadow-md dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={() => onInsert?.(id)}
                title="Add a step here"
                className="flex size-6 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              >
                <Plus className="size-3.5" />
              </button>
              <button
                onClick={() => onDelete?.(id)}
                title="Delete this connection"
                className="flex size-6 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : (
            label && (
              <div className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                {label}
              </div>
            )
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
