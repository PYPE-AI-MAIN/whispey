'use client'

import React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

// Per-letter pulse/glow wave — same technique as Aceternity's "Loader Five"
// (recreated from the rendered demo; their registry needs a Pro token this
// project doesn't have). `text` re-keys the wave on change so swapping the
// message restarts the animation cleanly instead of jumping mid-pulse.
export function LoaderFive({ text, className }: Readonly<{ text: string; className?: string }>) {
  return (
    <div
      key={text}
      className={cn(
        'font-sans font-bold [--shadow-color:var(--color-neutral-500)] dark:[--shadow-color:var(--color-neutral-100)]',
        className
      )}
    >
      {text.split('').map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          className="inline-block"
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.06, 1],
            textShadow: ['0 0 0px var(--shadow-color)', '0 0 6px var(--shadow-color)', '0 0 0px var(--shadow-color)'],
          }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.05, ease: 'easeInOut' }}
        >
          {char === ' ' ? ' ' : char}
        </motion.span>
      ))}
    </div>
  )
}
