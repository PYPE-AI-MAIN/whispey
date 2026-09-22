'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WhatsAppTemplateConfig } from '@/lib/campaignFlows/types'

let counter = 1
function nextParamId() {
  return `param-${counter++}`
}

export function WhatsAppTemplateEditor({
  config,
  onChange,
}: {
  config: WhatsAppTemplateConfig
  onChange: (config: WhatsAppTemplateConfig) => void
}) {
  const addParam = () => onChange({ ...config, bodyParams: [...config.bodyParams, { id: nextParamId(), value: '' }] })
  const updateParam = (id: string, value: string) =>
    onChange({ ...config, bodyParams: config.bodyParams.map((p) => (p.id === id ? { ...p, value } : p)) })
  const removeParam = (id: string) => onChange({ ...config, bodyParams: config.bodyParams.filter((p) => p.id !== id) })

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Template name</Label>
          <Input
            value={config.templateName}
            onChange={(e) => onChange({ ...config, templateName: e.target.value })}
            placeholder="e.g. pype_nhic_family_member"
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Language</Label>
          <Input
            value={config.languageCode}
            onChange={(e) => onChange({ ...config, languageCode: e.target.value })}
            placeholder="en_US"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
        <span className="flex-1 text-[11.5px] text-gray-500 dark:text-gray-400">Video header</span>
        <input
          type="checkbox"
          checked={config.videoUrl !== undefined}
          onChange={(e) => onChange({ ...config, videoUrl: e.target.checked ? '' : undefined })}
          className="size-3.5"
        />
      </div>
      {config.videoUrl !== undefined && (
        <Input
          value={config.videoUrl}
          onChange={(e) => onChange({ ...config, videoUrl: e.target.value })}
          placeholder="Video URL, or a placeholder like {{video_url}}"
          className="h-8 text-xs"
        />
      )}

      <div>
        <Label className="text-xs mb-1.5 block">Body parameters</Label>
        <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          In the exact order your template expects them. Each can be a static value or a placeholder like{' '}
          <code className="text-[10.5px]">{'{{contact.name}}'}</code>.
        </p>
        <div className="flex flex-col gap-1.5">
          {config.bodyParams.map((param, i) => (
            <div key={param.id} className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-[11px] text-gray-400">{i + 1}.</span>
              <Input
                value={param.value}
                onChange={(e) => updateParam(param.id, e.target.value)}
                placeholder="{{contact.name}}"
                className="h-7 flex-1 text-[12px]"
              />
              <button onClick={() => removeParam(param.id)} className="shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addParam} className="mt-1.5 h-7 justify-start gap-1.5 text-[12px]">
          <Plus className="size-3" />
          Add parameter
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
        <span className="flex-1 text-[11.5px] text-gray-500 dark:text-gray-400">URL button</span>
        <input
          type="checkbox"
          checked={config.buttonUrlParam !== undefined}
          onChange={(e) => onChange({ ...config, buttonUrlParam: e.target.checked ? '' : undefined })}
          className="size-3.5"
        />
      </div>
      {config.buttonUrlParam !== undefined && (
        <Input
          value={config.buttonUrlParam}
          onChange={(e) => onChange({ ...config, buttonUrlParam: e.target.value })}
          placeholder="Click token, or a placeholder like {{click_token}}"
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}
