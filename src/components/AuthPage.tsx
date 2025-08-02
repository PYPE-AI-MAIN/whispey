'use client';

import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] to-[#e0e7ff] flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        
        {/* Logo & Branding */}
        <div className="text-center">
          <Image 
            src="/pype_ai_logo.jpeg" 
            alt="Pype AI Logo" 
            width={72} 
            height={72} 
            className="mx-auto rounded-xl shadow-sm"
          />
          <h1 className="mt-6 text-3xl font-semibold text-gray-900 tracking-tight">
            Welcome to Pype Voice
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to continue your voice AI journey
          </p>
        </div>

        {/* Clerk Sign In */}
        <SignIn 
          routing="hash"
          appearance={{
            elements: {
              card: "shadow-none bg-white/80 backdrop-blur rounded-lg px-6 py-8",
              formButtonPrimary: "bg-black hover:bg-gray-900 text-white text-sm font-medium transition-all duration-150 ease-in-out",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border border-gray-300 hover:bg-gray-50 text-gray-800",
              formFieldInput: "border-gray-300 focus:ring-black focus:border-black rounded-md",
              footerActionLink: "text-black hover:underline text-sm"
            }
          }}
          redirectUrl="/dashboard"
        />

        {/* Footer */}
        <div className="text-center pt-6">
          <p className="text-xs text-gray-400">
            Secure authentication by <span className="font-medium">Clerk</span>
          </p>
        </div>
      </div>
    </div>
  );
}
