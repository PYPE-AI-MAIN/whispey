'use client'

import { ArrowRight, ExternalLink, Github, Star, Users } from 'lucide-react';
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { Button } from '../ui/button';
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

function Header() {
    const { isSignedIn, isLoaded } = useUser()
    const router = useRouter()

    // GitHub Stars Hook with better error handling
    function useGitHubStars(owner: string, repo: string) {
      const [stars, setStars] = useState<number | null>(null);
      const [loading, setLoading] = useState(true);
      const [mounted, setMounted] = useState(false);
    
      useEffect(() => {
        setMounted(true);
      }, []);
    
      useEffect(() => {
        if (!mounted) return;
    
        async function fetchStars() {
          try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/stargazers`);
            if (response.ok) {
              const data = await response.json();
              setStars(data.stargazers_count);
            }
          } catch (error) {
            console.error('Failed to fetch GitHub stars:', error);
          } finally {
            setLoading(false);
          }
        }
    
        fetchStars();
      }, [owner, repo, mounted]);
    
      return { stars, loading: !mounted || loading };
    }
    
    // GitHub Stars Component
    function GitHubStarsButton() {
      const { stars, loading } = useGitHubStars('PYPE-AI-MAIN', 'whispey');
    
      const formatStars = (count: number) => {
        if (count >= 1000) {
          return `${(count / 1000).toFixed(1)}k`;
        }
        return count.toString();
      };
    
      return (
        <Link
          href="https://github.com/PYPE-AI-MAIN/whispey"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 rounded-lg hover:bg-accent/50 border border-border/60 hover:border-border hover:shadow-sm active:scale-[0.98] backdrop-blur-sm overflow-hidden"
        >
          <Github className="w-4 h-4" />
          
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            {loading ? (
              <div className="w-6 h-4 bg-muted rounded animate-pulse" />
            ) : (
              <span className="font-semibold text-xs tabular-nums">
                {stars ? formatStars(stars) : '0'}
              </span>
            )}
          </div>
          
          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          
          {/* Hover shimmer effect */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse pointer-events-none" />
        </Link>
      );
    }

    // Discord Community Button
    function DiscordButton() {
      return (
        <Link
          href="https://discord.gg/r2eMeAp6"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 rounded-lg hover:bg-accent/50 border border-border/60 hover:border-border hover:shadow-sm active:scale-[0.98] backdrop-blur-sm overflow-hidden"
        >
          {/* Discord Logo SVG */}
          <svg className="w-4 h-4 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          
          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          
          {/* Hover shimmer effect */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse pointer-events-none" />
        </Link>
      );
    }

    const handleGetStarted = () => {
      if (!isLoaded) return
      
      if (isSignedIn) {
        router.push('/projects')
      } else {
        router.push('/sign-in')
      }
    }

  return (
    <header className="border-b border-border/40 sticky top-0 z-50 overflow-hidden">
      {/* Liquid Glass Effect Layer */}
      <div className="absolute inset-0 bg-background/75 backdrop-blur-md" />
      
      {/* Enhanced glass morphism with edge effects */}
      <div className="absolute inset-0">
        {/* Main glass surface */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-white/[0.02] dark:from-white/[0.02] dark:via-transparent dark:to-white/[0.01]" />
        
        {/* Subtle edge highlight - top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        
        {/* Edge glow effects */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-blue-400/8 to-transparent" />
        
        {/* Bottom border enhancement */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Left side - Logo with enhanced effects */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center relative group">
                {/* Enhanced glow effect on hover */}
                <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10"> 
                  <Image src="/logo.png" alt="Logo" width={40} height={40} />
                </div>
              </div>
              {/* Enhanced gradient text with new font */}
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent tracking-tight">
                Whispey
              </span>
            </div>

            {/* Center - Enhanced Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group">
                Features
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
              <Link href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group">
                How it Works
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
              <Link 
                href="/docs" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors relative group"
              >
                Docs
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600 group-hover:w-full transition-all duration-300" />
              </Link>
            </nav>

            {/* Right side - GitHub, Discord + Auth buttons */}
            <div className="flex items-center space-x-3">
              <GitHubStarsButton />
              <DiscordButton />
              
              <div className="w-px h-6 bg-border/40 mx-2" />
              
              <Button 
                size="sm" 
                className="hidden sm:inline-flex group relative overflow-hidden font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-white cursor-pointer border-0 shadow-lg shadow-blue-600/25 dark:shadow-blue-400/20 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={handleGetStarted}
                disabled={!isLoaded}
              >
                <span className="relative z-10">
                  {!isLoaded ? 'Loading...' : isSignedIn ? 'Go to Projects' : 'Get Started'}
                </span>
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform relative z-10" />
                {/* Enhanced shimmer effect with dark mode support */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header