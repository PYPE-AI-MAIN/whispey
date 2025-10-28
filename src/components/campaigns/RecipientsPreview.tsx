// components/campaigns/RecipientsPreview.tsx
'use client'

import React from 'react'
import { Upload } from 'lucide-react'
import { CSV_TEMPLATE, RecipientRow } from '@/utils/campaigns/constants'

interface RecipientsPreviewProps {
  csvData: RecipientRow[]
}

export function RecipientsPreview({ csvData }: RecipientsPreviewProps) {
  if (csvData.length === 0) {
    return (
      <div className="border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col w-80">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Recipients (0)
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload recipients CSV to preview
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col w-[900px]">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Recipients ({csvData.length})
        </h3>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Excel-like header */}
        <div className="flex border-b-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0 sticky top-0 z-10">
          {CSV_TEMPLATE.headers.map((header) => (
            <div 
              key={header}
              className={`px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex-shrink-0 ${
                header === 'name' ? 'w-40' :
                header === 'phone' ? 'w-36' :
                header === 'email' ? 'w-48' :
                header === 'company' ? 'w-40' :
                header === 'city' ? 'w-32' :
                header === 'industry' ? 'w-36' :
                'w-40'
              }`}
            >
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">
                {header}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Excel-like body */}
        <div className="flex-1 overflow-auto">
          {csvData.map((row, rowIdx) => (
            <div 
              key={rowIdx}
              className="flex border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="w-40 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100">
                  {row.name || '-'}
                </span>
              </div>
              <div className="w-36 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100 font-mono">
                  {row.phone || '-'}
                </span>
              </div>
              <div className="w-48 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100">
                  {row.email || '-'}
                </span>
              </div>
              <div className="w-40 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100">
                  {row.company || '-'}
                </span>
              </div>
              <div className="w-32 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100">
                  {row.city || '-'}
                </span>
              </div>
              <div className="w-36 px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                <span className="text-xs text-gray-900 dark:text-gray-100">
                  {row.industry || '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}