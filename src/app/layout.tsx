import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import Script from 'next/script'
import { BRAND_INIT } from '@/lib/brandTheme'
import { Toaster } from 'react-hot-toast' // ADD THIS LINE
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

// Pype's brand type: Plus Jakarta Sans for headings, Satoshi for text (the same pair as pypeai.com).
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
})

const satoshi = localFont({
  src: './fonts/Satoshi-Variable.woff2',
  variable: '--font-satoshi',
  weight: '300 900',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Whispey by Pype AI',
  description: "Pype AI's workspace for building voice agents and reviewing every patient call.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-light.ico', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.ico', media: '(prefers-color-scheme: dark)' },
    ],
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
          colorPrimary: "#4b0082",
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: BRAND_INIT }} />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} ${satoshi.variable} antialiased`}
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
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <QueryProvider>
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
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  ) 
}