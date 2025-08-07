'use client';

import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { Mic, Sparkles, Shield, Zap } from 'lucide-react';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Branding & Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fillRule='evenodd'%3E%3Cg fill='%23ffffff' fillOpacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 py-16">
          <div className="max-w-md">
            {/* Logo */}
            <div className="flex items-center space-x-3 mb-12">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <Image src="/logo.png" alt="Pype AI Logo" width={100} height={100} />
              </div>
              <span className="text-2xl font-bold text-white">Whispey</span>
            </div>

            {/* Value Proposition */}
            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
              Monitor your LiveKit Voice AI agents.
            </h1>
            
            <p className="text-slate-300 text-lg mb-12 leading-relaxed">
              Join hundereds of engineers and get complete observability into your Voice AI Applications.
            </p>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Smart Transcription</h3>
                  <p className="text-slate-400 text-sm">Real-time voice-to-text with context awareness</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Instant Insights</h3>
                  <p className="text-slate-400 text-sm">AI-powered analysis and action items</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Completely Private</h3>
                  <p className="text-slate-400 text-sm">Open Source</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Authentication */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="inline-flex items-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">Whispey</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back
            </h2>
            <p className="text-slate-600">
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
                  formButtonPrimary: "bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 ease-in-out shadow-sm hover:shadow-md",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-lg transition-all duration-200 ease-in-out",
                  socialButtonsBlockButtonText: "font-medium",
                  formFieldInput: "border-2 border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 rounded-lg py-3 px-4 transition-all duration-200 ease-in-out",
                  formFieldLabel: "text-slate-700 font-medium mb-2",
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
              redirectUrl="/dashboard"
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
                <span>SOC 2 Compliant</span>
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
