'use client'
import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { MetricGroup, METRIC_IDS, METRIC_LABELS, CHART_IDS, CHART_LABELS } from '@/types/metricGroups'
import { Trash2, GripVertical, Plus } from 'lucide-react'
import { CustomTotalConfig } from '@/types/customTotals'

interface MetricGroupManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: MetricGroup[]
  customTotals: CustomTotalConfig[]
  projectId: string
  agentId: string
  userEmail: string
  role: string | null
  onSave: (group: Omit<MetricGroup, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdate: (id: string, updates: Partial<MetricGroup>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MetricGroupManager({
  open,
  onOpenChange,
  groups,
  customTotals,
  projectId,
  agentId,
  userEmail,
  role,
  onSave,
  onUpdate,
  onDelete,
}: MetricGroupManagerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [selectedCharts, setSelectedCharts] = useState<string[]>([])
  const [editingGroup, setEditingGroup] = useState<MetricGroup | null>(null)

  // Get available metric IDs based on role
  const availableMetricIds = Object.values(METRIC_IDS).filter(id => {
    if (role === 'user') {
      return id !== METRIC_IDS.TOTAL_COST && id !== METRIC_IDS.AVG_LATENCY && id !== METRIC_IDS.TOTAL_BILLING_MINUTES
    }
    return true
  })

  // Get available chart IDs
  const availableChartIds = Object.values(CHART_IDS)

  const handleStartCreate = () => {
    setIsCreating(true)
    setEditingGroup(null)
    setNewGroupName('')
    setSelectedMetrics([])
    setSelectedCharts([])
  }

  const handleStartEdit = (group: MetricGroup) => {
    setIsCreating(true)
    setEditingGroup(group)
    setNewGroupName(group.name)
    setSelectedMetrics(group.metric_ids)
    setSelectedCharts(group.chart_ids || [])
  }

  const handleSaveGroup = async () => {
    if (!newGroupName.trim() || (selectedMetrics.length === 0 && selectedCharts.length === 0)) {
        alert('Please add at least one metric or chart to the group')
        return
    }

    if (editingGroup) {
        await onUpdate(editingGroup.id, {
        name: newGroupName,
        metric_ids: selectedMetrics,
        chart_ids: selectedCharts,
        project_id: projectId,
        agent_id: agentId,
        user_email: userEmail,
        })
    } else {
        await onSave({
        name: newGroupName,
        project_id: projectId,
        agent_id: agentId,
        user_email: userEmail,
        metric_ids: selectedMetrics,
        chart_ids: selectedCharts,
        order: groups.length,
        })
    }

    setIsCreating(false)
    setNewGroupName('')
    setSelectedMetrics([])
    setSelectedCharts([])
    setEditingGroup(null)
    }

  const handleToggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    )
  }

  const handleToggleChart = (chartId: string) => {
    setSelectedCharts(prev =>
      prev.includes(chartId)
        ? prev.filter(id => id !== chartId)
        : [...prev, chartId]
    )
  }

  const handleCancel = () => {
    setIsCreating(false)
    setNewGroupName('')
    setSelectedMetrics([])
    setSelectedCharts([])
    setEditingGroup(null)
  }

  const handleDeleteGroup = async (groupId: string) => {
    await onDelete(groupId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Groups</DialogTitle>
          <DialogDescription>
            Create custom groups to organize your metrics and charts. Click a group to edit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Groups */}
          {!isCreating && (
            <div className="space-y-3">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No groups yet. Create your first one!</p>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                    onClick={() => handleStartEdit(group)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {group.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {group.metric_ids.length} metric{group.metric_ids.length !== 1 ? 's' : ''} 
                          {group.chart_ids && group.chart_ids.length > 0 && (
                            <>, {group.chart_ids.length} chart{group.chart_ids.length !== 1 ? 's' : ''}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Are you sure you want to delete this group?')) {
                          handleDeleteGroup(group.id)
                        }
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}

              <Button
                onClick={handleStartCreate}
                variant="outline"
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Group
              </Button>
            </div>
          )}

          {/* Create/Edit Form */}
          {isCreating && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Operations, Costs, Performance"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Metrics Column */}
                <div>
                  <Label>Select Metrics</Label>
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                    {/* Key Metrics */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Key Metrics
                      </p>
                      {availableMetricIds.map((metricId) => (
                        <label
                          key={metricId}
                          className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedMetrics.includes(metricId)}
                            onCheckedChange={() => handleToggleMetric(metricId)}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {METRIC_LABELS[metricId]}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Custom Totals */}
                    {customTotals.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Custom Metrics
                        </p>
                        {customTotals.map((total) => (
                          <label
                            key={total.id}
                            className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedMetrics.includes(`custom_${total.id}`)}
                              onCheckedChange={() => handleToggleMetric(`custom_${total.id}`)}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {total.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Charts Column */}
                <div>
                  <Label>Select Charts</Label>
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Available Charts
                      </p>
                      {availableChartIds.map((chartId) => (
                        <label
                          key={chartId}
                          className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedCharts.includes(chartId)}
                            onCheckedChange={() => handleToggleChart(chartId)}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {CHART_LABELS[chartId]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveGroup}
                  disabled={!newGroupName.trim() || (selectedMetrics.length === 0 && selectedCharts.length === 0)}
                  className="flex-1"
                >
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </Button>
                <Button onClick={handleCancel} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}