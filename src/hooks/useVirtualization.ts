import { useState, useEffect, useRef, useCallback } from 'react'

interface UseVirtualizationOptions {
  itemHeight: number // Fixed height of each item in pixels
  containerRef: React.RefObject<HTMLElement | null>
  totalItems: number
  overscan?: number // Number of items to render outside visible area
  headerHeight?: number // Height of sticky header if present
}

interface VirtualizationResult {
  startIndex: number
  endIndex: number
  visibleItems: number[]
  totalHeight: number
  offsetY: number
}

export const useVirtualization = ({
  itemHeight,
  containerRef,
  totalItems,
  overscan = 5,
  headerHeight = 0,
}: UseVirtualizationOptions): VirtualizationResult => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)

  // Update scroll position with throttling using requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop)
      }
    })
  }, [containerRef])

  // Update container height on resize
  useEffect(() => {
    if (!containerRef.current) {
      // Container not ready yet, try again after a short delay
      const retryTimeout = setTimeout(() => {
        if (containerRef.current) {
          setContainerHeight(containerRef.current.clientHeight)
          setScrollTop(containerRef.current.scrollTop)
        }
      }, 50)
      return () => clearTimeout(retryTimeout)
    }

    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight
        setContainerHeight(height)
        // Also update scroll position when height changes
        setScrollTop(containerRef.current.scrollTop)
      }
    }

    // Initial height - use multiple attempts to ensure we get the correct height
    updateHeight()
    
    // Try again after a short delay to catch cases where container isn't fully rendered
    const timeoutId = setTimeout(() => {
      updateHeight()
    }, 0)
    
    // Also try after a longer delay to ensure we catch it
    const timeoutId2 = setTimeout(() => {
      updateHeight()
    }, 100)

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(containerRef.current)

    // Watch for scroll
    containerRef.current.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
      resizeObserver.disconnect()
      containerRef.current?.removeEventListener('scroll', handleScroll)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [containerRef, handleScroll, totalItems])

  // Calculate visible range
  // If container height is 0, show at least some items to ensure initial render
  const effectiveHeight = containerHeight > 0 ? containerHeight : 600 // Default to 600px if not measured yet
  const calculatedStartIndex = Math.max(
    0,
    Math.floor((scrollTop - headerHeight) / itemHeight) - overscan
  )
  const startIndex = Math.max(0, calculatedStartIndex)
  
  const visibleCount = Math.ceil((effectiveHeight + headerHeight) / itemHeight)
  const calculatedEndIndex = startIndex + visibleCount + overscan * 2
  const endIndex = Math.min(
    totalItems - 1,
    Math.max(startIndex, calculatedEndIndex) // Ensure endIndex is at least startIndex
  )

  // Generate array of visible item indices
  // Ensure we always show at least some items initially
  const visibleItems: number[] = []
  
  if (totalItems === 0) {
    // No items to show
  } else if (containerHeight === 0 || endIndex < startIndex) {
    // Container height not measured yet or invalid range - show first batch of items
    const initialBatch = Math.min(totalItems - 1, overscan * 2 + 15) // Show at least 15 + overscan items
    for (let i = 0; i <= initialBatch; i++) {
      visibleItems.push(i)
    }
  } else {
    // Normal case - calculate based on scroll position
    const safeStartIndex = Math.max(0, startIndex)
    const safeEndIndex = Math.min(totalItems - 1, endIndex)
    
    // Ensure we have a valid range
    if (safeEndIndex >= safeStartIndex) {
      for (let i = safeStartIndex; i <= safeEndIndex; i++) {
        visibleItems.push(i)
      }
    } else {
      // Fallback: show first batch if calculation is invalid
      const fallbackBatch = Math.min(totalItems - 1, overscan * 2 + 15)
      for (let i = 0; i <= fallbackBatch; i++) {
        visibleItems.push(i)
      }
    }
  }
  
  // Final safety check: if visibleItems is empty but we have items, show at least the first few
  if (visibleItems.length === 0 && totalItems > 0) {
    const safetyBatch = Math.min(totalItems - 1, 20)
    for (let i = 0; i <= safetyBatch; i++) {
      visibleItems.push(i)
    }
  }

  // Calculate total height and offset
  const totalHeight = totalItems * itemHeight
  const offsetY = startIndex * itemHeight

  return {
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
    offsetY,
  }
}

