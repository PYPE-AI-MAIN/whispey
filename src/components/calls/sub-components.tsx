// components/CallLogs/sub-components.tsx

import React, { memo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import ReanalyzeCallLogs from "../reprocess/ReprocessCallLogs"

// ============================================
// SKELETON COMPONENTS
// ============================================

export const FilterHeaderSkeleton = memo(() => (
  <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="flex items-center justify-between">
      <div className="h-8 bg-muted animate-pulse rounded w-48"></div>
      <div className="flex items-center gap-2">
        <div className="h-8 bg-muted animate-pulse rounded w-24"></div>
        <div className="h-8 bg-muted animate-pulse rounded w-24"></div>
        <div className="h-8 bg-muted animate-pulse rounded w-8"></div>
      </div>
    </div>
  </div>
))
FilterHeaderSkeleton.displayName = "FilterHeaderSkeleton"

export const TableSkeleton = memo(() => (
  <div className="flex-1 overflow-y-auto min-h-0">
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="h-full overflow-y-auto" style={{ minWidth: "1020px" }}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
            <tr className="bg-muted/80 hover:bg-muted/80">
              <th className="p-3 font-semibold text-foreground min-w-[120px]">Customer Number</th>
              <th className="p-3 font-semibold text-foreground min-w-[120px]">Call ID</th>
              <th className="p-3 font-semibold text-foreground min-w-[120px]">Call Status</th>
              <th className="p-3 font-semibold text-foreground min-w-[120px]">Duration</th>
              <th className="p-3 font-semibold text-foreground min-w-[120px]">Start Time</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, index) => (
              <tr key={index} className="border-b border-border/50">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted animate-pulse rounded-full"></div>
                    <div className="h-5 w-24 bg-muted animate-pulse rounded"></div>
                  </div>
                </td>
                <td className="p-3"><div className="h-6 w-16 bg-muted animate-pulse rounded-md"></div></td>
                <td className="p-3"><div className="h-6 w-20 bg-muted animate-pulse rounded-full"></div></td>
                <td className="p-3"><div className="h-5 w-12 bg-muted animate-pulse rounded"></div></td>
                <td className="p-3"><div className="h-5 w-32 bg-muted animate-pulse rounded"></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
))
TableSkeleton.displayName = "TableSkeleton"

// ============================================
// TEXT COMPONENTS
// ============================================

interface TruncatedTextProps {
  text: string
  maxLength?: number
  className?: string
}

export const TruncatedText = memo<TruncatedTextProps>(({ 
  text, 
  maxLength = 30, 
  className = "" 
}) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("break-words", className)}>
          {truncated}
        </span>
      </TooltipTrigger>
      {text.length > maxLength && (
        <TooltipContent sideOffset={6} className="pointer-events-auto max-w-[420px] max-h-64 overflow-auto break-words">
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}, (prevProps, nextProps) => {
  return prevProps.text === nextProps.text && 
         prevProps.maxLength === nextProps.maxLength &&
         prevProps.className === nextProps.className
})
TruncatedText.displayName = "TruncatedText"

// ============================================
// DYNAMIC JSON CELL
// ============================================

interface DynamicJsonCellProps {
  data: any
  fieldKey: string
  maxWidth?: string
}

export const DynamicJsonCell = memo<DynamicJsonCellProps>(({ 
  data, 
  fieldKey, 
  maxWidth = "180px" 
}) => {
  if (!data || typeof data !== 'object') {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const value = data[fieldKey]
  
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  if (typeof value === 'object') {
    const jsonString = JSON.stringify(value, null, 2)
    const truncatedJson = jsonString.length > 80 ? jsonString.substring(0, 80) + '...' : jsonString
    
    return (
      <div className="w-full max-w-full overflow-hidden border rounded-md bg-muted/20" style={{ maxWidth }}>
        <div className="p-1.5 w-full overflow-hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden w-full">
                {truncatedJson}
              </pre>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className="pointer-events-auto max-w-[520px] max-h-64 overflow-auto whitespace-pre-wrap break-words">
              {jsonString}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  const stringValue = String(value)
  const shouldTruncate = stringValue.length > 25
  const displayValue = shouldTruncate ? stringValue.substring(0, 25) + '...' : stringValue

  return (
    <div className="text-xs w-full overflow-hidden" style={{ maxWidth }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-foreground font-medium block w-full overflow-hidden" style={{ 
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {displayValue}
          </span>
        </TooltipTrigger>
        {shouldTruncate && (
          <TooltipContent sideOffset={6} className="pointer-events-auto max-w-[420px] max-h-64 overflow-auto break-words">
            {stringValue}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  )
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data && 
         prevProps.fieldKey === nextProps.fieldKey &&
         prevProps.maxWidth === nextProps.maxWidth
})
DynamicJsonCell.displayName = "DynamicJsonCell"

// ============================================
// REANALYZE DIALOG
// ============================================

interface ReanalyzeDialogWrapperProps {
  projectId?: string
  agentId?: string
}

export const ReanalyzeDialogWrapper = memo<ReanalyzeDialogWrapperProps>(({ 
  projectId, 
  agentId 
}) => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
          <Sparkles className="w-4 h-4 mr-2" />
          Re-analyze Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Re-analyze Call Logs</DialogTitle>
        </DialogHeader>
        <ReanalyzeCallLogs projectId={projectId} agentId={agentId} isDialogOpen={isOpen} />
      </DialogContent>
    </Dialog>
  )
}, (prevProps, nextProps) => {
  return prevProps.projectId === nextProps.projectId && 
         prevProps.agentId === nextProps.agentId
})
ReanalyzeDialogWrapper.displayName = "ReanalyzeDialogWrapper"