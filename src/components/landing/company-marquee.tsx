"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

// Company data with logo paths
const companies = [
  { name: "Acme Corp", logo: "/logos/acme-corp.png" },
  { name: "BuilderAI", logo: "/logos/builderai.png" },
  { name: "VoiceFlow", logo: "/logos/voiceflow.png" },
  { name: "TechStart", logo: "/logos/techstart.png" },
  { name: "Conversational", logo: "/logos/conversational.png" },
  { name: "SpeakEasy", logo: "/logos/speakeasy.png" },
  { name: "ChatFlow", logo: "/logos/chatflow.png" },
  { name: "VoxLab", logo: "/logos/voxlab.png" }
]

export function CompanyMarquee() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <section className="py-12 border-t border-border/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground">
            Trusted by teams worldwide
          </p>
        </div>

        <div className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
          
          <div className="flex overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap items-center">
              {[...companies, ...companies].map((company, index) => (
                <div
                  key={`${company.name}-${index}`}
                  className="mx-12 flex items-center justify-center h-12"
                >
                  <Image
                    src={company.logo}
                    alt={`${company.name} logo`}
                    width={120}
                    height={40}
                    className="object-contain max-h-8 opacity-40 hover:opacity-60 transition-opacity duration-300 grayscale"
                    onError={(e) => {
                      // Fallback to company name if image fails
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `<span class="text-sm font-medium text-muted-foreground/70">${company.name}</span>`
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </section>
  )
}