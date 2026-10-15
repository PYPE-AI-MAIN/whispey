'use client'

import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { setBrandTheme } from '@/lib/brandTheme'

export function useBrandTheme() {
  const [on, setOn] = useState(false)
  useEffect(() => setOn(document.documentElement.classList.contains('pype')), [])
  const toggle = () => {
    setBrandTheme(!on)
    setOn(!on)
  }
  return { on, toggle }
}

export function BrandToggle({ className }: Readonly<{ className: string }>) {
  const { on, toggle } = useBrandTheme()
  const label = on ? 'Switch back to the old theme' : 'Try the new Pype theme'
  return (
    <button type="button" onClick={toggle} aria-label={label} aria-pressed={on} title={label} className={`${className} ${on ? 'text-primary!' : ''}`}>
      <Palette className="h-4 w-4" />
    </button>
  )
}
