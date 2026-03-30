import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'

interface UseVirtualizationOptions {
  itemHeight: number // Fixed height of each item in pixels
  containerRef: React.RefObject<HTMLElement | null>
  totalItems: number
  overscan?: number // Number of items to render outside visible area
  headerHeight?: number // Height of sticky header if present
  /**
   * When false the hook skips all scrollTop state updates, preventing
   * unnecessary re-renders while the non-virtualized (all-rows) path is
   * active. Defaults to true.
   *
   * When this transitions false → true, a useLayoutEffect syncs the actual
   * DOM scrollTop SYNCHRONOUSLY before the browser paints, so the very first
   * virtualized render uses the correct position instead of stale state.
   */
  enabled?: boolean
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
  enabled = true,
}: UseVirtualizationOptions): VirtualizationResult => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // Track the previous `enabled` value so the layout effect can detect the
  // false→true transition and sync scroll before the first virtualized paint.
  const enabledRef = useRef(enabled)

  useLayoutEffect(() => {
    const wasEnabled = enabledRef.current
    enabledRef.current = enabled

    if (!wasEnabled && enabled && containerRef.current) {
      // Virtualization just activated.  Read the real scroll position from the
      // DOM synchronously — useLayoutEffect fires before the browser paints —
      // so the first virtualized render shows the correct rows instead of the
      // stale scrollTop=0 that would otherwise cause a blank viewport.
      setScrollTop(containerRef.current.scrollTop)
      setContainerHeight(containerRef.current.clientHeight)
    }
  }, [enabled, containerRef])

  // Only update scrollTop when virtualization is active.
  //
  // When enabled=false (non-virtualized path, all rows in DOM), calling
  // setScrollTop on every scroll event triggers unnecessary React re-renders.
  // With 50-500 rows × ~15 cells each, these re-renders can take 5-20 ms,
  // causing React to fall behind scroll events and drop frames → visual blank.
  //
  // When enabled=true, the synchronous setScrollTop (no rAF) ensures the
  // virtual window is always up-to-date — no frame of blank during scroll.
  const handleScroll = useCallback(() => {
    if (containerRef.current && enabledRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [containerRef])

  // Set up container size measurement and scroll listener.
  // IMPORTANT: totalItems and enabled are intentionally NOT in the deps array.
  // Changing either must NOT re-run this effect — doing so would remove and
  // re-add the scroll listener, creating a window where scroll events are
  // missed and scrollTop goes stale.
  useEffect(() => {
    if (!containerRef.current) {
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
        setContainerHeight(containerRef.current.clientHeight)
        setScrollTop(containerRef.current.scrollTop)
      }
    }

    updateHeight()

    const timeoutId = setTimeout(updateHeight, 0)
    const timeoutId2 = setTimeout(updateHeight, 100)

    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(containerRef.current)

    containerRef.current.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
      resizeObserver.disconnect()
      containerRef.current?.removeEventListener('scroll', handleScroll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, handleScroll])

  // Calculate visible range.
  // If container height is 0, show at least some items to ensure initial render.
  const effectiveHeight = containerHeight > 0 ? containerHeight : 600
  const calculatedStartIndex = Math.max(
    0,
    Math.floor((scrollTop - headerHeight) / itemHeight) - overscan
  )
  const startIndex = Math.max(0, calculatedStartIndex)

  const visibleCount = Math.ceil((effectiveHeight + headerHeight) / itemHeight)
  const calculatedEndIndex = startIndex + visibleCount + overscan * 2
  const endIndex = Math.min(
    totalItems - 1,
    Math.max(startIndex, calculatedEndIndex)
  )

  const visibleItems: number[] = []

  if (totalItems === 0) {
    // nothing
  } else if (containerHeight === 0 || endIndex < startIndex) {
    const initialBatch = Math.min(totalItems - 1, overscan * 2 + 15)
    for (let i = 0; i <= initialBatch; i++) visibleItems.push(i)
  } else {
    const safeStart = Math.max(0, startIndex)
    const safeEnd = Math.min(totalItems - 1, endIndex)
    if (safeEnd >= safeStart) {
      for (let i = safeStart; i <= safeEnd; i++) visibleItems.push(i)
    } else {
      const fallback = Math.min(totalItems - 1, overscan * 2 + 15)
      for (let i = 0; i <= fallback; i++) visibleItems.push(i)
    }
  }

  if (visibleItems.length === 0 && totalItems > 0) {
    const safety = Math.min(totalItems - 1, 20)
    for (let i = 0; i <= safety; i++) visibleItems.push(i)
  }

  const totalHeight = totalItems * itemHeight
  const offsetY = startIndex * itemHeight

  return { startIndex, endIndex, visibleItems, totalHeight, offsetY }
}
