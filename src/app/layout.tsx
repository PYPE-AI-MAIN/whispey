import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Pype Voice - AI Voice Platform',
  description: 'Voice AI project management platform',
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
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
        >
          <main>
            <SignedOut>
              {/* This ensures auth pages don't show header */}
              <div className="min-h-screen">
                {children}
              </div>
            </SignedOut>
            <SignedIn>
              {children}
            </SignedIn>
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
}