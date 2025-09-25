'use client'

import { useState, useEffect, useCallback } from 'react'

export function useMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  const checkIsMobile = useCallback(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < breakpoint)
    }
  }, [breakpoint])

  useEffect(() => {
    // Set mounted first
    setMounted(true)
    
    // Initial check with safety guard
    checkIsMobile()

    // Debounced resize handler to prevent excessive calls
    let timeoutId: NodeJS.Timeout
    const debouncedCheck = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(checkIsMobile, 16) // ~60fps
    }

    window.addEventListener('resize', debouncedCheck)
    
    return () => {
      window.removeEventListener('resize', debouncedCheck)
      clearTimeout(timeoutId)
    }
  }, [checkIsMobile])

  return { 
    isMobile: mounted ? isMobile : false, 
    mounted 
  }
}