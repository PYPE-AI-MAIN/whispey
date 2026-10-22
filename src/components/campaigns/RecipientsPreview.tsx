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

export function RecipientsPreview({ csvData, dncBlocked }: Readonly<RecipientsPreviewProps>) {
  const blockedCount = dncBlocked ? csvData.filter((r) => dncBlocked.has(r.phone)).length : 0
  if (csvData.length === 0) {
    return (
      <div className="border-l-0 sm:border-l border-t sm:border-t-0 border-border bg-card flex flex-col w-full sm:w-80">
        <div className="p-3 border-b border-border flex-shrink-0">
          <h3 className="text-xs font-medium text-muted-foreground">
            Recipients (0)
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
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

  // stacked below the form on phone (parent switches to flex-col there), so
  // this needs its own height cap — otherwise its internal `flex-1
  // overflow-auto` table has no bounded height to fill and grows unbounded
  // instead of scrolling
  return (
      <div className="border-l-0 sm:border-l border-t sm:border-t-0 border-border bg-muted/50 flex flex-col w-full sm:w-[900px] h-[50vh] sm:h-auto">
      <div className="p-3 border-b border-border flex-shrink-0 bg-card">
        <h3 className="text-xs font-medium text-muted-foreground">
          Recipients ({csvData.length})
        </h3>
        {blockedCount > 0 ? (
          <p className="text-xs text-destructive mt-0.5">
            {blockedCount} number{blockedCount > 1 ? 's' : ''} on the DNC list — highlighted below, will not be called.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            Scroll horizontally to view all columns
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                {headers.map((header) => (
                  <th 
                    key={header}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-semibold text-foreground border-r border-border last:border-r-0 ${getColumnWidth(header)}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {csvData.map((row, rowIdx) => {
                const isBlocked = dncBlocked?.has(row.phone) ?? false
                return (
                <tr
                  key={rowIdx}
                  title={isBlocked ? 'On the Do Not Call (DNC) list — will not be called' : undefined}
                  className={
                    isBlocked
                      ? 'bg-destructive/10 hover:bg-destructive/15 transition-colors'
                      : 'hover:bg-primary/10 dark:hover:bg-gray-700/50 transition-colors'
                  }
                >
                  {headers.map((header) => (
                    <td
                      key={header}
                      className={`px-4 py-3 text-xs border-r border-border  last:border-r-0 ${
                        isBlocked ? 'text-red-700 dark:text-red-300' : 'text-foreground'
                      } ${
                        header.toLowerCase().includes('phone') ? 'font-mono' : ''
                      } ${getColumnWidth(header)}`}
                    >
                      <div className="truncate flex items-center gap-1" title={(row as any)[header] || '-'}>
                        {(row as any)[header] || '-'}
                        {isBlocked && header.toLowerCase().includes('phone') && (
                          <span className="text-[11px] font-semibold uppercase text-destructive">
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