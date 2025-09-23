'use client'

import { useState, useEffect, useRef } from 'react'

const mode = process.env.NODE_ENV

// Feedback intervals - increasing each time they reject a feedback
const FEEDBACK_INTERVALS = {
  0: 10 * 60 * 1000,  // 10 minutes first time
  1: 20 * 60 * 1000,  // 20 minutes after 1
  2: 30 * 60 * 1000,  // 30 minutes after 2
  3: 45 * 60 * 1000,  // 45 minutes after 3
  default: 60 * 60 * 1000  // 60 minutes for normal feedback (doesn't increase further)
}

// For testing - much shorter intervals
const FEEDBACK_INTERVALS_TEST = {
  0: 2 * 1000,   // 5 seconds first time
  1:  2* 1000,   // 8 seconds after 1
  2: 2 * 1000,  // 12 seconds after 2
  3: 2 * 1000,  // 15 seconds after 3
  default: 2 * 1000  // 20 seconds for normal feedback
}

const FEEDBACK_COOLDOWN_MS_PROD = 5 * 24 * 60 * 60 * 1000 // 3 days after submission
const FEEDBACK_COOLDOWN_MS_TEST = 1 * 60 * 1000  // 1 minute after submission
const SESSION_KEY = 'feedback_widget_session'
const SUBMISSION_KEY = 'feedback_last_submission'

// Use test intervals for now, switch to FEEDBACK_INTERVALS for production`
const INTERVALS = mode === 'development' ? FEEDBACK_INTERVALS_TEST : FEEDBACK_INTERVALS // For production

interface FeedbackTimingState {
  feedbackRejectionCount: number
  lastFeedbackTime: number
  sessionStartTime: number
}

export function useFeedbackTiming() {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false)
  const [rejectionCount, setRejectionCount] = useState(0)
  const timingStateRef = useRef<FeedbackTimingState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // const FEEDBACK_COOLDOWN_MS = mode === 'development' ? FEEDBACK_COOLDOWN_MS_TEST : FEEDBACK_COOLDOWN_MS_PROD
  const FEEDBACK_COOLDOWN_MS = FEEDBACK_COOLDOWN_MS_PROD

  // Check if user submitted feedback recently (across all sessions)
  const checkSubmissionCooldown = () => {
    const lastSubmission = localStorage.getItem(SUBMISSION_KEY)
    if (lastSubmission) {
      const timeSinceSubmission = Date.now() - parseInt(lastSubmission)
      return timeSinceSubmission < FEEDBACK_COOLDOWN_MS
    }
    return false
  }

  // Initialize timing state
  useEffect(() => {
    // Don't show feedback if they submitted recently
    if (checkSubmissionCooldown()) {
      return
    }

    const savedState = sessionStorage.getItem(SESSION_KEY)
    const now = Date.now()

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as FeedbackTimingState
        timingStateRef.current = parsed
        setRejectionCount(parsed.feedbackRejectionCount)
      } catch {
        // Invalid saved state, create new
        timingStateRef.current = {
          feedbackRejectionCount: 0,
          lastFeedbackTime: now,
          sessionStartTime: now
        }
      }
    } else {
      timingStateRef.current = {
        feedbackRejectionCount: 0,
        lastFeedbackTime: now,
        sessionStartTime: now
      }
    }

    saveTimingState()
  }, [])

  // Main timing loop - continuous timer
  useEffect(() => {
    if (!timingStateRef.current || checkSubmissionCooldown()) return

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const timingState = timingStateRef.current!
      
      // Get the appropriate interval based on rejection count
      const currentInterval = INTERVALS[timingState.feedbackRejectionCount as keyof typeof INTERVALS] || INTERVALS.default
      
      // Check if enough time has passed since last feedback
      const timeSinceLastFeedback = now - timingState.lastFeedbackTime
      
      if (timeSinceLastFeedback >= currentInterval) {
        setShouldShowFeedback(true)
      }
    }, 1000) // Check every second

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const saveTimingState = () => {
    if (timingStateRef.current) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(timingStateRef.current))
    }
  }

  const dismissFeedback = () => {
    setShouldShowFeedback(false)
    
    if (timingStateRef.current) {
      const now = Date.now()
      timingStateRef.current.lastFeedbackTime = now
      timingStateRef.current.feedbackRejectionCount += 1
      setRejectionCount(timingStateRef.current.feedbackRejectionCount)
      saveTimingState()
    }
  }

  const submitFeedback = async (rating: 'positive' | 'negative', comment: string = '') => {
    setShouldShowFeedback(false)
    
    // Store submission timestamp to prevent asking for 3 days
    localStorage.setItem(SUBMISSION_KEY, Date.now().toString())
    
    // Send to Google Sheets using invisible iframe (bypasses CORS completely)
    try {
      const params = new URLSearchParams({
        timestamp: new Date().toISOString(),
        rating,
        comment,
        rejectionCount: rejectionCount.toString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })

      // Create invisible iframe to submit data - NO FETCH, NO CORS
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.style.width = '0px'
      iframe.style.height = '0px'
      iframe.src = `${process.env.NEXT_PUBLIC_FEEDBACK_URL}?${params.toString()}`
      document.body.appendChild(iframe)
      
      // Remove iframe after 3 seconds
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 3000)
      
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      // Don't block user experience if submission fails
    }
    
    if (timingStateRef.current) {
      const now = Date.now()
      timingStateRef.current.lastFeedbackTime = now
      saveTimingState()
    }
  }

  // Get feedback message based on rejection count
  const getFeedbackMessage = () => {
    switch (rejectionCount) {
      case 0:
        return {
          title: "How's your experience?",
          subtitle: "Help us improve Whispey",
          emoji: ""
        }
      case 1:
        return {
          title: "Please? 🥺",
          subtitle: "Just a quick feedback would help us so much",
          emoji: "🥺"
        }
      case 2:
        return {
          title: "PRETTY PLEASE? 🙏",
          subtitle: "We really value your input!",
          emoji: "🙏"
        }
      case 3:
        return {
          title: "😠 Fine...",
          subtitle: "We're still here if you change your mind",
          emoji: "😠"
        }
      default:
        return {
          title: "Feedback",
          subtitle: "Share your thoughts when you're ready",
          emoji: ""
        }
    }
  }

  // Don't show if they submitted recently
  const shouldShow = shouldShowFeedback && !checkSubmissionCooldown()

  return {
    shouldShowFeedback: shouldShow,
    dismissFeedback,
    submitFeedback,
    rejectionCount,
    feedbackMessage: getFeedbackMessage()
  }
}