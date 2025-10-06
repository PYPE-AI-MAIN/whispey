"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FloatingCTA() {
  return (
    <div className="fixed top-6 right-6 z-50">
      <Link href="/sign-in">
        <Button
          size="lg"
          className="glass-effect animate-pulse-glow shadow-2xl hover:shadow-primary/50 transition-all duration-300 group"
        >
          Try Now
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </Link>
    </div>
  )
}
