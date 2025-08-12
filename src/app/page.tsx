'use client'

import ProjectSelection from '../components/projects/ProjectSelection'

// Demo Mode - No Authentication Required!
export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectSelection />
    </div>
  )
}