'use client'

import React, { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Star, Calendar, Mail, MessageSquare } from 'lucide-react'

interface FeedbackPopupProps {
  onDismiss: () => void
}

type FeedbackStep = 'rating' | 'followup' | 'success'
type FeedbackCategory = 'bug' | 'feature' | 'general'

interface FeedbackData {
  rating: number
  category: FeedbackCategory | null
  comment: string
}

export default function FeedbackPopup({ onDismiss }: FeedbackPopupProps) {
  const { user } = useUser()
  const [step, setStep] = useState<FeedbackStep>('rating')
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    category: null,
    comment: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStarClick = (rating: number) => {
    setFeedback(prev => ({ ...prev, rating }))
  }

  const handleInitialSubmit = async () => {
    if (feedback.rating === 0) return

    setIsSubmitting(true)

    // If rating is 4 or 5, submit and show success
    if (feedback.rating >= 4) {
      await submitFeedback()
      setStep('success')
    } else {
      // If rating is 1-3, show follow-up options
      setStep('followup')
    }

    setIsSubmitting(false)
  }

  const handleFollowupSubmit = async () => {
    setIsSubmitting(true)
    await submitFeedback()
    setStep('success')
    setIsSubmitting(false)
  }

  const submitFeedback = async () => {
    const feedbackData = {
      user: {
        email: user?.emailAddresses?.[0]?.emailAddress || 'anonymous',
        name: user?.fullName || user?.firstName || 'Anonymous User'
      },
      rating: feedback.rating,
      category: feedback.category,
      comment: feedback.comment,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    try {
      // Send email via your preferred method
      // This is a placeholder - you'll need to implement your email sending logic
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  const handleScheduleMeeting = () => {
    // Replace with your actual Calendly link
    const calendlyUrl = 'https://calendly.com/your-calendar/15min'
    
    // Pre-fill with user info if available
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    const userName = user?.fullName || user?.firstName
    
    let fullUrl = calendlyUrl
    if (userEmail || userName) {
      const params = new URLSearchParams()
      if (userEmail) params.set('email', userEmail)
      if (userName) params.set('name', userName)
      fullUrl = `${calendlyUrl}?${params.toString()}`
    }
    
    window.open(fullUrl, '_blank')
    onDismiss()
  }

  const handleEmailSupport = () => {
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    const userName = user?.fullName || user?.firstName || 'User'
    
    const subject = encodeURIComponent('Whispey Support - Feedback Follow-up')
    const body = encodeURIComponent(`Hi team,

I recently left feedback on Whispey with a ${feedback.rating}-star rating${feedback.category ? ` in the "${feedback.category}" category` : ''}.

${feedback.comment ? `My feedback: "${feedback.comment}"\n\n` : ''}I'd like to discuss this further or get some help.

Best regards,
${userName}

---
User: ${userEmail}
Page: ${window.location.href}`)

    window.open(`mailto:deepesh@pypeai.com?subject=${subject}&body=${body}`)
    onDismiss()
  }

  if (step === 'success') {
    return (
      <Card className="fixed bottom-4 right-4 w-80 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-50 animate-in slide-in-from-bottom-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Thanks for your feedback!
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            We appreciate you taking the time to help us improve Whispey.
          </p>
          <Button
            onClick={onDismiss}
            size="sm"
            className="w-full text-xs h-8"
          >
            Close
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 'followup') {
    return (
      <Card className="fixed bottom-4 right-4 w-80 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-50 animate-in slide-in-from-bottom-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Having trouble? Let's chat!
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              What type of feedback?
            </label>
            <Select
              value={feedback.category || ''}
              onValueChange={(value) => setFeedback(prev => ({ ...prev, category: value as FeedbackCategory }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="general">General Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Tell us more (optional)
            </label>
            <Textarea
              value={feedback.comment}
              onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))}
              placeholder="What can we improve?"
              className="text-xs min-h-[60px] resize-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Choose how you'd like to continue:
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleScheduleMeeting}
                size="sm"
                variant="outline"
                className="text-xs h-8 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Calendar className="w-3 h-3 mr-1.5" />
                Schedule Call
              </Button>
              
              <Button
                onClick={handleEmailSupport}
                size="sm"
                variant="outline"
                className="text-xs h-8"
              >
                <Mail className="w-3 h-3 mr-1.5" />
                Email Us
              </Button>
            </div>

            <Button
              onClick={handleFollowupSubmit}
              disabled={isSubmitting}
              size="sm"
              className="w-full text-xs h-8"
            >
              <MessageSquare className="w-3 h-3 mr-1.5" />
              {isSubmitting ? 'Submitting...' : 'Just Submit Feedback'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-50 animate-in slide-in-from-bottom-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
            How's your experience so far?
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Rate your experience with Whispey
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleStarClick(star)}
                className="p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Star
                  className={`w-5 h-5 ${
                    star <= feedback.rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleInitialSubmit}
          disabled={feedback.rating === 0 || isSubmitting}
          size="sm"
          className="w-full text-xs h-8"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </CardContent>
    </Card>
  )
}