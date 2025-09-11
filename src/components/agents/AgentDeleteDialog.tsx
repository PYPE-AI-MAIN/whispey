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
      <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-lg border border-gray-200 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-900">
            Remove Monitoring
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-2">
            Are you sure you want to stop monitoring "{agent?.name}"? This will remove all observability for this agent and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 pt-6">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 border-gray-300 text-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={() => agent && onConfirm(agent)}
            disabled={isDeleting}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Remove Monitoring
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgentDeleteDialog