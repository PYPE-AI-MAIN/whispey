// src/app/layout.tsx
import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { PostHogProvider } from './providers'
import './globals.css'
import SidebarWrapper from '@/components/shared/SidebarWrapper'

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
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PostHogProvider>
              <main>
                <SignedOut>
                  <div className="min-h-screen">
                    {children}
                  </div>
                </SignedOut>
                <SignedIn>
                  <SidebarWrapper>
                    {children}
                  </SidebarWrapper>
                </SignedIn>
              </main>
            </PostHogProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  ) 
}