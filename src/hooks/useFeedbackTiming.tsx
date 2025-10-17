'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

// Default interval - 7 days
const DEFAULT_INTERVAL = 7 * 24 * 60 * 60 * 1000

// Dismissal intervals - escalating pattern: 1 day, 2 days, then back to 7 days
const DISMISSAL_INTERVALS = {
  0: 1 * 24 * 60 * 60 * 1000,      // 1 day after first dismissal
  1: 2 * 24 * 60 * 60 * 1000,      // 2 days after second dismissal
  2: 7 * 24 * 60 * 60 * 1000,      // 7 days after third dismissal (back to default)
}

const SESSION_KEY = 'feedback_widget_session'
const DISMISSAL_KEY = 'feedback_dismissal_data'

interface FeedbackTimingState {
  dismissalCount: number
  lastActionTime: number
  sessionStartTime: number
}

interface DismissalData {
  timestamp: number
  count: number
}

export function useFeedbackTiming() {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false)
  const [dismissalCount, setDismissalCount] = useState(0)
  const timingStateRef = useRef<FeedbackTimingState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { user } = useUser()

  // Check if we should show feedback based on last action
  const checkShouldShow = () => {
    const dismissalData = localStorage.getItem(DISMISSAL_KEY)
    if (dismissalData) {
      try {
        const { timestamp, count }: DismissalData = JSON.parse(dismissalData)
        const timeSinceAction = Date.now() - timestamp
        
        // Get appropriate interval based on dismissal count
        const interval = DISMISSAL_INTERVALS[count as keyof typeof DISMISSAL_INTERVALS] || DEFAULT_INTERVAL
        
        return timeSinceAction >= interval
      } catch {
        return true
      }
    }
    return true // No data means first time, show after 7 days from session start
  }

  // Initialize timing state
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY)
    const now = Date.now()

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as FeedbackTimingState
        timingStateRef.current = parsed
        setDismissalCount(parsed.dismissalCount)
      } catch {
        timingStateRef.current = {
          dismissalCount: 0,
          lastActionTime: now,
          sessionStartTime: now
        }
      }
    } else {
      timingStateRef.current = {
        dismissalCount: 0,
        lastActionTime: now,
        sessionStartTime: now
      }
    }

    saveTimingState()
  }, [])

  // Main timing loop
  useEffect(() => {
    if (!timingStateRef.current) return

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const timingState = timingStateRef.current!
      
      // Check if enough time has passed since session start (initial 7 day delay)
      const timeSinceSessionStart = now - timingState.sessionStartTime
      
      if (timeSinceSessionStart >= DEFAULT_INTERVAL && checkShouldShow()) {
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
      const newCount = Math.min(timingStateRef.current.dismissalCount + 1, 2) // Max count is 2 (0,1,2)
      
      // Update timing state
      timingStateRef.current.lastActionTime = now
      timingStateRef.current.dismissalCount = newCount
      setDismissalCount(newCount)
      saveTimingState()
      
      // Store dismissal data in localStorage
      const dismissalData: DismissalData = {
        timestamp: now,
        count: newCount
      }
      localStorage.setItem(DISMISSAL_KEY, JSON.stringify(dismissalData))
    }
  }

  const submitFeedback = async (rating: 'positive' | 'negative', comment: string = '') => {
    setShouldShowFeedback(false)
    
    // Reset everything - start fresh 7-day cycle
    const now = Date.now()
    
    // Clear dismissal data and reset count
    localStorage.removeItem(DISMISSAL_KEY)
    
    // Store new baseline
    const dismissalData: DismissalData = {
      timestamp: now,
      count: -1 // Special value to indicate feedback was submitted, not dismissed
    }
    localStorage.setItem(DISMISSAL_KEY, JSON.stringify(dismissalData))
    
    if (timingStateRef.current) {
      timingStateRef.current.dismissalCount = 0
      timingStateRef.current.lastActionTime = now
      timingStateRef.current.sessionStartTime = now
      setDismissalCount(0)
      saveTimingState()
    }
    
    // Send to Google Sheets using invisible iframe
    try {
      const params = new URLSearchParams({
        timestamp: new Date().toISOString(),
        rating,
        comment,
        dismissalCount: dismissalCount.toString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        // User identification data from Clerk
        clerkId: user?.id || 'anonymous',
        username: user?.username || user?.emailAddresses?.[0]?.emailAddress || 'unknown',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.emailAddresses?.[0]?.emailAddress || '',
        // Additional user metadata
        createdAt: user?.createdAt?.toISOString() || '',
        lastSignInAt: user?.lastSignInAt?.toISOString() || '',
        imageUrl: user?.imageUrl || '',
        // Session info
        sessionStartTime: timingStateRef.current?.sessionStartTime?.toString() || '',
        sessionDuration: timingStateRef.current ? (Date.now() - timingStateRef.current.sessionStartTime).toString() : '0'
      })

      // Create invisible iframe to submit data
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
    }
  }

  // Get feedback message based on dismissal count
  const getFeedbackMessage = () => {
    switch (dismissalCount) {
      case 0:
        return {
          title: "How's your experience?",
          subtitle: "Help us improve Whispey",
          emoji: ""
        }
      case 1:
        return {
          title: "Quick feedback? 🙏",
          subtitle: "Your input helps us improve",
          emoji: "🙏"
        }
      case 2:
        return {
          title: "One more time? 😊",
          subtitle: "We value your feedback",
          emoji: "😊"
        }
      default:
        return {
          title: "How's your experience?",
          subtitle: "Help us improve Whispey",
          emoji: ""
        }
    }
  }

  // Show feedback if conditions are met
  const shouldShow = shouldShowFeedback && checkShouldShow()

  return {
    shouldShowFeedback: shouldShow,
    dismissFeedback,
    submitFeedback,
    dismissalCount,
    feedbackMessage: getFeedbackMessage()
  }
}