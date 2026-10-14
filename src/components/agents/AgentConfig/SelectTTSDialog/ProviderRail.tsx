import React, { useState } from 'react'
import { Check, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isNewProvider, type TtsProviderMeta } from './providers'

// Show the filter once the list stops fitting at a glance. Below this it is just noise.
const SEARCH_THRESHOLD = 6

interface ProviderRailProps {
  providers: TtsProviderMeta[]
  /** Voice counts per provider key; omitted while a provider's list is still loading. */
  counts: Record<string, number | undefined>
  /** Provider of the voice that will be saved, so it stays recognisable from any tab. */
  appliedProvider: string
  /** The tab being browsed; never filtered out of the list. */
  activeProvider: string
}

/**
 * Vertical provider switcher (a horizontal scroll strip below `md`).
 *
 * It is the TabsList of the dialog's Tabs root, so keyboard navigation and ARIA come from
 * Radix. Unlike a fixed-width tab strip it scales to any number of providers: it scrolls,
 * and grows a filter box once there are more than a handful.
 */
export default function ProviderRail({ providers, counts, appliedProvider, activeProvider }: Readonly<ProviderRailProps>) {
  const [query, setQuery] = useState('')
  const showSearch = providers.length > SEARCH_THRESHOLD
  const q = query.trim().toLowerCase()
  const visible = q
    ? providers.filter(
        (p) =>
          p.key === activeProvider ||
          p.label.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q),
      )
    : providers

  return (
    <div className="flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 md:w-60 md:flex md:flex-col bg-gray-50/60 dark:bg-gray-900/40">
      <div className="hidden md:block px-4 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Voice provider
        </p>
      </div>

      {showSearch && (
        <div className="hidden md:block px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a provider…"
              aria-label="Find a provider"
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      )}

      <TabsList
        aria-label="Voice provider"
        className="h-auto w-full rounded-none bg-transparent p-2 md:p-2 flex md:flex-col items-stretch justify-start gap-1 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:flex-1 md:min-h-0"
      >
        {visible.length === 0 && (
          <p className="px-3 py-6 text-xs text-center text-gray-500 dark:text-gray-400">No provider matches “{query}”</p>
        )}
        {visible.map((provider) => {
          const count = counts[provider.key]
          const isApplied = appliedProvider === provider.key
          return (
            <TabsTrigger
              key={provider.key}
              value={provider.key}
              aria-label={count === undefined ? provider.label : `${provider.label}, ${count} voices`}
              className="group h-auto flex-none md:w-full shrink-0 justify-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left font-normal text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800/60 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:border-gray-200 dark:data-[state=active]:border-gray-700 data-[state=active]:shadow-sm data-[state=active]:text-gray-900 dark:data-[state=active]:text-gray-50"
            >
              <span
                aria-hidden
                className={`w-7 h-7 rounded-full bg-gradient-to-br ${provider.dot} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
              >
                {provider.label.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{provider.label}</span>
                  {isNewProvider(provider.addedAt) && (
                    <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-green-700 dark:text-green-300">
                      New
                    </span>
                  )}
                </span>
                <span className="hidden md:block truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {provider.tagline}
                </span>
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                {isApplied && (
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" aria-label="Currently selected" />
                )}
                {count !== undefined && (
                  <span className="rounded-md bg-gray-200/70 dark:bg-gray-700/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:text-gray-300">
                    {count}
                  </span>
                )}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </div>
  )
}
