'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { UserPlus, MessageCircle, Phone, Video, Clock, GitBranch, CheckCircle2, ArrowUpRight } from 'lucide-react'
import type { BranchNodeConfig, DispatchNodeConfig, FlowNodeData, FlowNodeKind } from '@/lib/campaignFlows/types'
import { isChannelKind } from '@/lib/campaignFlows/types'

export const kindStyles: Record<FlowNodeKind, { icon: React.ElementType; chip: string }> = {
  trigger: { icon: UserPlus, chip: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
  call: { icon: Phone, chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  whatsapp: { icon: MessageCircle, chip: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  video: { icon: Video, chip: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
  wait: { icon: Clock, chip: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
  branch: { icon: GitBranch, chip: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400' },
  success: { icon: CheckCircle2, chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
  end: { icon: ArrowUpRight, chip: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
}

export function FlowNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  const style = kindStyles[data.kind]
  const Icon = style.icon
  const isBranch = data.kind === 'branch'
  const retryCount = isChannelKind(data.kind) ? (data.config as DispatchNodeConfig).retryRules?.length : undefined
  // A branch block always has a fallback "Otherwise" path, plus one handle
  // per user-defined branch — everything else is just a single next step,
  // same as trigger/wait/dispatch nodes.
  const outHandles = isBranch
    ? [
        ...(data.config as BranchNodeConfig).branches.map((b) => ({ id: `branch-${b.id}`, label: b.label || 'Branch' })),
        { id: 'default', label: 'Otherwise' },
      ]
    : [{ id: 'bottom', label: undefined as string | undefined }]

  return (
    <div
      className={`w-60 cursor-pointer rounded-xl border bg-white dark:bg-gray-800 px-4 py-3.5 shadow-sm transition-all hover:shadow-md ${
        selected ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/40 dark:ring-blue-500/40' : 'border-gray-200 dark:border-gray-700'
      } ${data.kind === 'end' ? 'border-dashed bg-transparent shadow-none' : ''} ${isBranch ? 'border-fuchsia-200 dark:border-fuchsia-800' : ''}`}
    >
      {/* Every handle needs an explicit id once a node has more than one of
          the same type — React Flow can't disambiguate an unnamed handle once
          there's a second one to choose from. All edge-creation code sets
          sourceHandle/targetHandle to match these ids. */}
      <Handle id="top" type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-white dark:!border-gray-800 !bg-gray-300 dark:!bg-gray-600" />
      <Handle id="left" type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-white dark:!border-gray-800 !bg-gray-300 dark:!bg-gray-600" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-white dark:!border-gray-800 !bg-gray-300 dark:!bg-gray-600" />
      <div className="flex items-start gap-2.5">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-md ${style.chip}`}>
          <Icon className="size-3.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-[13px] font-medium leading-tight text-gray-900 dark:text-gray-100">{data.title}</div>
          {data.subtitle && <div className="mt-1 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{data.subtitle}</div>}
        </div>
      </div>
      {typeof retryCount === 'number' && retryCount > 0 && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-gray-100 dark:border-gray-700 pt-2 text-[10.5px] font-medium text-gray-500 dark:text-gray-400">
          {retryCount} retry rule{retryCount !== 1 ? 's' : ''}
        </div>
      )}
      {isBranch && (
        <div className="mt-2.5 border-t border-fuchsia-100 dark:border-fuchsia-900/40 pt-2 text-[10.5px] font-medium text-fuchsia-600 dark:text-fuchsia-400">
          {(data.config as BranchNodeConfig).branches.length} branch{(data.config as BranchNodeConfig).branches.length !== 1 ? 'es' : ''} + Otherwise
        </div>
      )}

      {outHandles.map((h, i) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={Position.Bottom}
          style={{ left: `${((i + 1) / (outHandles.length + 1)) * 100}%` }}
          className={`!h-2 !w-2 !border-2 !border-white dark:!border-gray-800 ${
            h.id === 'default' || h.id === 'bottom' ? '!bg-gray-300 dark:!bg-gray-600' : '!bg-fuchsia-400 dark:!bg-fuchsia-500'
          }`}
        />
      ))}
      {isBranch && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5 text-[9.5px] font-medium">
          {outHandles.map((h) => (
            <span key={h.id} className={h.id === 'default' ? 'text-gray-400 dark:text-gray-500' : 'text-fuchsia-600 dark:text-fuchsia-400'}>
              {h.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
