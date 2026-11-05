"use client"

import React from 'react'
import Link from 'next/link'
import { 
  LockKey,
  Eye,
  Database,
  Shield,
  Clock,
  Globe,
  Check,
  Cookie,
  Envelope,
  ArrowLeft,
  Info,
  CheckCircle,
  MapPin,
  Share,
  Phone,
  ChartBar
} from 'phosphor-react'

export default function PrivacyPolicy() {
  const effectiveDate = "January 15, 2025"
  const lastUpdated = "January 15, 2025"

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
            >
              <ArrowLeft weight="regular" className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Link>
            <div className="text-sm text-muted-foreground">
              Last Updated: {lastUpdated}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-success/10 rounded-xl border border-success/20">
              <LockKey weight="regular" className="w-8 h-8 text-success" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
              <p className="text-muted-foreground mt-2">
                Your privacy is important to us. This policy explains how we handle your data.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-lg border border-success/30">
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
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted/50 rounded-lg border border-border">
                  <Info weight="regular" className="w-5 h-5 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Our Privacy Commitment</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-foreground leading-relaxed">
              <p>
                At Whispey (developed by Singularity Corp Pvt Ltd - Pype AI), we believe in transparency 
                and putting you in control of your data. This Privacy Policy explains what information we 
                collect when you use our voice AI agents observability platform, why we collect it, and 
                how we protect it.
              </p>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm font-medium text-primary mb-2">Key Principles:</p>
                <ul className="space-y-1 text-sm text-primary">
                  <li className="flex items-center gap-2">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
                    We never sell your data
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
                    We collect only what's necessary to provide the service
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
                    You can request data deletion at any time
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
                    We use industry-standard security measures
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle weight="fill" className="w-4 h-4 text-primary" />
                    Self-hosting option gives you complete data control
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 1. Information We Collect */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                  <Eye weight="regular" className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Account Information */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Check weight="regular" className="w-5 h-5 text-muted-foreground" />
                  Account Information
                </h3>
                <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                  <p>When you sign up through Clerk authentication, we collect:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Email address</li>
                    <li>• Name (if provided)</li>
                    <li>• Authentication tokens</li>
                    <li>• Profile picture (if provided)</li>
                  </ul>
                </div>
              </div>

              {/* Voice AI Agent Analytics Data */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Phone weight="regular" className="w-5 h-5 text-purple-600" />
                  Voice AI Agent Analytics Data
                </h3>
                <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                  <p>To provide observability for your voice AI agents, we process:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Call audio streams and transcriptions (temporarily)</li>
                    <li>• Call metadata (duration, timestamps, participant info)</li>
                    <li>• Performance metrics (TTFT - Time To First Token, latency per pipeline step)</li>
                    <li>• Cost breakdown per call (STT, VAD, LLM, TTS costs)</li>
                    <li>• Pipeline latency analysis (STT, VAD, LLM, TTS timing)</li>
                    <li>• Campaign management data</li>
                    <li>• Error logs and debugging information</li>
                    <li>• Custom metadata you choose to send</li>
                  </ul>
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mt-3">
                    <p className="text-xs font-medium text-warning">
                      Note: Audio content is processed in real-time for analytics purposes and is not 
                      permanently stored unless you explicitly enable recording features.
                    </p>
                  </div>
                </div>
              </div>

              {/* Technical Information */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Globe weight="regular" className="w-5 h-5 text-success" />
                  Technical Information
                </h3>
                <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                  <p>We automatically collect certain technical data:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• IP address (for security and rate limiting)</li>
                    <li>• Browser type and version</li>
                    <li>• Device information</li>
                    <li>• API usage patterns</li>
                    <li>• Error reports and crash logs</li>
                  </ul>
                </div>
              </div>

              {/* Analytics Insights */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ChartBar weight="regular" className="w-5 h-5 text-indigo-600" />
                  Analytics Insights
                </h3>
                <div className="ml-7 space-y-2 text-sm text-muted-foreground">
                  <p>We help engineering teams understand:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Where optimization is needed in the voice AI pipeline</li>
                    <li>• Cost per conversation breakdown</li>
                    <li>• Performance bottlenecks</li>
                    <li>• Campaign effectiveness metrics</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 2. How We Use Your Information */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg border border-success/20">
                  <Shield weight="regular" className="w-5 h-5 text-success" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground mb-4">We use your information only for legitimate purposes:</p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Service Delivery</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Process and analyze your voice AI agent calls, generate cost analytics, provide 
                      performance insights, and help identify optimization opportunities in your LiveKit pipeline
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Campaign Management</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Help engineering teams run and manage phone calling campaigns effectively with 
                      detailed analytics and performance metrics
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Security & Reliability</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Detect and prevent fraud, abuse, and security threats. Monitor system performance and uptime.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Product Improvement</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Analyze aggregated, anonymized usage patterns to improve features and user experience
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Communication</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Send service updates, security alerts, and respond to support requests (no marketing spam!)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-success/15 rounded-lg mt-0.5">
                    <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Legal Compliance</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Comply with legal obligations and respond to valid legal requests
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Data Retention */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg border border-warning/20">
                  <Clock weight="regular" className="w-5 h-5 text-warning" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">3. Data Retention</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">Our data retention policies are designed to balance service functionality with privacy:</p>
              
              <div className="space-y-3">
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Real-time Audio Streams</p>
                    <span className="px-2 py-1 bg-success/15 text-success text-xs font-medium rounded">Not stored</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Processed in memory only for real-time analytics, never persisted to disk</p>
                </div>

                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Call Transcriptions</p>
                    <span className="px-2 py-1 bg-primary/15 text-primary text-xs font-medium rounded">30 days</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Automatically deleted after 30 days unless you request earlier deletion</p>
                </div>

                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Analytics & Metrics</p>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">90 days</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Aggregated metrics retained for trend analysis and optimization insights</p>
                </div>

                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Cost Analytics</p>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">90 days</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Cost breakdowns for STT, VAD, LLM, and TTS retained for billing analysis</p>
                </div>

                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground">Account Information</p>
                    <span className="px-2 py-1 bg-muted text-foreground text-xs font-medium rounded">Until deletion</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Retained until you delete your account</p>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-primary">
                  <strong>Data Deletion:</strong> You can request immediate deletion of your data at any time through 
                  your account settings or by contacting support. For self-hosted instances, you have complete 
                  control over data retention policies.
                </p>
              </div>
            </div>
          </div>

          {/* 4. Data Sharing */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                  <Share weight="regular" className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">4. Data Sharing & Third Parties</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4 mb-4">
                <p className="text-success font-medium">
                   We NEVER sell, rent, or trade your personal data
                </p>
              </div>

              <p className="text-foreground mb-4">We share data only in these limited circumstances:</p>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-foreground mb-2">Service Providers</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    We work with trusted third-party services to operate Whispey:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                    <li>• <strong>Clerk:</strong> Authentication and user management</li>
                    <li>• <strong>Vercel:</strong> Hosting and edge infrastructure</li>
                    <li>• <strong>Supabase:</strong> Database and real-time subscriptions</li>
                    <li>• <strong>LiveKit:</strong> Voice communication infrastructure that your agents use</li>
                    <li>• <strong>AWS:</strong> Future deployment option (coming soon)</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    All providers are bound by strict data protection agreements. When self-hosting, 
                    you control which services to use.
                  </p>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">Legal Requirements</p>
                  <p className="text-sm text-muted-foreground">
                    We may disclose information if required by law, court order, or government regulation, 
                    but only after exhausting legal options to protect your privacy.
                  </p>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">With Your Consent</p>
                  <p className="text-sm text-muted-foreground">
                    We'll share data with other parties only with your explicit, informed consent.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Security */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                  <Shield weight="regular" className="w-5 h-5 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">5. Security Measures</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">We implement industry-standard security measures to protect your data:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Encryption in transit (TLS 1.3)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Encryption at rest (AES-256)</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Regular security audits</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Access controls & monitoring</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Regular backups</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle weight="fill" className="w-4 h-4 text-success" />
                  <span>Incident response procedures</span>
                </div>
              </div>

              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <p className="text-sm text-warning">
                  <strong>Security Incidents:</strong> In the unlikely event of a data breach, we'll notify affected 
                  users within 72 hours and provide guidance on protective measures.
                </p>
              </div>
            </div>
          </div>

          {/* 6. Your Rights */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                  <Check weight="regular" className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">6. Your Privacy Rights</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">You have full control over your personal data:</p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/15 rounded-lg mt-0.5">
                    <Eye weight="bold" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Right to Access</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Request a copy of all personal data we hold about you
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/15 rounded-lg mt-0.5">
                    <Shield weight="bold" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Right to Correction</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Update or correct any inaccurate personal information
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/15 rounded-lg mt-0.5">
                    <Database weight="bold" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Right to Deletion</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Request complete deletion of your account and associated data
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/15 rounded-lg mt-0.5">
                    <Share weight="bold" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Right to Portability</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Export your data in a machine-readable format. Perfect for migrating to self-hosted instances.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/15 rounded-lg mt-0.5">
                    <Globe weight="bold" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Right to Object</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Opt-out of certain data processing activities
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-primary">
                  <strong>Exercise Your Rights:</strong> Contact us at privacy@pypeai.com to exercise any of these 
                  rights. We'll respond within 30 days.
                </p>
              </div>
            </div>
          </div>

          {/* 7. Cookies */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg border border-warning/20">
                  <Cookie weight="regular" className="w-5 h-5 text-warning" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">7. Cookies & Tracking</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-foreground">We use minimal cookies necessary for the service to function:</p>
              
              <div className="space-y-3">
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <p className="font-medium text-foreground mb-2">Essential Cookies</p>
                  <p className="text-sm text-muted-foreground">
                    Required for authentication, security, and maintaining your session
                  </p>
                </div>

                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <p className="font-medium text-foreground mb-2">Preference Cookies</p>
                  <p className="text-sm text-muted-foreground">
                    Remember your settings like theme preference and dashboard layout
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                We do NOT use third-party tracking cookies, advertising cookies, or social media pixels. 
                Your browsing habits are not tracked across other websites.
              </p>
            </div>
          </div>

          {/* 8. International Data */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <MapPin weight="regular" className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">8. International Data Transfers</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-foreground">
              <p>
                Our servers are located in multiple regions to provide low-latency service globally. 
                When you use Whispey, your data may be transferred to and processed in countries 
                other than your own.
              </p>
              <p className="text-sm">
                We ensure all international transfers comply with applicable data protection laws, 
                including GDPR requirements for transfers outside the European Economic Area.
              </p>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm text-indigo-900">
                  <strong>Data Residency:</strong> Enterprise customers can request specific data residency 
                  requirements. Self-hosted instances give you complete control over data location. 
                  Contact us for more information.
                </p>
              </div>
            </div>
          </div>

          {/* 9. Children's Privacy */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-50 rounded-lg border border-pink-100">
                  <Check weight="regular" className="w-5 h-5 text-pink-600" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">9. Children's Privacy</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-foreground">
              <p>
                Whispey is not intended for use by children under 18 years of age. We do not knowingly 
                collect personal information from children. If we discover we've inadvertently collected 
                data from a child, we'll delete it immediately.
              </p>
              <p className="text-sm">
                If you believe a child has provided us with personal information, please contact us at 
                privacy@pypeai.com.
              </p>
            </div>
          </div>

          {/* 10. Updates */}
          <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted/50 rounded-lg border border-border">
                  <Clock weight="regular" className="w-5 h-5 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">10. Policy Updates</h2>
              </div>
            </div>
            <div className="p-6 space-y-4 text-foreground">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices 
                or legal requirements. We'll notify you of material changes via:
              </p>
              <ul className="space-y-1 text-sm ml-4">
                <li>• Email notification to your registered address</li>
                <li>• Prominent notice in the Whispey dashboard</li>
                <li>• Update to the "Last Updated" date at the top of this policy</li>
              </ul>
              <p className="text-sm">
                Continued use of Whispey after changes means you accept the updated policy.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-card rounded-xl border border-border shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                  <Envelope weight="regular" className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
              </div>
              <p className="text-foreground mb-4">
                Questions about your privacy? We're here to help:
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Company</p>
                  <p className="text-sm text-muted-foreground">Singularity Corp Pvt Ltd (Pype AI)</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Privacy Team</p>
                  <a 
                    href="mailto:dhruv@pypeai.com" 
                    className="text-primary hover:text-primary font-medium"
                  >
                    dhruv@pypeai.com
                  </a>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Data Protection Officer</p>
                  <a 
                    href="mailto:ashish@pypeai.com" 
                    className="text-primary hover:text-primary font-medium"
                  >
                    ashish@pypeai.com
                  </a>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Response time: Within 48 hours for general inquiries, 
                    30 days for formal data requests
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="flex items-center justify-center gap-6 py-8 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-300">•</span>
            <a
              href="https://github.com/PYPE-AI-MAIN/whispey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Open Source (GitHub)
            </a>
            <span className="text-gray-300">•</span>
            <Link href="/docs" className="text-muted-foreground hover:text-primary transition-colors">
              Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}