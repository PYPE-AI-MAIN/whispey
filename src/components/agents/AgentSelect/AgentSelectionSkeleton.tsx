'use client'

import React from 'react'
import { Search, Plus, Filter, LayoutGrid, List, HelpCircle } from 'lucide-react'

// Skeleton component for reusability
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
)

// Toolbar Skeleton
const ToolbarSkeleton = () => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-4">
      {/* Search skeleton */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Skeleton className="h-9 w-64 pl-10" />
      </div>
      
      {/* View toggle skeleton */}
      <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
        <Skeleton className="h-8 w-8 m-0.5" />
        <Skeleton className="h-8 w-8 m-0.5" />
      </div>
    </div>

    <div className="flex items-center gap-2">
      {/* Help button skeleton */}
      <Skeleton className="h-9 w-9" />
      
      {/* Create button skeleton */}
      <Skeleton className="h-9 w-32" />
    </div>
  </div>
)

// Agent Card Skeleton (for grid view)
const AgentCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
    {/* Header */}
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
    
    {/* Stats */}
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    </div>
    
    {/* Footer */}
    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  </div>
)

// Agent Row Skeleton (for list view)
const AgentRowSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div className="flex items-center justify-between">
      {/* Left side - Agent info */}
      <div className="flex items-center gap-4 flex-1">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
      
      {/* Middle - Stats */}
      <div className="hidden md:flex items-center gap-8">
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      
      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  </div>
)

// Main skeleton component
const AgentSelectionSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-6xl mx-auto px-8 py-8">
        {/* Toolbar skeleton */}
        <ToolbarSkeleton />
        
        {/* Content skeleton - showing list view by default */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <AgentRowSkeleton key={index} />
          ))}
        </div>
        
        {/* Alternative: Grid view skeleton (uncomment if needed) */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <AgentCardSkeleton key={index} />
          ))}
        </div> */}
      </main>
    </div>
  )
}

export default AgentSelectionSkeleton