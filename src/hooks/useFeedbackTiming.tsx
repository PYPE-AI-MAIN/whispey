'use client'

import { useState, useEffect, useRef } from 'react'

// const FEEDBACK_DELAY_MS = 5 * 60 * 1000 // 5 minutes
const FEEDBACK_DELAY_MS =  3000 // 10 seconds
const ACTIVITY_THRESHOLD_MS = 1000 // 1 second between activity checks
const SESSION_KEY = 'feedback_widget_session'

interface FeedbackTimingState {
  hasShownFeedback: boolean
  startTime: number
  lastActivityTime: number
  totalActiveTime: number
}

export function useFeedbackTiming() {
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false)
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false)
  const timingStateRef = useRef<FeedbackTimingState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Initialize timing state
  useEffect(() => {
    const savedState = sessionStorage.getItem(SESSION_KEY)
    const now = Date.now()

    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as FeedbackTimingState
        timingStateRef.current = {
          ...parsed,
          lastActivityTime: now
        }
        
        // If already shown feedback in this session, don't show again
        if (parsed.hasShownFeedback) {
          setHasBeenDismissed(true)
          return
        }
      } catch {
        // Invalid saved state, create new
        timingStateRef.current = {
          hasShownFeedback: false,
          startTime: now,
          lastActivityTime: now,
          totalActiveTime: 0
        }
      }
    } else {
      timingStateRef.current = {
        hasShownFeedback: false,
        startTime: now,
        lastActivityTime: now,
        totalActiveTime: 0
      }
    }

    saveTimingState()
  }, [])

  // Track user activity
  useEffect(() => {
    const trackActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    events.forEach(event => {
      document.addEventListener(event, trackActivity, true)
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity, true)
      })
    }
  }, [])

  // Main timing loop
  useEffect(() => {
    if (hasBeenDismissed || !timingStateRef.current) return

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const timingState = timingStateRef.current!
      
      // Check if user was recently active
      const timeSinceLastActivity = now - lastActivityRef.current
      const wasRecentlyActive = timeSinceLastActivity < ACTIVITY_THRESHOLD_MS
      
      if (wasRecentlyActive) {
        // Add time since last update to total active time
        const timeSinceLastUpdate = now - timingState.lastActivityTime
        timingState.totalActiveTime += Math.min(timeSinceLastUpdate, ACTIVITY_THRESHOLD_MS)
        timingState.lastActivityTime = now
        
        // Check if we should show feedback
        if (!timingState.hasShownFeedback && timingState.totalActiveTime >= FEEDBACK_DELAY_MS) {
          setShouldShowFeedback(true)
          timingState.hasShownFeedback = true
        }
        
        saveTimingState()
      }
    }, 1000) // Check every second

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [hasBeenDismissed])

  const saveTimingState = () => {
    if (timingStateRef.current) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(timingStateRef.current))
    }
  }

  const dismissFeedback = () => {
    setShouldShowFeedback(false)
    setHasBeenDismissed(true)
    
    if (timingStateRef.current) {
      timingStateRef.current.hasShownFeedback = true
      saveTimingState()
    }
  }

  return {
    shouldShowFeedback: shouldShowFeedback && !hasBeenDismissed,
    dismissFeedback
  }
}