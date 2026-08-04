'use client';

import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { Mic, Sparkles, Shield, Zap } from 'lucide-react';

interface AuthPageProps {
  redirectUrl?: string
}

export default function AuthPage({ redirectUrl }: AuthPageProps) {
  return (
    <div className="h-screen bg-white flex overflow-hidden">
      {/* Left Side - Branding & Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10 flex flex-col justify-center px-16 py-35">
          <div className="max-w-lg">
            {/* Logo */}
            <div className="flex items-center space-x-3 mb-12">
              <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" className="w-14 h-14 flex items-center justify-center">
                <Image src="/logo-dark.png" alt="Pype Logo" width={38} height={38} style={{ objectFit: 'contain' }} />
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '38px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1, fontFamily: '-apple-system, "Segoe UI", sans-serif', alignSelf: 'flex-start', color: '#F3F4F6' }}>
                  Whispey
                </span>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: '-apple-system, "Segoe UI", sans-serif', color: '#8B7BC9' }}>by</span>
                  <img src="/pype-wordmark.png" alt="Pype" style={{ height: '11px', width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            </div>

            {/* Value Proposition */}
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Monitor your LiveKit Voice AI agents.
            </h1>

            <p className="text-slate-300 text-xl mb-12 leading-relaxed">
              Join hundreds of engineers and get complete observability into your Voice AI Applications.
            </p>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Smart Transcription</h3>
                  <p className="text-slate-400 text-base">Real-time voice-to-text with context awareness</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Instant Insights</h3>
                  <p className="text-slate-400 text-base">AI-powered analysis and action items</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Completely Private</h3>
                  <p className="text-slate-400 text-base">Open Source</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication */}
      <div className="flex-1 flex flex-col justify-center px-6 py-16 lg:px-16">
        <div className="w-full max-w-lg mx-auto space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center space-x-3">
              <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border">
                <Image src="/logo-light.png" alt="Pype Logo" width={30} height={30} style={{ objectFit: 'contain' }} />
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '32px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1, fontFamily: '-apple-system, "Segoe UI", sans-serif', alignSelf: 'flex-start', color: '#111827' }}>
                  Whispey
                </span>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, fontFamily: '-apple-system, "Segoe UI", sans-serif', color: '#6D28D9' }}>by</span>
                  <img src="/pype-wordmark.png" alt="Pype" style={{ height: '9px', width: 'auto', objectFit: 'contain' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-bold text-slate-900 mb-3">
              Welcome back
            </h2>
            <p className="text-slate-600 text-lg">
              Sign in to your account to continue
            </p>
          </div>

          {/* Clerk Sign In Component */}
          <div className="mt-8">
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  card: "shadow-none bg-transparent p-0",
                  formButtonPrimary: "bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 px-4 text-base rounded-lg transition-all duration-200 ease-in-out shadow-sm hover:shadow-md",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3.5 px-4 text-base rounded-lg transition-all duration-200 ease-in-out",
                  socialButtonsBlockButtonText: "font-medium",
                  formFieldInput: "border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3.5 px-4 text-base transition-all duration-200 ease-in-out",
                  formFieldLabel: "text-slate-700 font-medium mb-2 text-base",
                  footerActionLink: "text-slate-900 hover:text-slate-700 font-medium",
                  dividerLine: "bg-slate-200",
                  dividerText: "text-slate-500 font-medium",
                  formFieldInputShowPasswordButton: "text-slate-500 hover:text-slate-700",
                  identityPreviewText: "text-slate-600",
                  identityPreviewEditButton: "text-slate-900 hover:text-slate-700"
                },
                layout: {
                  socialButtonsPlacement: "top"
                }
              }}
              redirectUrl={redirectUrl ?? '/projects'}
            />
          </div>

          {/* Trust Indicators */}
          <div className="pt-8 border-t border-slate-200">
            <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Secure</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span>Open Source</span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">
              Protected by industry-leading security standards
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}