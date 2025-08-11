"use client"

import React from 'react'
import Link from 'next/link'
import { 
  Shield, 
  Info, 
  Users, 
  Database, 
  Warning, 
  Scales,
  Lock,
  Envelope,
  ArrowLeft,
  CheckCircle,
  Phone,
  ChartBar
} from 'phosphor-react'

export default function TermsOfService() {
  const effectiveDate = "January 01, 2025"
  const lastUpdated = "January 01, 2025"

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors group"
            >
              <ArrowLeft weight="regular" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Link>
            <div className="text-sm text-gray-500">
              Last Updated: {lastUpdated}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <Shield weight="regular" className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Terms of Service</h1>
              <p className="text-gray-600 mt-2">
                Please read these terms carefully before using Whispey's hosted service
              </p>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-lg border border-green-200">
                  Effective: {effectiveDate}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          
          {/* Introduction */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Info weight="regular" className="w-5 h-5 text-gray-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Welcome to Whispey</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-gray-700 leading-relaxed">
              <p>
                These Terms of Service ("Terms") govern your use of Whispey's hosted voice AI agents 
                observability platform ("Service"). Whispey helps you monitor, analyze, and optimize 
                your voice AI agents built with LiveKit, providing detailed analytics on performance, 
                costs, and latency metrics. By accessing or using our Service, you agree to be bound 
                by these Terms and our Privacy Policy.
              </p>
              <p>
                Whispey is developed by Pype AI (Singularity Corp Pvt Ltd, India) and is available as 
                open-source software. This hosted version is provided for convenience and testing. 
                You can self-host Whispey at no cost using your existing Vercel and Supabase accounts.
                We are working on further simplifying the setup by making it run completely on AWS.
              </p>
            </div>
          </div>

          {/* 1. Account & Access */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Users weight="regular" className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">1. Account & Access</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Account Responsibility</p>
                    <p className="text-gray-600 text-sm">
                      You're responsible for maintaining the security of your account credentials and all activities 
                      under your account. Use strong passwords and enable two-factor authentication when available.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Age Requirement</p>
                    <p className="text-gray-600 text-sm">
                      You must be at least 18 years old or have legal capacity to enter into binding contracts 
                      in your jurisdiction to use the Service.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle weight="fill" className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 mb-1">Accurate Information</p>
                    <p className="text-gray-600 text-sm">
                      You agree to provide accurate, current, and complete information during registration 
                      and keep your profile information updated.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Acceptable Use */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle weight="regular" className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">2. Acceptable Use Policy</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 mb-4">
                You agree to use Whispey only for lawful purposes and in accordance with these Terms. 
                Specifically, you agree NOT to:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <p className="font-medium text-red-900 mb-2">Prohibited Activities:</p>
                <ul className="space-y-2 text-sm text-red-800">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Process or transmit any content that is illegal, harmful, threatening, abusive, or violates any laws
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Violate privacy rights or process personal data without proper consent and legal basis
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Attempt to gain unauthorized access to our systems or other users' accounts
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Overload our infrastructure with excessive requests or automated abuse
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Use the Service for cryptocurrency mining, botnets, or other resource-intensive unauthorized activities
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    Reverse engineer, decompile, or attempt to extract source code from our proprietary systems
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Voice AI Agent Specific Terms - NEW SECTION */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Phone weight="regular" className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">3. Voice AI Agent Specific Terms</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">Campaign Management</p>
                  <p className="text-gray-600 text-sm">
                    When using Whispey to manage phone calling campaigns, you are responsible for 
                    compliance with all applicable telecommunications laws, including TCPA (US), 
                    GDPR (EU), and local regulations regarding automated calling. You must ensure 
                    proper consent is obtained before initiating any automated voice calls.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Cost Transparency</p>
                  <p className="text-gray-600 text-sm">
                    Whispey provides cost analytics for your voice AI operations, breaking down costs 
                    for STT (Speech-to-Text), VAD (Voice Activity Detection), LLM (Language Model), 
                    and TTS (Text-to-Speech) services. These are estimates based on your providers' 
                    pricing. Actual costs from your LiveKit and AI service providers may vary.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Performance Metrics</p>
                  <p className="text-gray-600 text-sm">
                    Latency and performance metrics (including TTFT - Time To First Token) are provided 
                    for optimization purposes. Network conditions and third-party service performance 
                    may affect actual results. Use these metrics as guidance for improving your voice 
                    AI agent performance.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Pipeline Analytics</p>
                  <p className="text-gray-600 text-sm">
                    Whispey analyzes each step in your LiveKit pipeline to help identify optimization 
                    opportunities. You are responsible for implementing any optimizations and ensuring 
                    they comply with your service requirements.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Data Processing */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                  <Database weight="regular" className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">4. Data Processing & Ownership</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900 mb-2">Your Data</p>
                  <p className="text-gray-600 text-sm">
                    You retain all rights to your data. By using the Service, you grant us a limited license to process 
                    your data solely to provide the Service to you. This includes audio streams, transcriptions, metadata, 
                    call analytics, and performance metrics necessary for voice AI agent observability.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Data Responsibilities</p>
                  <p className="text-gray-600 text-sm">
                    You're responsible for ensuring you have all necessary rights, consents, and legal basis to process 
                    any data through our Service, especially personal data under GDPR, CCPA, or other privacy regulations.
                    This includes obtaining proper consent for recording and analyzing voice calls.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Service Improvements</p>
                  <p className="text-gray-600 text-sm">
                    We may use aggregated, anonymized usage statistics to improve the Service. This data cannot be 
                    traced back to individual users or organizations.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-2">Self-Hosting Option</p>
                  <p className="text-gray-600 text-sm">
                    When self-hosting Whispey, you have complete control over your data. The open-source version 
                    allows you to maintain full data sovereignty within your own infrastructure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Service Limitations */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
                  <Warning weight="regular" className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">5. Service Limitations & Disclaimers</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-medium text-yellow-900 mb-2">Important Notice:</p>
                <p className="text-yellow-800 text-sm">
                  The Service is provided "AS IS" without warranties of any kind, either express or implied. 
                  We do not guarantee uninterrupted, secure, or error-free operation of the Service.
                </p>
              </div>
              <div className="space-y-3 text-gray-600 text-sm">
                <p>
                  <span className="font-medium text-gray-900">Uptime:</span> While we strive for high availability, 
                  we don't guarantee any specific uptime SLA for the free hosted version.
                </p>
                <p>
                  <span className="font-medium text-gray-900">Data Loss:</span> We implement reasonable backups but 
                  cannot guarantee against all forms of data loss. Maintain your own backups for critical data.
                </p>
                <p>
                  <span className="font-medium text-gray-900">Third-Party Services:</span> Our Service integrates with 
                  LiveKit and other third-party services. We're not responsible for their availability or performance.
                </p>
                <p>
                  <span className="font-medium text-gray-900">Analytics Accuracy:</span> Cost and performance metrics 
                  are estimates based on available data. Actual costs and performance may vary.
                </p>
              </div>
            </div>
          </div>

          {/* 6. Liability */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                  <Scales weight="regular" className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">6. Limitation of Liability</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-gray-700">
              <p className="text-sm">
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including loss of profits, data, use, or goodwill, 
                arising from your use of the Service.
              </p>
              <p className="text-sm">
                Our total liability for any claims related to the Service shall not exceed the amount you've 
                paid us in the twelve months preceding the claim, or $100 USD if you haven't paid us anything.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900">
                  Some jurisdictions don't allow limitation of certain damages, so these limitations may not 
                  apply to you.
                </p>
              </div>
            </div>
          </div>

          {/* 7. Changes & Termination */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <Lock weight="regular" className="w-5 h-5 text-gray-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">7. Changes & Termination</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-gray-700">
              <div>
                <p className="font-medium text-gray-900 mb-2">Service Changes</p>
                <p className="text-sm">
                  We may modify, suspend, or discontinue any part of the Service at any time. We'll provide 
                  reasonable notice for significant changes when possible.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">Terms Updates</p>
                <p className="text-sm">
                  We may update these Terms from time to time. We'll notify you of material changes via email 
                  or through the Service. Continued use after changes means acceptance.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-2">Termination</p>
                <p className="text-sm">
                  Either party may terminate this agreement at any time. We may suspend or terminate access 
                  immediately for Terms violations. You can delete your account at any time through your settings.
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Envelope weight="regular" className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Questions?</h2>
              </div>
              <p className="text-gray-700 mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Singularity Corp Pvt Ltd (Pype AI)</p>
                <a 
                  href="mailto:dhruv@pypeai.com" 
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  dhruv@pypeai.com
                </a>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-6 py-8 text-sm">
            <Link href="/privacy" className="text-gray-600 hover:text-blue-600 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-300">•</span>
            <a 
              href="https://github.com/PYPE-AI-MAIN/whispey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Open Source (GitHub)
            </a>
            <span className="text-gray-300">•</span>
            <Link href="/docs" className="text-gray-600 hover:text-blue-600 transition-colors">
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}