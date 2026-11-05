import React, { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { EmailNotificationRequest, EmailNotificationResponse } from '@/types/email-notifications'

interface RequestAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectid: string | string[] | undefined
  isMobile: boolean
}

export default function RequestAccessDialog({ open, onOpenChange, projectid, isMobile }: Readonly<RequestAccessDialogProps>) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting access')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestBody: EmailNotificationRequest = {
        type: 'agent_permission',
        description: `${reason.trim()}\n\nProject ID: ${projectid}`
      }

      const response = await fetch('/api/email/notify-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to send request' }))
        throw new Error(errorData.error || 'Failed to send request')
      }

      const data: EmailNotificationResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to send request')
      }

      setSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        // Reset state after closing
        setTimeout(() => {
          setReason('')
          setSuccess(false)
          setError(null)
        }, 300)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send access request. Please try again.')
      console.error('Error sending access request:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
          <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-border shadow-2xl bg-card max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
          <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-foreground`}>
            Request Access
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tell us why you'd like to create agents with Pype
          </p>
        </DialogHeader>

        {/* Content */}
        <div className={`flex-1 ${isMobile ? 'px-4 py-4' : 'px-6 py-6'} space-y-4`}>
          {success ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-success/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                Request Sent Successfully!
              </h3>
              <p className="text-sm text-muted-foreground">
                We'll review your request and get back to you soon.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium text-foreground">
                  Why do you want to create agents with Pype?
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please share your use case, project details, or any specific requirements..."
                  className="min-h-[120px] resize-none"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-destructive mt-1">
                    {error}
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong className="font-medium">Note:</strong> Pype agent creation is currently in beta. 
                  We'll review your request and enable access based on your use case.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-muted/50 border-t border-border flex gap-3`}>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={loading || !reason.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
