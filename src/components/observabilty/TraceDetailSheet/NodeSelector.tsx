import { cn } from '@/lib/utils'
import { MessageSquare, Wrench, AlertTriangle } from 'lucide-react'
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
                ? "border-blue-500 dark:border-blue-400 bg-primary/10 shadow-sm"
                : "border-border bg-card hover:border-border",
            )}
          >
            <div className="flex items-center gap-3">
              {/* Neutral, not per-stage colored — the icon shape (and this stage's
                  own name label) already says which stage this is; the old
                  bg-${stage.color}-50-style classes were also dynamically built,
                  which Tailwind can't reliably pick up for its production CSS. */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-muted border-border text-muted-foreground">
                {stage.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2 text-foreground">
                  {stage.name}
                  {stage.tools && stage.tools.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{stage.tools.length}</span>
                    </div>
                  )}
                  {stage.llmRequests && stage.llmRequests.length > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">{stage.llmRequests.length}</span>
                    </div>
                  )}
                  {stage.fallbackFailureCount > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                      <span className="text-xs text-destructive font-medium">{stage.fallbackFailureCount}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stage.status === "success" && <span className="text-success">✓ Completed</span>}
                  {stage.status === "missing" && <span className="text-muted-foreground">No data</span>}
                  {stage.status === "active" && <span className="text-warning">● Active</span>}
                </div>
              </div>
              {stage.metrics && (
                <div className="text-right">
                  <div className="text-xs font-mono text-muted-foreground">
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