'use client'

import React from 'react'
import { CATEGORIES, getNodesByCategory } from './nodeRegistry'
import type { NodeType } from '@/lib/workflow/schema'

/** Drag payload read by WorkflowCanvas's onDrop. */
export const PALETTE_DND_TYPE = 'application/whispey-node-type'

export function WorkflowPalette() {
  return (
    <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="p-3 space-y-4">
        {CATEGORIES.map((category) => {
          const items = getNodesByCategory(category)
          if (!items.length) return null
          return (
            <div key={category}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5 px-1">
                {category}
              </div>
              <div className="space-y-1">
                {items.map(([type, meta]) => (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PALETTE_DND_TYPE, type as NodeType)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${meta.color}20` }}
                    >
                      <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {meta.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
