import React from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}

interface AgentDeleteDialogProps {
  agent: Agent | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: (agent: Agent) => void
}

const AgentDeleteDialog: React.FC<AgentDeleteDialogProps> = ({
  agent,
  isDeleting,
  onClose,
  onConfirm
}) => {
  return (
    <Dialog open={agent !== null} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Remove Monitoring
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
            Are you sure you want to stop monitoring "{agent?.name}"? This will remove all observability for this agent and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-5">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={() => agent && onConfirm(agent)}
            disabled={isDeleting}
            className="flex-1 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Remove Monitoring
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgentDeleteDialog