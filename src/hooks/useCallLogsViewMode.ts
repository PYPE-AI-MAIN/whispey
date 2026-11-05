// Which Call Logs view someone uses. The new view is the default; the classic
// one is only reachable from the More menu. A choice is kept on their account
// (Clerk user metadata) as well as in the browser, so it sticks on every device.
import { useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useCallLogsStore, type CallLogsViewMode } from '@/stores/callLogsStore'

// A new key: choices saved under the old one ('callLogsViewMode') were made while the
// classic view was the default, so they no longer count.
const KEY = 'callLogsView'

export function useCallLogsViewMode(): [CallLogsViewMode, (mode: CallLogsViewMode) => void] {
  const { user } = useUser()
  const viewMode = useCallLogsStore((s) => s.viewMode)
  const setLocal = useCallLogsStore((s) => s.setViewMode)
  const saved = user?.unsafeMetadata?.[KEY]

  // The account's choice wins over whatever this browser remembered.
  useEffect(() => {
    if ((saved === 'new' || saved === 'legacy') && saved !== useCallLogsStore.getState().viewMode) setLocal(saved)
  }, [saved, setLocal])

  const setViewMode = useCallback((mode: CallLogsViewMode) => {
    setLocal(mode)
    if (user && user.unsafeMetadata?.[KEY] !== mode) {
      user.update({ unsafeMetadata: { ...user.unsafeMetadata, [KEY]: mode } }).catch(() => {
        // the browser copy still holds the choice
      })
    }
  }, [user, setLocal])

  return [viewMode, setViewMode]
}
