'use client'

import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CATEGORIES, getNodesByCategory } from './nodeRegistry'

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
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(PALETTE_DND_TYPE, type)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-left"
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
                      </button>
                    </TooltipTrigger>
                    {/* side=right so it clears the palette instead of covering the next item */}
                    <TooltipContent side="right" sideOffset={8} className="max-w-[260px]">
                      <p className="font-semibold">{meta.label}</p>
                      <p className="mt-0.5 opacity-90">{meta.useCase}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
