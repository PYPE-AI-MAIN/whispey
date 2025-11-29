"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Activity, CheckCircle2, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface MetricConfig {
  metric_id: string
  enabled: boolean
  criteria: string
  scoring_mode: 'continuous' | 'binary'
  threshold: number
}

interface MetricTemplate {
  metric_id: string
  name: string
  description: string
  default_criteria: string
  default_scoring_mode: 'continuous' | 'binary'
  default_threshold: number
  category: string
  priority: string
  icon: string
}

interface MetricsDialogProps {
  initialMetrics?: Record<string, MetricConfig>
  onSave: (metrics: Record<string, MetricConfig>) => void
}

const MetricsDialog: React.FC<MetricsDialogProps> = ({ 
  initialMetrics = {},
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [metricsTemplates, setMetricsTemplates] = useState<MetricTemplate[]>([])
  const [metrics, setMetrics] = useState<Record<string, MetricConfig>>(initialMetrics)
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Sync metrics state when initialMetrics prop changes (e.g., after refresh)
  useEffect(() => {
    if (initialMetrics && Object.keys(initialMetrics).length > 0) {
      setMetrics(initialMetrics)
    } else {
      setMetrics({})
    }
  }, [initialMetrics])

  // Fetch metrics templates when dialog opens
  useEffect(() => {
    if (isOpen && metricsTemplates.length === 0) {
      setLoadingTemplates(true)
      fetch('/api/metrics-templates')
        .then(res => res.json())
        .then(data => {
          setMetricsTemplates(data)
          setLoadingTemplates(false)
        })
        .catch(err => {
          console.error('Error fetching metrics templates:', err)
          setLoadingTemplates(false)
        })
    }
  }, [isOpen, metricsTemplates.length])

  const addMetric = (template: MetricTemplate) => {
    setMetrics(prev => ({
      ...prev,
      [template.metric_id]: {
        metric_id: template.metric_id,
        enabled: true,
        criteria: template.default_criteria,
        scoring_mode: template.default_scoring_mode,
        threshold: template.default_threshold
      }
    }))
  }

  const removeMetric = (metricId: string) => {
    setMetrics(prev => {
      const newMetrics = { ...prev }
      delete newMetrics[metricId]
      return newMetrics
    })
  }

  const updateMetric = (metricId: string, updates: Partial<MetricConfig>) => {
    setMetrics(prev => ({
      ...prev,
      [metricId]: { ...prev[metricId], ...updates }
    }))
  }

  const handleSave = () => {
    // Save metrics with edited criteria, scoring_mode, and threshold
    // Format: { metric_id: { metric_id, enabled, criteria, scoring_mode, threshold } }
    onSave(metrics)
    setIsOpen(false)
  }

  const enabledCount = Object.values(metrics).filter(m => m.enabled).length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="group relative overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/25 bg-transparent"
        >
          <Activity className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
          <span className="relative z-10 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
            Metrics
          </span>
          {enabledCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {enabledCount}
            </Badge>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl rounded-lg shadow-xl p-0 flex flex-col h-[90vh]">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Metrics Configuration
          </DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enable and configure evaluation metrics for your agent
          </p>
        </DialogHeader>
        <Separator className="flex-shrink-0" />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {loadingTemplates ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-gray-500">Loading metrics templates...</div>
            </div>
          ) : (
            <div className="space-y-6 pr-2">
              {/* Added Metrics Section */}
              {Object.keys(metrics).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Added Metrics ({Object.keys(metrics).length})
                  </h3>
                  <div className="space-y-3">
                    {Object.values(metrics).map((metricConfig) => {
                      const template = metricsTemplates.find(t => t.metric_id === metricConfig.metric_id)
                      if (!template) return null

                      return (
                        <div key={metricConfig.metric_id} className={`border rounded-lg p-4 dark:border-gray-700 transition-all ${
                          metricConfig.enabled 
                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' 
                            : 'bg-gray-50/50 dark:bg-gray-800/50 opacity-60'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h4>
                                <Badge variant="outline" className="text-xs">{template.category}</Badge>
                                {template.priority === 'critical' && (
                                  <Badge variant="destructive" className="text-xs">Critical</Badge>
                                )}
                                {!metricConfig.enabled && (
                                  <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`enable-${metricConfig.metric_id}`} className="text-xs text-gray-600 dark:text-gray-400">
                                  {metricConfig.enabled ? 'Enabled' : 'Disabled'}
                                </Label>
                                <Switch
                                  id={`enable-${metricConfig.metric_id}`}
                                  checked={metricConfig.enabled}
                                  onCheckedChange={(checked) => 
                                    updateMetric(metricConfig.metric_id, { enabled: checked })
                                  }
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMetric(metricConfig.metric_id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {metricConfig.enabled && (
                            <div className="space-y-3 mt-3 pt-3 border-t dark:border-gray-700">
                              <div>
                                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Evaluation Criteria
                                </Label>
                                <Textarea
                                  value={metricConfig.criteria}
                                  onChange={(e) => updateMetric(metricConfig.metric_id, { criteria: e.target.value })}
                                  className="mt-1 text-xs min-h-[100px] font-mono resize-none"
                                  placeholder="Enter evaluation criteria..."
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Scoring Mode
                                  </Label>
                                  <Select
                                    value={metricConfig.scoring_mode}
                                    onValueChange={(value: 'continuous' | 'binary') => 
                                      updateMetric(metricConfig.metric_id, { scoring_mode: value })
                                    }
                                  >
                                    <SelectTrigger className="mt-1 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="continuous">Continuous (0-1)</SelectItem>
                                      <SelectItem value="binary">Binary (0 or 1)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Threshold
                                  </Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={metricConfig.threshold}
                                    onChange={(e) => 
                                      updateMetric(metricConfig.metric_id, { threshold: parseFloat(e.target.value) || 0 })
                                    }
                                    className="mt-1 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Available Templates Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Available Metrics Templates
                </h3>
                <div className="space-y-2">
                  {metricsTemplates
                    .filter(template => !metrics[template.metric_id])
                    .map((template) => (
                      <div key={template.metric_id} className="border rounded-lg p-3 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{template.name}</h4>
                              <Badge variant="outline" className="text-xs">{template.category}</Badge>
                              {template.priority === 'critical' && (
                                <Badge variant="destructive" className="text-xs">Critical</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{template.description}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addMetric(template)}
                            className="ml-3"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>

                {metricsTemplates.filter(t => !metrics[t.metric_id]).length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">All available metrics have been added</p>
                  </div>
                )}
              </div>

              {metricsTemplates.length === 0 && !loadingTemplates && (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No metrics templates available</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed section for action buttons */}
        <div className="flex-shrink-0 p-6 pt-4 border-t dark:border-gray-700">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gray-900 text-white shadow-sm hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Save Metrics
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MetricsDialog

