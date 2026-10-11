// Which Call Logs view someone uses. Kept on their account (Clerk user
// metadata) as well as in the browser, so choosing the new view sticks on every
// device until they pick the classic view themselves.
import { useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useCallLogsStore, type CallLogsViewMode } from '@/stores/callLogsStore'

const KEY = 'callLogsViewMode'

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
