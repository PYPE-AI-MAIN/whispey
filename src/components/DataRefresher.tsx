'use client'
import { useEffect } from 'react'

export function DataRefresher() {
  useEffect(() => {
    const triggerSync = async () => {
      if (typeof window === 'undefined') return // Only run in browser
      
      try {
        console.log('🔄 DataRefresher: Triggering MockDataService sync...')
        
        // Wait a bit for MockDataService to be initialized
        let attempts = 0
        while (attempts < 10 && !(window as any).MockDataService) {
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        
        if ((window as any).MockDataService) {
          await (window as any).MockDataService.syncWithAPI()
          console.log('✅ DataRefresher: MockDataService sync completed')
        } else {
          console.log('⏳ DataRefresher: MockDataService not available after waiting')
        }
      } catch (error) {
        console.error('❌ DataRefresher: Error during sync:', error)
      }
    }
    
    // Small delay to ensure MockDataService is initialized
    setTimeout(triggerSync, 200)
  }, [])
  
  return null // This component doesn't render anything
}
