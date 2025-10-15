// src/components/agents/PhoneRequestDialog.tsx
'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Phone, Loader2, Send, AlertCircle } from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import { useParams } from 'next/navigation'
import type { EmailNotificationRequest, EmailNotificationResponse } from '@/types/email-notifications'

interface PhoneRequestDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  agentId: any
  agentName: any
}

const PhoneRequestDialog: React.FC<PhoneRequestDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  agentId,
  agentName
}) => {
  const { isMobile } = useMobile(768)
  const params = useParams()
  const projectId = params.projectid as string
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for requesting a phone number')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const requestBody: EmailNotificationRequest = {
        type: 'phone_number_request',
        description: `${reason.trim()}\n\nProject ID: ${projectId}\nAgent ID: ${agentId}\nAgent Name: ${agentName}`
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
        console.error('API Error:', errorData)
        
        if (errorData.error?.includes('admin emails')) {
          throw new Error('System configuration error. Please contact support.')
        } else if (response.status === 401) {
          throw new Error('You must be logged in to request access.')
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.')
        } else {
          throw new Error('Unable to send your request. Please try again.')
        }
      }

      const data: EmailNotificationResponse = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to send request')
      }

      setSuccess(true)
      setTimeout(() => {
        handleClose()
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send access request. Please try again.')
      console.error('Error sending access request:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setReason('')
      setSuccess(false)
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900">
        {/* Header */}
        <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} border-b border-gray-200 dark:border-gray-800`}>
          <div className="flex items-center gap-3">
            <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center`}>
              <Phone className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-blue-600 dark:text-blue-400`} />
            </div>
            <div>
              <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100`}>
                Request Phone Number
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Tell us why you need a phone number
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className={`${isMobile ? 'px-4 py-4' : 'px-6 py-6'} space-y-4`}>
          {success ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                Request Sent Successfully!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We'll review your request and assign a phone number once approved.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Why do you need a phone number?
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please describe your use case, expected call volume, and any specific requirements..."
                  className="min-h-[120px] resize-none"
                  disabled={loading}
                />
                {error && (
                  <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 mt-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <h4 className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1.5">
                  What happens next?
                </h4>
                <ul className="space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                  <li>• We'll review your request within 24 hours</li>
                  <li>• Once approved, a phone number will be assigned</li>
                  <li>• You'll be able to configure it with your agent</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex gap-3`}>
            <Button
              variant="outline"
              onClick={handleClose}
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

export default PhoneRequestDialog