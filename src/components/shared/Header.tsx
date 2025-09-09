// src/components/shared/Header.tsx
"use client"

import { UserButton, SignedIn, useUser } from "@clerk/clerk-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Bell, Search, Settings, BarChart3, Users, FileText, Zap, ChevronDown, HelpCircle, Command, ChevronRight, Slash, BookOpen, Github } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useEffect, useState } from "react";
import { GitHubStarsButton } from "../GithubLink";

interface HeaderProps {
  breadcrumb?: {
    project?: string;
    item?: string;
  };
  isLoading?: boolean;
}

function Header({ breadcrumb, isLoading }: HeaderProps) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [breadcrumbState, setBreadcrumbState] = useState<{
    project?: string;
    item?: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  useEffect(() => {
    if (isLoading) {
      setBreadcrumbState({
        project: 'Loading...',
        item: 'Loading...'
      });
    } else if (breadcrumb) {
      setBreadcrumbState(breadcrumb);
    }
  }, [breadcrumb, isLoading]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const getUserDisplayName = () => {
    if (user?.fullName) return user.fullName;
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.split('@')[0];
    }
    return 'User';
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-50 shadow-sm">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto">
          {/* Logo & Brand Section */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <Image src="/logo.png" alt="Pype AI Logo" width={48} height={48} className="group-hover:scale-110 transition-transform duration-200" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 tracking-tight">
                  Whispey
                </h1>
                <p className="text-xs text-gray-500 -mt-0.5 font-medium">LiveKit Observability Platform</p>
              </div>
            </Link>

            {/* Apple-Style Clean Breadcrumb with Loading States */}
            {breadcrumbState && (
              <div className="flex items-center">
                <nav className="flex items-center gap-2 text-sm">
                  <Link 
                    href="/" 
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Home
                  </Link>
                  
                  {breadcrumbState.project && (
                    <>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                      {isLoading ? (
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <span className="text-gray-900">
                          {breadcrumbState.project}
                        </span>
                      )}
                    </>
                  )}
                  
                  {breadcrumbState.item && (
                    <>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                      {isLoading ? (
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                      ) : (
                        <span className="text-gray-900">
                          {breadcrumbState.item}
                        </span>
                      )}
                    </>
                  )}
                </nav>
              </div>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Docs Button */}
            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-all duration-200 rounded-lg hover:bg-blue-50/50 border border-transparent hover:border-blue-100"
            >
              <BookOpen className="w-4 h-4 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Docs</span>
              <svg 
                className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                />
              </svg>
            </Link>

            <GitHubStarsButton />
            
            {/* Vertical Separator */}
            <div className="w-px h-5 bg-gray-200"></div>

            {/* Help Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 w-9 h-9 p-0 rounded-lg border border-transparent hover:border-gray-200 transition-all duration-200"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 shadow-lg border border-gray-200/80 rounded-xl backdrop-blur-sm bg-white/95">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Help & Resources</p>
                  <p className="text-xs text-gray-500 mt-0.5">Get support and documentation</p>
                </div>
                <div className="py-1">
                  <DropdownMenuItem asChild>
                    <Link href="/api-reference" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                      <Zap className="w-4 h-4 mr-3 text-yellow-600" />
                      <div>
                        <p className="font-medium text-gray-900">API Reference</p>
                        <p className="text-xs text-gray-500">Complete API documentation</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="https://discord.gg/r2eMeAp6" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                      <Users className="w-4 h-4 mr-3 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Community</p>
                        <p className="text-xs text-gray-500">Connect with developers</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="bg-gray-100" />
                <div className="py-1">
                  <DropdownMenuItem asChild>
                    <Link href="mailto:deepesh@pypeai.com" className="flex items-center w-full px-3 py-2 hover:bg-gray-50 rounded-lg mx-1">
                      <HelpCircle className="w-4 h-4 mr-3 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">Contact Support</p>
                        <p className="text-xs text-gray-500">Get help from our team</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Profile Section with Loading State */}
            <div className="flex items-center gap-3 pl-4 ml-2 border-l border-gray-200">
              {!isHydrated || !isLoaded ? (
                // Always show skeleton during SSR and initial load
                <>
                  <div className="hidden sm:flex flex-col items-end">
                    <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gray-300 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                </>
              ) : (
                // Only show actual content after hydration AND Clerk is loaded
                <SignedIn>
                  <div className="hidden sm:flex flex-col items-end">
                    <p className="text-sm font-semibold text-gray-900 leading-none">{getUserDisplayName()}</p>
                  </div>
                  
                  <div className="relative">
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: "w-9 h-9 ring-2 ring-gray-100 hover:ring-blue-200 transition-all duration-200 shadow-sm hover:shadow-md",
                          userButtonPopoverCard: "shadow-2xl border border-gray-100 rounded-2xl backdrop-blur-sm bg-white/95",
                          userButtonPopoverActionButton: "hover:bg-gray-50 rounded-xl transition-all duration-200 mx-1",
                          userButtonPopoverActionButtonText: "text-gray-700 font-medium",
                          userButtonPopoverFooter: "hidden",
                          userButtonPopoverActions: "p-2"
                        }
                      }}
                      userProfileProps={{
                        appearance: {
                          elements: {
                            card: "shadow-2xl border border-gray-100 rounded-2xl",
                            navbar: "bg-gray-50/80 rounded-t-2xl border-b border-gray-100",
                            navbarButton: "text-gray-600 hover:text-gray-900 font-semibold transition-colors",
                            headerTitle: "text-gray-900 font-bold text-lg",
                            headerSubtitle: "text-gray-600 font-medium"
                          }
                        }
                      }}
                    />
                    {/* Online Status Indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                </SignedIn>
              )}
            </div>
          </div>
        </div>
        
        {/* Subtle bottom gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200/50 to-transparent"></div>
      </div>
    </header>
  );
}

export default Header;