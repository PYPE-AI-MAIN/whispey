import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { useChartContext } from './EnhancedChartBuilder'

interface ChartBuilderDialogProps {
  metadataFields: string[]
  transcriptionFields: string[]
}

export const ChartBuilderDialog: React.FC<ChartBuilderDialogProps> = ({ 
  metadataFields, 
  transcriptionFields 
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
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Chart
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Add Count Chart</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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