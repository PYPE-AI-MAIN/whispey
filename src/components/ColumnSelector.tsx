"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Columns3, Eye, EyeOff } from "lucide-react"

interface ColumnSelectorProps {
  metadataColumns: string[]
  transcriptionColumns: string[]
  visibleColumns: {
    metadata: string[]
    transcription_metrics: string[]
  }
  onColumnChange: (type: 'metadata' | 'transcription_metrics', column: string, visible: boolean) => void
  onSelectAll: (type: 'metadata' | 'transcription_metrics', visible: boolean) => void
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  metadataColumns,
  transcriptionColumns,
  visibleColumns,
  onColumnChange,
  onSelectAll,
}) => {
  const totalVisible = visibleColumns.metadata.length + visibleColumns.transcription_metrics.length
  const totalColumns = metadataColumns.length + transcriptionColumns.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Columns3 className="h-3 w-3" />
          Columns ({totalVisible}/{totalColumns})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4">
          <h4 className="font-medium text-sm mb-3">Show/Hide Columns</h4>
          
          {/* Metadata Section */}
          {metadataColumns.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Metadata</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSelectAll('metadata', true)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSelectAll('metadata', false)}
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    None
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {metadataColumns.map((column) => (
                  <div key={column} className="flex items-center space-x-2">
                    <Checkbox
                      id={`metadata-${column}`}
                      checked={visibleColumns.metadata.includes(column)}
                      onCheckedChange={(checked) =>
                        onColumnChange('metadata', column, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`metadata-${column}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {column}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Separator */}
          {metadataColumns.length > 0 && transcriptionColumns.length > 0 && (
            <Separator className="my-4" />
          )}

          {/* Transcription Metrics Section */}
          {transcriptionColumns.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Transcription Metrics</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSelectAll('transcription_metrics', true)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onSelectAll('transcription_metrics', false)}
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    None
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {transcriptionColumns.map((column) => (
                  <div key={column} className="flex items-center space-x-2">
                    <Checkbox
                      id={`transcription-${column}`}
                      checked={visibleColumns.transcription_metrics.includes(column)}
                      onCheckedChange={(checked) =>
                        onColumnChange('transcription_metrics', column, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`transcription-${column}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {column}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ColumnSelector