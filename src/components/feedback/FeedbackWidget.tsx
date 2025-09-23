'use client'

import { usePathname } from 'next/navigation'
import FeedbackPopup from './FeedbackPopup'
import { useFeedbackTiming } from '@/hooks/useFeedbackTiming'

// Pages where feedback widget should not appear
const EXCLUDED_PATHS = [
  '/sign-in',
  '/sign-up', 
  '/docs'
]

export default function FeedbackWidget() {
  const pathname = usePathname()
  const { shouldShowFeedback, dismissFeedback, submitFeedback, feedbackMessage } = useFeedbackTiming()

  // Don't show on excluded paths
  const shouldExclude = EXCLUDED_PATHS.some(path => pathname.startsWith(path))
  
  if (shouldExclude || !shouldShowFeedback) {
    return null
  }

  return (
    <FeedbackPopup 
      onDismiss={dismissFeedback} 
      onSubmit={submitFeedback}
      feedbackMessage={feedbackMessage}
    />
  )
}