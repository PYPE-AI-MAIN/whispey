import { createServiceRoleClient } from '@/lib/supabase-server'
import type { DataPlane } from '../ports'
import { createQueryPlane } from './queryPlane'

/** Today's behaviour: Pype's Supabase through the service-role client. Used when no route is set. */
export function createPypePlane(): DataPlane {
  return {
    ...createQueryPlane(createServiceRoleClient(), { typed: false }),
    storage: {
      async signRecordingUrl() {
        // Pype recordings are still signed by the audio routes (S3); no caller goes through this port yet.
        throw new Error('Pype recordings are signed by the audio routes')
      },
    },
  }
}
