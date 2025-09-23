// src/app/layout.tsx
import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import Script from 'next/script'
import { PostHogProvider } from './providers'
import { FeatureAccessProvider } from './providers/FeatureAccessProvider'
import { QueryProvider } from './providers/QueryProvider'
import './globals.css'
import SidebarWrapper from '@/components/shared/SidebarWrapper'
import FeedbackWidget from '@/components/feedback/FeedbackWidget'
import SignOutHandler from '@/components/auth'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Whispey - OSS LiveKit observability platform',
  description: 'An observability platform for all your agents built on LiveKit.',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sonicLinkerOrgId = process.env.NEXT_PUBLIC_SONIC_LINKER_ORG_ID

  return (
    <ClerkProvider
      signInUrl='/sign-in'
      appearance={{
        variables: {
          colorPrimary: "#2563eb", // Blue-600
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {/* Sonic Linker AI Traffic Monitoring - Only loads if org ID is provided */}
          {sonicLinkerOrgId && (
            <Script
              src={`https://anlt.soniclinker.com/collect.js?org_id=${sonicLinkerOrgId}`}
              strategy="afterInteractive"
              async
            />
          )}

          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <PostHogProvider>
                <FeatureAccessProvider>
                  <main>
                    <SignedOut>
                      <div className="min-h-screen">
                        {children}
                      </div>
                    </SignedOut>
                    <SignedIn>
                      <SignOutHandler>
                        <SidebarWrapper>
                          {children}
                        </SidebarWrapper>
                        <FeedbackWidget />
                      </SignOutHandler>
                    </SignedIn>
                  </main>
                </FeatureAccessProvider>
              </PostHogProvider>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  ) 
}