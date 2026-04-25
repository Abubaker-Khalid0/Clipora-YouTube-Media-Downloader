'use client'

import { useEffect } from 'react'
import { initErrorTracking } from '@/lib/error-tracking'

/**
 * Mounts global window error listeners exactly once, client-side only.
 * Renders nothing — purely a side-effect initializer.
 */
export default function ErrorTrackingInit() {
  useEffect(() => {
    initErrorTracking()
  }, [])

  return null
}
