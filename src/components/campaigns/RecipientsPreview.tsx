// components/campaigns/RecipientsPreview.tsx
'use client'

import React from 'react'
import { Upload } from 'lucide-react'

interface RecipientsPreviewProps {
  csvData: Record<string, any>[]
}

export function RecipientsPreview({ csvData }: RecipientsPreviewProps) {
  // Extract headers from the first data row
  const headers = csvData.length > 0 ? Object.keys(csvData[0]) : []

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

  // Calculate dynamic column width based on content
  const getColumnWidth = (header: string) => {
    const lowerHeader = header.toLowerCase()
    if (lowerHeader === 'phone') return 'w-36'
    return 'w-32' // default width for variable columns
  }

  return (
    <div className="border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col w-full max-w-4xl">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Recipients ({csvData.length})
        </h3>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Excel-like header */}
        <div className="flex border-b-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0 sticky top-0 z-10">
          {headers.map((header) => (
            <div 
              key={header}
              className={`px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex-shrink-0 ${getColumnWidth(header)}`}
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
              {headers.map((header) => (
                <div 
                  key={`${rowIdx}-${header}`}
                  className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 ${getColumnWidth(header)}`}
                >
                  <span className={`text-xs text-gray-900 dark:text-gray-100 ${
                    header.toLowerCase() === 'phone' ? 'font-mono' : ''
                  }`}>
                    {row[header] || '-'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}