/**
 * Backfill Disposition Dialog Component
 * 
 * This component provides a UI for backfilling final_disposition values
 * for call logs within a specified date range.
 * 
 * Features:
 * - Date range picker (from/to dates)
 * - Agent and project display (read-only)
 * - Progress indicator
 * - Success/error messaging
 * - Results summary
 */

'use client'

import React, { useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Loader2, CalendarDays, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// ============================================================================
// Type Definitions
// ============================================================================

interface BackfillDispositionDialogProps {
  projectId?: string
  agentId?: string
  agentName?: string
  projectName?: string
}

interface BackfillResponse {
  success: boolean
  total_processed: number
  successful: number
  skipped?: number
  failed: number
  results: Array<{
    call_log_id: string
    final_disposition: string | null
    success: boolean
    skipped?: boolean
    error?: string
  }>
  message?: string
  error?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Subtracts days from a date
 */
const subDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

/**
 * Formats date for display
 */
const formatDateDisplay = (date: Date): string => {
  return format(date, 'MMM dd, yyyy')
}

// ============================================================================
// Main Component
// ============================================================================

const BackfillDispositionDialog = memo<BackfillDispositionDialogProps>(({
  projectId,
  agentId,
  agentName,
  projectName
}) => {
  // ==========================================================================
  // Check if project is allowed for disposition backfill
  // ==========================================================================

  /**
   * Checks if the current project ID is in the allowed list
   * Environment variable: NEXT_PUBLIC_DISPOSITION_PROJECTS (comma-separated or JSON array)
   */
  const isProjectAllowed = (): boolean => {
    if (!projectId) return false

    const allowedProjectsEnv = process.env.NEXT_PUBLIC_DISPOSITION_PROJECTS
    if (!allowedProjectsEnv) return false

    try {
      // Try parsing as JSON array first
      let allowedProjects: string[]
      if (allowedProjectsEnv.startsWith('[')) {
        allowedProjects = JSON.parse(allowedProjectsEnv)
      } else {
        // Otherwise, treat as comma-separated string
        allowedProjects = allowedProjectsEnv.split(',').map(id => id.trim())
      }

      return allowedProjects.includes(projectId)
    } catch (error) {
      console.error('Error parsing DISPOSITION_PROJECTS:', error)
      return false
    }
  }

  // If project is not allowed, don't render the button
  if (!isProjectAllowed()) {
    return null
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [results, setResults] = useState<BackfillResponse | null>(null)
  const [skipExisting, setSkipExisting] = useState(true) // Default to skipping existing values

  // Date range state - default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })

  // ==========================================================================
  // Handlers
  // ==========================================================================

  /**
   * Handles the backfill process
   */
  const handleBackfill = async () => {
    // Validation
    if (!dateRange?.from || !dateRange?.to) {
      setError('Please select a date range')
      return
    }

    if (!agentId) {
      setError('Agent ID is required')
      return
    }

    if (!projectId) {
      setError('Project ID is required')
      return
    }

    // Reset state
    setLoading(true)
    setError(null)
    setSuccess(false)
    setResults(null)

    try {
      // Prepare request payload
      const payload = {
        from_date: dateRange.from.toISOString(),
        to_date: dateRange.to.toISOString(),
        agent_id: agentId,
        project_id: projectId,
        overwrite_existing: !skipExisting // If skipExisting is true, overwrite_existing is false
      }

      // Call API
      const response = await fetch('/api/backfill-disposition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data: BackfillResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `API returned ${response.status}`)
      }

      if (!data.success) {
        throw new Error(data.error || 'Backfill failed')
      }

      // Success
      setResults(data)
      setSuccess(true)
      setError(null)
    } catch (err) {
      console.error('Backfill error:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setSuccess(false)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Resets the dialog state
   */
  const handleReset = () => {
    setError(null)
    setSuccess(false)
    setResults(null)
    setSkipExisting(true) // Reset to default
    setDateRange({
      from: subDays(new Date(), 30),
      to: new Date()
    })
  }

  /**
   * Resets state when dialog closes
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset after a short delay to allow animations
      setTimeout(() => {
        handleReset()
      }, 300)
    }
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!agentId || !projectId}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Backfill Disposition
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Backfill Final Disposition</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Date Range Picker */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !dateRange?.from && 'text-muted-foreground'
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            formatDateDisplay(dateRange.from)
                          ) : (
                            <span>Pick start date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange?.from}
                          onSelect={(date) =>
                            setDateRange({
                              from: date,
                              to: dateRange?.to
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !dateRange?.to && 'text-muted-foreground'
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {dateRange?.to ? (
                            formatDateDisplay(dateRange.to)
                          ) : (
                            <span>Pick end date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange?.to}
                          onSelect={(date) =>
                            setDateRange({
                              from: dateRange?.from,
                              to: date
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Agent and Project Info (Read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Agent</Label>
                  <div className="text-sm font-medium">
                    {agentName || agentId || 'N/A'}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Project</Label>
                  <div className="text-sm font-medium">
                    {projectName || projectId || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Skip Existing Option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-existing"
                  checked={skipExisting}
                  onCheckedChange={(checked) => setSkipExisting(checked === true)}
                  disabled={loading}
                />
                <Label
                  htmlFor="skip-existing"
                  className="text-sm font-normal cursor-pointer"
                >
                  Skip logs that already have final_disposition
                </Label>
              </div>
              {skipExisting && (
                <p className="text-xs text-muted-foreground ml-6 -mt-2">
                  Logs with existing final_disposition values will be skipped and not recalculated.
                </p>
              )}
              {!skipExisting && (
                <p className="text-xs text-muted-foreground ml-6 -mt-2">
                  All logs will be processed, overwriting existing final_disposition values if present.
                </p>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Success Alert */}
              {success && results && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <div className="space-y-1">
                      <div className="font-semibold">Backfill completed successfully!</div>
                      <div className="text-sm">
                        Processed: {results.total_processed} | 
                        Successful: {results.successful}
                        {results.skipped !== undefined && results.skipped > 0 && ` | Skipped: ${results.skipped}`} | 
                        Failed: {results.failed}
                      </div>
                      {results.skipped !== undefined && results.skipped > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Note: Skipped logs already had final_disposition populated
                        </div>
                      )}
                      {results.message && (
                        <div className="text-sm italic">{results.message}</div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Processing call logs...
                  </span>
                </div>
              )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              {success ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleBackfill}
              disabled={loading || !dateRange?.from || !dateRange?.to || !agentId || !projectId}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Backfill Disposition'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}, (prevProps, nextProps) => {
  return prevProps.projectId === nextProps.projectId && 
         prevProps.agentId === nextProps.agentId
})

BackfillDispositionDialog.displayName = "BackfillDispositionDialog"

export default BackfillDispositionDialog

