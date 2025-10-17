import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import Script from 'next/script'
import { Toaster } from 'react-hot-toast' // ADD THIS LINE
import { PostHogProvider } from './providers'
import { FeatureAccessProvider } from './providers/FeatureAccessProvider'
import { QueryProvider } from './providers/QueryProvider'
import './globals.css'
import LayoutContent from './LayoutContent'

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
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
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
                  <Toaster 
                    position="top-right"
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: '#fff',
                        color: '#363636',
                        border: '1px solid #e5e7eb',
                      },
                      className: 'dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700',
                      success: {
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />
                  <LayoutContent>
                    {children}
                  </LayoutContent>
                </FeatureAccessProvider>
              </PostHogProvider>
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  ) 
}