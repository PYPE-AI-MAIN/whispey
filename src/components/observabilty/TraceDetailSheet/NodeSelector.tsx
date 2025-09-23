import { cn } from '@/lib/utils'
import { MessageSquare, Wrench } from 'lucide-react'
import React from 'react'

function NodeSelector({ pipelineStages, setSelectedNode, selectedNode }: any) {
  return (
    <div className="space-y-2">
      {pipelineStages
        .filter((stage: any) => stage.active)
        .map((stage: any) => (
          <button
            key={stage.id}
            onClick={() => setSelectedNode(stage.id)}
            className={cn(
              "w-full p-3 rounded-lg border text-left transition-all hover:shadow-sm",
              selectedNode === stage.id
                ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border",
                  `bg-${stage.color}-50 dark:bg-${stage.color}-900/20 border-${stage.color}-200 dark:border-${stage.color}-800 text-${stage.color}-600 dark:text-${stage.color}-400`,
                )}
              >
                {stage.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  {stage.name}
                  {stage.tools && stage.tools.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{stage.tools.length}</span>
                    </div>
                  )}
                  {stage.llmRequests && stage.llmRequests.length > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">{stage.llmRequests.length}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {stage.status === "success" && <span className="text-green-600 dark:text-green-400">✓ Completed</span>}
                  {stage.status === "missing" && <span className="text-gray-500 dark:text-gray-400">No data</span>}
                  {stage.status === "active" && <span className="text-orange-600 dark:text-orange-400">● Active</span>}
                </div>
              </div>
              {stage.metrics && (
                <div className="text-right">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    {stage.id === "eou" && `${stage.metrics.end_of_utterance_delay?.toFixed(2)}s`}
                    {stage.id === "stt" && `${stage.metrics.duration?.toFixed(2)}s`}
                    {stage.id === "llm" && `${stage.metrics.ttft?.toFixed(2)}s`}
                    {stage.id === "tts" && `${stage.metrics.ttfb?.toFixed(2)}s`}
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
    </div>
  )
}

export default NodeSelector