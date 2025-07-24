import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
}

interface TokenRegenerationConfirmDialogProps {
  isOpen: boolean
  project: Project | null
  isRegenerating: boolean
  onConfirm: () => void
  onCancel: () => void
}

const TokenRegenerationConfirmDialog: React.FC<TokenRegenerationConfirmDialogProps> = ({
  isOpen,
  project,
  isRegenerating,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-left">Regenerate API Token</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left">
            Are you sure you want to regenerate the API token for{' '}
            <strong>"{project?.name}"</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">This action will:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Generate a new API token</li>
                  <li>Immediately invalidate the current token</li>
                  <li>Require updating all applications using the old token</li>
                </ul>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> The new token will only be displayed once. 
                Make sure to save it securely before closing the dialog.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button 
            variant="default"
            onClick={onConfirm}
            disabled={isRegenerating}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Token
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TokenRegenerationConfirmDialog