// components/campaigns/RecipientsPreview.tsx
'use client'

import React from 'react'
import { Upload } from 'lucide-react'
import { RecipientRow } from '@/utils/campaigns/constants'

interface RecipientsPreviewProps {
  csvData: RecipientRow[]
  // Raw phone strings that are on the DNC list (highlighted, excluded from the campaign).
  dncBlocked?: Set<string>
}

export function RecipientsPreview({ csvData, dncBlocked }: RecipientsPreviewProps) {
  const blockedCount = dncBlocked ? csvData.filter((r) => dncBlocked.has(r.phone)).length : 0
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

  // Get all unique headers from the CSV data
  const headers = csvData.length > 0 ? Object.keys(csvData[0]) : []

  // Helper function to determine column width based on header name
  const getColumnWidth = (header: string) => {
    const lowerHeader = header.toLowerCase()
    if (lowerHeader === 'name') return 'w-40'
    if (lowerHeader === 'phone' || lowerHeader === 'phonenumber' || lowerHeader === 'phone_number') return 'w-36'
    if (lowerHeader === 'email') return 'w-48'
    if (lowerHeader === 'company' || lowerHeader === 'city' || lowerHeader === 'industry') return 'w-36'
    return 'w-32' // default width for other columns
  }

  return (
    <div className="border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col w-[900px]">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Recipients ({csvData.length})
        </h3>
        {blockedCount > 0 ? (
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
            {blockedCount} number{blockedCount > 1 ? 's' : ''} on the DNC list — highlighted below, will not be called.
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Scroll horizontally to view all columns
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
              <tr>
                {headers.map((header) => (
                  <th 
                    key={header}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${getColumnWidth(header)}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {csvData.map((row, rowIdx) => {
                const isBlocked = dncBlocked?.has(row.phone) ?? false
                return (
                <tr
                  key={rowIdx}
                  title={isBlocked ? 'On the Do Not Call (DNC) list — will not be called' : undefined}
                  className={
                    isBlocked
                      ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors'
                      : 'hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors'
                  }
                >
                  {headers.map((header) => (
                    <td
                      key={header}
                      className={`px-4 py-3 text-xs border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                        isBlocked ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-gray-100'
                      } ${
                        header.toLowerCase().includes('phone') ? 'font-mono' : ''
                      } ${getColumnWidth(header)}`}
                    >
                      <div className="truncate flex items-center gap-1" title={(row as any)[header] || '-'}>
                        {(row as any)[header] || '-'}
                        {isBlocked && header.toLowerCase().includes('phone') && (
                          <span className="text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">
                            (DNC)
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}