"use client"

// A metric template (the scoring rubric an LLM judge grades calls against) is
// shared platform-wide, not per-agent — hence POST /api/admin/metrics-templates
// and its superadmin gate. This form is the one place that creates one; both
// the admin Settings > Users > Metrics tab and the per-agent Metrics dialog
// render it rather than keeping their own copy of these fields/validation.
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface CreatedMetricTemplate {
  metric_id: string
  name: string
  description: string
  default_criteria: string
  default_scoring_mode: 'continuous' | 'binary'
  default_threshold: number
  category: string
  priority: string
}

interface CreateMetricTemplateFormProps {
  onCreated: (template: CreatedMetricTemplate) => void
}

const EMPTY_FORM = {
  metric_id: '',
  name: '',
  description: '',
  default_criteria: '',
  default_scoring_mode: 'continuous' as 'continuous' | 'binary',
  default_threshold: 0.7,
  category: '',
  priority: 'medium',
}

const deriveMetricId = (name: string) =>
  name.toLowerCase().replaceAll(/\s+/g, '_').replaceAll(/[^a-z0-9_]/g, '').slice(0, 30)

export function CreateMetricTemplateForm({ onCreated }: Readonly<CreateMetricTemplateFormProps>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (name: string) => {
    const trimmed = name.slice(0, 30)
    setForm(f => ({ ...f, name: trimmed, metric_id: deriveMetricId(trimmed) }))
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.name || !form.default_criteria) {
      setError('Name and default criteria are required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/metrics-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        onCreated(data)
        setForm(EMPTY_FORM)
        setOpen(false)
      } else {
        setError(data.error ?? 'Failed to create template.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Create New Metric
        </span>
        <span className="text-gray-600 dark:text-gray-400 text-xs">{open ? 'Cancel' : 'Expand'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-200 dark:border-gray-800 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Name *</Label>
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{form.name.length}/30</span>
            </div>
            <Input
              className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="e.g. Call Quality"
              maxLength={30}
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Description</Label>
            <Input
              className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Short description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Default Criteria *</Label>
            <Textarea
              className="mt-1 text-xs min-h-[80px] font-mono resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Evaluation criteria prompt..."
              value={form.default_criteria}
              onChange={e => setForm(f => ({ ...f, default_criteria: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Scoring Mode *</Label>
              <Select value={form.default_scoring_mode} onValueChange={(v: 'continuous' | 'binary') => setForm(f => ({ ...f, default_scoring_mode: v }))}>
                <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuous">Continuous (0–1)</SelectItem>
                  <SelectItem value="binary">Binary (0 or 1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Default Threshold</Label>
              <Input
                type="number" step="0.01" min="0" max="1"
                className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                value={form.default_threshold}
                onChange={e => setForm(f => ({ ...f, default_threshold: Number.parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="effectiveness">Effectiveness</SelectItem>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                  <SelectItem value="reliability">Reliability</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={handleSubmit} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Creating...' : 'Create Template'}
          </Button>
        </div>
      )}
    </div>
  )
}
