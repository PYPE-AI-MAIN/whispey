import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, Calculator, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Action Menu Items */}
          {isOpen && (
            <div className="absolute bottom-16 right-0 flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-200 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              {/* Chart Builder Option */}
              <div className="flex items-center gap-3">
                <span className="bg-gray-900 text-white text-sm px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                  Chart Builder
                </span>
                <ChartBuilderButton 
                  metadataFields={metadataFields}
                  transcriptionFields={transcriptionFields}
                  onClose={() => setIsOpen(false)}
                />
              </div>
              
              {/* Custom Totals Option */}
              <div className="flex items-center gap-3">
                <span className="bg-gray-900 text-white text-sm px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                  Custom Totals
                </span>
                <Dialog open={showCustomTotals} onOpenChange={setShowCustomTotals}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-12 w-12 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700 border-0"
                    >
                      <Calculator className="w-5 h-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Custom Total</DialogTitle>
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
              </div>
            </div>
          )}
          
          {/* Main FAB */}
          <Button
            onClick={() => setIsOpen(!isOpen)}
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
        </div>
      </div>

      {/* Backdrop - invisible click area */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
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
            <p className="text-xs text-gray-500 mt-1">
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