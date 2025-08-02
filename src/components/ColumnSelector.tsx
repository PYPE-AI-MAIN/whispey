"use client"

import type React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Columns3, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface ColumnSelectorProps {
  basicColumns: string[]
  basicColumnLabels: Record<string, string>
  metadataColumns: string[]
  transcriptionColumns: string[]
  visibleColumns: {
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }
  onColumnChange: (type: "basic" | "metadata" | "transcription_metrics", column: string, visible: boolean) => void
  onSelectAll: (type: "basic" | "metadata" | "transcription_metrics", visible: boolean) => void
}

const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  basicColumns,
  basicColumnLabels,
  metadataColumns,
  transcriptionColumns,
  visibleColumns,
  onColumnChange,
  onSelectAll,
}) => {
  const totalVisible =
    visibleColumns.basic.length + visibleColumns.metadata.length + visibleColumns.transcription_metrics.length
  const totalColumns = basicColumns.length + metadataColumns.length + transcriptionColumns.length

  const ColumnSection = ({
    title,
    columns,
    type,
    visibleCount,
    getLabel,
  }: {
    title: string
    columns: string[]
    type: "basic" | "metadata" | "transcription_metrics"
    visibleCount: number
    getLabel?: (column: string) => string
  }) => {
    if (columns.length === 0) return null

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {visibleCount}/{columns.length}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              onClick={() => onSelectAll(type, true)}
              disabled={visibleCount === columns.length}
            >
              <Eye className="h-3 w-3 mr-1" />
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              onClick={() => onSelectAll(type, false)}
              disabled={visibleCount === 0}
            >
              <EyeOff className="h-3 w-3 mr-1" />
              None
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          {columns.map((column) => {
            const isVisible = visibleColumns[type].includes(column)
            return (
              <div
                key={column}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                  isVisible ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-muted/50"
                )}
              >
                <Checkbox
                  id={`${type}-${column}`}
                  checked={isVisible}
                  onCheckedChange={(checked) => onColumnChange(type, column, checked as boolean)}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label
                  htmlFor={`${type}-${column}`}
                  className="text-sm text-foreground cursor-pointer flex-1"
                >
                  {getLabel ? getLabel(column) : column}
                </label>
                {isVisible && <div className="w-2 h-2 bg-blue-500 rounded-full opacity-60" />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
        >
          <Columns3 className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium">Columns</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
            {totalVisible}/{totalColumns}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-h-[60vh] p-0 shadow-xl border border-gray-200 bg-white flex flex-col overflow-hidden"
        side="left"
        align="start"
        alignOffset={-200}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base text-gray-900">Table Columns</h4>
            <div className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
              {totalVisible} of {totalColumns} visible
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Choose which columns to display in your table</p>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6 space-y-6">
            <ColumnSection
              title="Basic Columns"
              columns={basicColumns}
              type="basic"
              visibleCount={visibleColumns.basic.length}
              getLabel={(column) => basicColumnLabels[column] || column}
            />

            {basicColumns.length > 0 && (metadataColumns.length > 0 || transcriptionColumns.length > 0) && (
              <div className="relative">
                <Separator className="bg-gray-200" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white px-3 text-xs text-gray-500 font-medium">DYNAMIC COLUMNS</div>
                </div>
              </div>
            )}

            <ColumnSection
              title="Metadata"
              columns={metadataColumns}
              type="metadata"
              visibleCount={visibleColumns.metadata.length}
            />

            {metadataColumns.length > 0 && transcriptionColumns.length > 0 && (
              <Separator className="bg-gray-200" />
            )}

            <ColumnSection
              title="Transcription Metrics"
              columns={transcriptionColumns}
              type="transcription_metrics"
              visibleCount={visibleColumns.transcription_metrics.length}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/30 shrink-0">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{totalColumns > 8 ? "Scroll to see more options" : `${totalColumns} columns available`}</span>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-gray-400 rounded-full" />
              <div className="w-1 h-1 bg-gray-300 rounded-full" />
              <div className="w-1 h-1 bg-gray-300 rounded-full" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ColumnSelector
