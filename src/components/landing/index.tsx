"use client"

import Link from "next/link"
import { ArrowRight, Play, BarChart3, Zap, Shield, Clock, Code, Mic, Activity, Github, Star, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { CompanyMarquee } from "@/components/landing/company-marquee"
// import { PricingSection } from "@/components/landing/pricing-section"
import { ContainerScroll } from "@/components/ui/container-scroll-animation"
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient"
import { FlipWords } from "@/components/ui/flip-words"

import { cn } from "@/lib/utils"
import Image from "next/image"
import { motion } from "motion/react"
import React from "react"
import { useState, useEffect } from "react"
import Header from "./landing-header"

export default function LandingPage() {
  // FlipWords for the hero heading  
  const words = [
    { text: "precision", className: "text-purple-500 dark:text-purple-400" },
    { text: "confidence", className: "text-emerald-500 dark:text-emerald-400" },
    { text: "clarity", className: "text-orange-500 dark:text-orange-400" },
    { text: "intelligence", className: "text-cyan-500 dark:text-cyan-400" },
    { text: "Whispey", className: "text-blue-500 dark:text-blue-400" }
  ];

  return (
    <>
      {/* Page-specific font loading - Cabinet Grotesk */}
      <style jsx global>{`
        @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700,800&display=swap');
        
        .whispey-landing-font {
          font-family: 'Cabinet Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
      `}</style>

      <div className="min-h-screen bg-background whispey-landing-font">

        {/* Enhanced Header */}
        <Header />

        {/* Hero Section with Grid Background */}
        <section className="relative flex flex-col overflow-hidden">
          {/* Grid Background */}
          <div className="absolute inset-0">
            <div
              className={cn(
                "absolute inset-0",
                "[background-size:40px_40px]",
                "[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
                "dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
              )}
            />
            {/* Radial gradient for faded look */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black"></div>
          </div>

          <div className="relative z-10">
            <ContainerScroll
              titleComponent={
                <div className="text-center">
                  {/* Badge with Light Effect */}
                  <div className="relative mb-8 flex justify-center">
                    {/* Light effects */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 0.6, scale: 1 }}
                        transition={{
                          delay: 0.3,
                          duration: 0.8,
                          ease: "easeInOut",
                        }}
                        className="absolute h-32 w-64 bg-cyan-500/20 rounded-full blur-3xl"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 0.8, scale: 1 }}
                        transition={{
                          delay: 0.4,
                          duration: 0.8,
                          ease: "easeInOut",
                        }}
                        className="absolute h-16 w-32 bg-cyan-400/30 rounded-full blur-2xl"
                      />
                    </div>
                    
                    {/* The actual badge */}
                    <motion.div
                      initial={{ opacity: 0.5, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.3,
                        duration: 0.8,
                        ease: "easeInOut",
                      }}
                      className="relative z-10 inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border border-primary/20"
                    >
                      <Activity className="w-4 h-4" />
                      <span>Voice AI Observability Platform</span>
                    </motion.div>
                  </div>

                  {/* Hero Heading with FlipWords Effect - Enhanced with new font */}
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-balance mb-8 leading-tight tracking-tight">
                    Monitor your <span className="gradient-text">LiveKit Voice AI</span> agents with
                    <span className="inline-block min-w-[280px] text-left">
                      <FlipWords words={words} className="text-blue-500 dark:text-blue-400" />
                    </span>
                  </h1>

                  <p className="text-xl text-muted-foreground text-balance max-w-3xl mx-auto mb-12 leading-relaxed">
                    Get complete observability into your Voice AI applications. Track performance, debug issues, and optimize
                    your conversational AI with real-time insights and analytics.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                    <Link href="/sign-in">
                      <Button size="lg" className="text-lg px-8 py-6 group font-medium">
                        Start Monitoring Free
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="text-lg px-8 py-6 group bg-transparent font-medium"
                      onClick={() => window.open('https://youtu.be/1POj8h99xnE', '_blank', 'noopener,noreferrer')}
                    >
                      <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                      Watch Demo
                    </Button>
                  </div>
                </div>
              }
            >
              <Image
                src="/hero-banner-whispey.png"
                alt="Whispey Dashboard - Voice AI Observability Platform"
                height={720}
                width={1400}
                className="mx-auto rounded-2xl object-cover h-full object-top shadow-2xl"
                draggable={false}
              />
            </ContainerScroll>
          </div>
        </section>

        {/* Company Marquee */}
        {/* <CompanyMarquee /> */}

        {/* Features Section */}
        <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-balance mb-4 tracking-tight">Everything you need for Voice AI observability</h2>
              <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
                Comprehensive monitoring, debugging, and optimization tools for your LiveKit voice agents
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: BarChart3,
                  title: "Real-time Analytics",
                  description:
                    "Monitor latency, TTFT, and pipeline performance with detailed metrics and visualizations.",
                },
                {
                  icon: Activity,
                  title: "Session Tracking",
                  description: "Track every voice session with complete conversation flows and interaction patterns.",
                },
                {
                  icon: Shield,
                  title: "Bug Report",
                  description: "Seamlessly report bugs with your voice, using custom commands when you test your agents.",
                },
                {
                  icon: Clock,
                  title: "Performance Insights",
                  description: "Deep insights into response times, processing delays, and optimization opportunities.",
                },
                {
                  icon: Code,
                  title: "Easy Integration", 
                  description: "Simple 3-line integration with your existing LiveKit agents. No complex setup required.",
                },
                {
                  icon: Zap,
                  title: "Lightning Fast",
                  description: "Minimal overhead monitoring that won't slow down your voice AI applications.",
                },
              ].map((feature, index) => {
                const Icon = feature.icon
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <HoverBorderGradient
                      containerClassName="rounded-2xl w-full"
                      as="div"
                      className="bg-background border-border/50 hover:border-primary/50 transition-colors group p-0"
                    >
                      <Card className="border-0 shadow-none bg-transparent">
                        <CardHeader>
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                        </CardContent>
                      </Card>
                    </HoverBorderGradient>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-balance mb-4 tracking-tight">Get started in 3 simple steps</h2>
              <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
                Start monitoring your voice AI agents in minutes, not hours
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Install Whispey",
                  description: "Add our lightweight SDK to your project with a single pip install command.",
                  code: "pip install whispey",
                },
                {
                  step: "02",
                  title: "Initialize Monitoring",
                  description: "Create a Whispey instance with your API key and agent ID.",
                  code: `whispey = LivekitObserve(
  agent_id="your-agent-id",
  apikey=os.getenv("WHISPEY_API_KEY")
)`,
                },
                {
                  step: "03",
                  title: "Start Tracking",
                  description: "Begin monitoring your LiveKit sessions with one line of code.",
                  code: `session_id = whispey.start_session(
  session=session
)`,
                },
              ].map((step, index) => (
                <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
                  <CardHeader>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="relative w-12 h-12 rounded-xl group/step cursor-pointer">
                        {/* Animated gradient border on hover */}
                        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-0 group-hover/step:opacity-100 blur-md transition-all duration-500"></div>
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-0 group-hover/step:opacity-30 transition-opacity duration-500"></div>
                        {/* Step number */}
                        <div className="relative w-full h-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center rounded-xl transition-all duration-300 group-hover/step:scale-110">
                          {step.step}
                        </div>
                      </div>
                      <CardTitle className="text-xl font-semibold">{step.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base mb-6 leading-relaxed">{step.description}</CardDescription>
                    <div className="bg-muted rounded-lg p-4">
                      <code className="text-sm font-mono text-foreground">{step.code}</code>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link href="/sign-in">
                <Button size="lg" className="text-lg px-8 py-6 font-medium">
                  Start Your Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        {/* <section id="pricing">
          <PricingSection />
        </section> */}

        {/* CTA Section */}
        {/* <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-balance mb-6 tracking-tight">Ready to optimize your Voice AI?</h2>
            <p className="text-xl text-muted-foreground text-balance mb-8 max-w-2xl mx-auto">
              Join hundreds of developers who trust Whispey to monitor and optimize their LiveKit voice agents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-in">
                <Button size="lg" className="text-lg px-8 py-6 group font-medium">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 bg-transparent font-medium">
                Schedule Demo
              </Button>
            </div>
          </div>
        </section> */}

        {/* Footer */}
        <footer className="border-t border-border/50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="col-span-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} />
                  </div>
                  <span className="text-xl font-bold gradient-text tracking-tight">Whispey</span>
                </div>
                <p className="text-sm text-muted-foreground">Voice AI observability platform for LiveKit agents.</p>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Product</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="#features" className="hover:text-foreground transition-colors">
                      Features
                    </Link>
                  </li>
                  {/* <li>
                    <Link href="#pricing" className="hover:text-foreground transition-colors">
                      Pricing
                    </Link>
                  </li> */}
                  <li>
                    <Link 
                      href="/docs" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors"
                    >
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link href="/api" className="hover:text-foreground transition-colors">
                      API Reference
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/about" className="hover:text-foreground transition-colors">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="https://pypeai.com/blog" target="_blank" className="hover:text-foreground transition-colors">
                      Blog
                    </Link>
                  </li>
                  {/* <li>
                    <Link href="https://pypeai.com/contact" target="_blank" className="hover:text-foreground transition-colors">
                      Contact
                    </Link>
                  </li> */}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Support</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/help" className="hover:text-foreground transition-colors">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="/community" className="hover:text-foreground transition-colors">
                      Community
                    </Link>
                  </li>
                  <li>
                    <Link href="/status" className="hover:text-foreground transition-colors">
                      Status
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-foreground transition-colors">
                      Privacy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border/50 mt-12 pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; 2025 Whispey. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}