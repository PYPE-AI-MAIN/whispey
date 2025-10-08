import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, Loader2, User, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Assistant {
  name: string
  isPrimary?: boolean
  hasUnsavedChanges?: boolean
  isConfigured?: boolean
}

interface AssistantSwitcherProps {
  assistants: Assistant[]
  currentAssistantIndex: number
  onAssistantSelect: (index: number) => void
  onAssistantCreate: () => void
  className?: string
}

export default function AssistantSwitcher({
  assistants,
  currentAssistantIndex,
  onAssistantSelect,
  onAssistantCreate,
  className
}: AssistantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleAssistantClick = (index: number) => {
    if (index !== currentAssistantIndex) {
      onAssistantSelect(index)
    }
  }

  return (
    <>
      {/* Trigger Tab - Minimal arrow stuck to right edge */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50",
          "bg-white dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700",
          "rounded-l-lg shadow-sm hover:shadow-md transition-all duration-200",
          "p-3 pr-2 group",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isOpen && "opacity-0 pointer-events-none",
          className
        )}
        aria-label="Toggle assistant panel"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" />
      </button>

      {/* Floating Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-1/2 -translate-y-1/2 z-50",
          "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
          "rounded-l-lg shadow-xl transition-all duration-300",
          "max-h-[60vh] overflow-hidden flex flex-col",
          isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
        )}
        style={{ width: '280px' }}
      >
        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Assistants ({assistants.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Command className="w-3 h-3" />K
            </kbd>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Assistant List */}
        <div className="flex-1 overflow-y-auto py-2">
          {assistants.map((assistant, index) => (
            <button
              key={`${assistant.name}-${index}`}
              onClick={() => handleAssistantClick(index)}
              className={cn(
                "w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors",
                "text-left group relative",
                index === currentAssistantIndex && "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              )}
            >
              {/* Active Indicator */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 bg-blue-500 transition-opacity",
                  index === currentAssistantIndex ? "opacity-100" : "opacity-0"
                )}
              />

              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                index === currentAssistantIndex 
                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400" 
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              )}>
                <User className="w-4 h-4" />
              </div>

              {/* Assistant Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium truncate",
                    index === currentAssistantIndex 
                      ? "text-gray-900 dark:text-gray-100" 
                      : "text-gray-700 dark:text-gray-300"
                  )}>
                    {assistant.name}
                  </span>
                  {assistant.isPrimary && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
                
                {/* Status Indicators */}
                <div className="flex items-center gap-2 mt-1">
                  {assistant.isConfigured ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="w-3 h-3" />
                      <span>Configured</span>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Not configured
                    </span>
                  )}
                  
                  {assistant.hasUnsavedChanges && (
                    <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />
                  )}
                </div>
              </div>

              {/* Current Indicator */}
              {index === currentAssistantIndex && (
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))}
        </div>

        {/* Add Assistant Button */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onAssistantCreate}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Plus className="w-4 h-4" />
            Add Assistant
          </Button>
        </div>
      </div>
    </>
  )
}