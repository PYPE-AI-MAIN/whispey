// src/app/page.tsx
// 'use client'

// import { useUser } from '@clerk/nextjs'
// import ProjectSelection from '../components/projects/ProjectSelection'
// import { useRouter } from 'next/navigation'
// import { useEffect } from 'react'

// export default function Home() {
//   const { isSignedIn, isLoaded } = useUser()
//   const router = useRouter()

//   useEffect(() => {
//     if (isLoaded && !isSignedIn) {
//       router.push('/sign')
//     }
//   }, [isLoaded, isSignedIn, router])

//   return <ProjectSelection isAuthLoaded={isLoaded} />
// }


// src/app/page.tsx -> WIP new landing page
'use client'

import { useUser } from '@clerk/nextjs'
import ProjectSelection from '../components/projects/ProjectSelection'
import LandingPage from '../components/landing'

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <LandingPage />
  }

  console.log('Signed in, showing project selection...')
  return <ProjectSelection isAuthLoaded={isLoaded} />
}