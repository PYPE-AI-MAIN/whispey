import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, Calculator, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChartContext } from './EnhancedChartBuilder'
import CustomTotalsBuilder from './CustomTotalBuilds'

interface FloatingActionMenuProps {
  // Chart Builder props
  metadataFields: string[]
  transcriptionFields: string[]
  
  // Custom Totals props
  agentId: string
  projectId: string
  userEmail: string
  availableColumns: any[]
  onSaveCustomTotal: (config: any) => Promise<void>
}

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  metadataFields,
  transcriptionFields,
  agentId,
  projectId,
  userEmail,
  availableColumns,
  onSaveCustomTotal
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [showCustomTotals, setShowCustomTotals] = useState(false)

  return (
    <>
      {/* Custom Summary Dialog */}
      <Dialog open={showCustomTotals} onOpenChange={setShowCustomTotals}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Summary</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Aggregate your calls using filters and an aggregation (Count, Sum, Avg, etc.). Saved summaries appear as cards on the dashboard.
            </p>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(80vh-100px)]">
            <CustomTotalsBuilder
              agentId={agentId}
              projectId={projectId}
              userEmail={userEmail}
              availableColumns={availableColumns}
              dynamicMetadataFields={metadataFields}
              dynamicTranscriptionFields={transcriptionFields}
              onSave={onSaveCustomTotal}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Action Menu with Popover */}
      <div className="fixed bottom-6 right-6 z-50">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              className={`h-14 w-14 rounded-full shadow-lg transition-all duration-200 ${
                isOpen 
                  ? 'bg-red-600 hover:bg-red-700 rotate-45' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent 
            side="top" 
            align="end" 
            className="w-auto p-3 bg-card border shadow-xl"
            sideOffset={12}
          >
            <div className="flex flex-col gap-3">
              {/* Chart Builder Option */}
              <div className="flex items-center gap-3">
                <div className="bg-card text-card-foreground border rounded-lg px-3 py-1 shadow-sm">
                  <span className="text-sm font-medium whitespace-nowrap">Chart Builder</span>
                </div>
                <ChartBuilderButton 
                  metadataFields={metadataFields}
                  transcriptionFields={transcriptionFields}
                  onClose={() => setIsOpen(false)}
                />
              </div>
              
              {/* Custom Summary Option */}
              <div className="flex items-center gap-3">
                <div className="bg-card text-card-foreground border rounded-lg px-3 py-1 shadow-sm">
                  <span className="text-sm font-medium whitespace-nowrap">Custom Summary</span>
                </div>
                <Button
                  size="sm"
                  className="h-12 w-12 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700 border-0"
                  onClick={() => {
                    setShowCustomTotals(true)
                    setIsOpen(false)
                  }}
                >
                  <Calculator className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}

// Chart Builder Button Component
interface ChartBuilderButtonProps {
  metadataFields: string[]
  transcriptionFields: string[]
  onClose: () => void
}

const ChartBuilderButton: React.FC<ChartBuilderButtonProps> = ({ 
  metadataFields, 
  transcriptionFields, 
  onClose 
}) => {
  const { newChart, setNewChart, addChart } = useChartContext()
  
  const fields = {
    metadata: metadataFields,
    transcription_metrics: transcriptionFields
  }

  // Predefined table fields for quick access
  const tableFields = [
    'call_ended_reason',
    'transcript_type',
    'environment'
  ]

  const handleAddChart = () => {
    addChart()
    onClose()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 border-0"
        >
          <TrendingUp className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Count Chart</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Build a chart that counts calls grouped by a field and time. Use a filter value to focus on a specific value, or leave it empty to compare the most frequent values.
          </p>
        </DialogHeader>
        <div className="space-y-4 max-h-[calc(90vh-100px)] overflow-y-auto">
          {/* Source Selection */}
          <div>
            <Label>Data Source</Label>
            <Select
              value={newChart.source}
              onValueChange={(value) => setNewChart(prev => ({ 
                ...prev, 
                source: value as 'table' | 'metadata' | 'transcription_metrics', 
                field: undefined 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select data source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table Fields ({tableFields.length})</SelectItem>
                <SelectItem value="metadata">Metadata ({fields.metadata.length} fields)</SelectItem>
                <SelectItem value="transcription_metrics">Transcription ({fields.transcription_metrics.length} fields)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Choose where the field lives: core table columns, metadata, or transcription metrics.
            </p>
          </div>

          {/* Field Selection */}
          {newChart.source && (
            <div>
              <Label>Field</Label>
              <Select
                value={newChart.field}
                onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {(newChart.source === 'table' ? tableFields : fields[newChart.source as keyof typeof fields]).map(field => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Pick the field whose values you want to count over time.
              </p>
            </div>
          )}

          {/* Filter Value */}
          <div>
            <Label>Filter Value (Optional)</Label>
            <Input
              placeholder="e.g., 'Yes', 'completed', 'Successful'"
              value={newChart.filterValue || ''}
              onChange={(e) => setNewChart(prev => ({ ...prev, filterValue: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to show multiple lines for all values
            </p>
          </div>

          {/* Chart Type */}
          <div>
            <Label>Chart Type</Label>
            <Select
              value={newChart.chartType}
              onValueChange={(value) => setNewChart(prev => ({ 
                ...prev, 
                chartType: value as 'line' | 'bar' 
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line Chart</SelectItem>
                <SelectItem value="bar">Bar Chart (Stacked)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Line is ideal for trends; stacked bars compare value distributions per date.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleAddChart}
              disabled={!newChart.field || !newChart.source}
            >
              Add Chart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}