'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  ChevronLeft,
  RefreshCw,
  Search,
  Phone,
  Clock,
  Building2,
  FileText,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Upload,
  Calendar,
  Trash2,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampaignLog {
  id: string
  phoneNumber: string
  alternative_number?: string
  fpoName: string
  fpoLoginId: string
  call_status: string
  attempt_count: number
  sourceFile: string
  createdAt: string
  uploadedAt: string
  real_attempt_count:number
  system_error_count:number
}

interface CampaignLogsProps {
  project: any
  agent: any
  onBack: () => void
}

const CALL_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'in_progress', label: 'In Progress' }
]

const CampaignLogs: React.FC<CampaignLogsProps> = ({ project, agent, onBack }) => {
  const [logs, setLogs] = useState<CampaignLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFileFilter, setSourceFileFilter] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [lastKey, setLastKey] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // Upload & Schedule states
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false) 
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  
  // Schedule form data
  const [scheduleData, setScheduleData] = useState({
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    concurrency: 10,
    retry_config: {
      '408': 60,
      '480': 60,
      '486': 120,
      '504': 60,
      '600': 120
    }
  })
  
  // Delete All states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<any>(null)
  
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true)
        setLogs([])
        setLastKey(null)
        setHasMore(true)
        setError(null)
      }

      // Use agent's project_id directly, as it's more reliable
      const projectId = agent?.project_id || project?.id
      
      if (!projectId) {
        throw new Error('Project ID not available')
      }

      const params = new URLSearchParams({
        project_id: projectId,
        limit: '50',
      })

      if (statusFilter !== 'all') {
        params.append('call_status', statusFilter)
      }

      if (sourceFileFilter) {
        params.append('source_file', sourceFileFilter)
      }

      if (!reset && lastKey) {
        params.append('lastKey', JSON.stringify(lastKey))
      }

      const response = await fetch(`/api/campaign-logs?${params.toString()}`)
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Campaign logs are only available for enhanced projects')
        }
        throw new Error('Failed to fetch campaign logs')
      }

      const data = await response.json()
      
      if (reset) {
        setLogs(data.items)
      } else {
        setLogs(prev => [...prev, ...data.items])
      }
      
      setLastKey(data.lastEvaluatedKey)
      setHasMore(!!data.lastEvaluatedKey)

    } catch (err: any) {
      console.error('Error fetching campaign logs:', err)
      setError(err.message || 'Failed to fetch campaign logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agent?.project_id, project?.id, statusFilter, sourceFileFilter])



  const refresh = useCallback(() => {
    setRefreshing(true)
    fetchLogs(true)
  }, [])

  useEffect(() => {
    const projectId = agent?.project_id || project?.id
    if (projectId) {
      fetchLogs(true)
    }
  }, [agent?.project_id, project?.id, statusFilter, sourceFileFilter])

  // Set default dates when schedule dialog opens
  useEffect(() => {
    if (showScheduleDialog) {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      setScheduleData(prev => ({
        ...prev,
        start_date: today.toISOString().split('T')[0],
        end_date: tomorrow.toISOString().split('T')[0]
      }))
    }
  }, [showScheduleDialog])

  // Create stable refs for intersection observer
  const stableStateRef = useRef({ hasMore, loading, lastKey, fetchLogs })
  stableStateRef.current = { hasMore, loading, lastKey, fetchLogs }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const { hasMore, loading, lastKey, fetchLogs } = stableStateRef.current
        if (entries[0].isIntersecting && hasMore && !loading && lastKey) {
          fetchLogs(false)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return (
      log.phoneNumber?.toLowerCase().includes(query) ||
      log.fpoName?.toLowerCase().includes(query) ||
      log.fpoLoginId?.toLowerCase().includes(query) ||
      log.sourceFile?.toLowerCase().includes(query)
    )
  })

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const exportLogs = () => {
    const csvContent = [
      // Header
      'Phone Number,Alternative Number,FPO Name,FPO Login ID,Status,Real Attempts,Source File,Created At,Uploaded At',
      // Data rows
      ...filteredLogs.map(log => 
        `"${log.phoneNumber}","${log.alternative_number || ''}","${log.fpoName}","${log.fpoLoginId}","${log.call_status}",${log.real_attempt_count},"${log.sourceFile}","${log.createdAt}","${log.uploadedAt}"`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `campaign-logs-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Upload CSV handler
  const handleUpload = async () => {
    if (!csvFile) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('project_id', agent?.project_id || project?.id)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload CSV')
      }

      const result = await response.json()
      console.log('Upload API Response:', result)
      
      const alertMessage = [
        result.message,
        `File: ${result.fileName} (${(result.fileSize / 1024).toFixed(1)} KB)`,
        result.s3Key && result.s3Key !== 'upload_successful_but_key_unavailable' 
          ? `S3 Key: ${result.s3Key}` 
          : 'Upload completed successfully',
        result.uploadUrl ? `URL: ${result.uploadUrl}` : ''
      ].filter(Boolean).join('\n')
      
      alert(alertMessage)
      
      // Reset upload dialog
      setShowUploadDialog(false)
      setCsvFile(null)
      
      // Immediately refresh DynamoDB logs to see new data
      console.log('Refreshing DynamoDB logs after CSV upload...')
      await fetchLogs(true) // Force refresh from DynamoDB
      
      // Additional refresh after a short delay to catch any async processing
      setTimeout(() => {
        console.log('Secondary refresh after upload processing...')
        fetchLogs(true)
      }, 3000)
      
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload CSV: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // Schedule Campaign handler
  const handleSchedule = async () => {
    if (!scheduleData.start_date || !scheduleData.end_date) {
      alert('Please select start date and end date')
      return
    }

    setScheduling(true)
    try {
      const schedulePayload = {
        project_id: agent?.project_id || project?.id,
        start_date: scheduleData.start_date,
        end_date: scheduleData.end_date,
        start_time: scheduleData.start_time,
        end_time: scheduleData.end_time,
        concurrency: scheduleData.concurrency,
        retry_config: scheduleData.retry_config
      }

      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create schedule')
      }

      const result = await response.json()
      
      const alertMessage = [
        result.message,
        `Schedule ID: ${result.scheduleId}`,
        `Period: ${result.schedule.start_date} to ${result.schedule.end_date}`,
        `Time: ${result.schedule.start_time} - ${result.schedule.end_time}`,
        `Concurrency: ${result.schedule.concurrency} calls`,
        result.retry_configuration ? 'Retry configuration updated' : ''
      ].filter(Boolean).join('\n')
      
      alert(alertMessage)
      
      setShowScheduleDialog(false)
      
      // Reset schedule form
      setScheduleData({
        start_date: '',
        end_date: '',
        start_time: '09:00',
        end_time: '17:00',
        concurrency: 10,
        retry_config: {
          '408': 60,
          '480': 60,
          '486': 120,
          '504': 60,
          '600': 120
        }
      })
      
    } catch (error) {
      console.error('Schedule error:', error)
      alert('Failed to create schedule: ' + (error as Error).message)
    } finally {
      setScheduling(false)
    }
  }

  // Delete All handler
  const handleDeleteAll = async () => {
    if (deleteConfirmText !== 'DELETE ALL LOGS') return
    
    setDeleting(true)
    setError(null)
    try {
      const projectId = agent?.project_id || project?.id
      if (!projectId) {
        throw new Error('Project ID not available')
      }

      const response = await fetch(`/api/campaign-logs?project_id=${projectId}&confirm=DELETE_ALL_CAMPAIGN_LOGS`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete logs')
      }

      setDeleteResult({
        success: true,
        message: result.message,
        count: result.deletedCount
      })

      // Clear logs and refresh
      setLogs([])
      setLastKey(null)
      setHasMore(true)
      
      // Close dialog and reset
      setShowDeleteDialog(false)
      setDeleteConfirmText('')
      
      // Refresh after delay
      setTimeout(() => {
        fetchLogs(true)
      }, 1000)

    } catch (err: any) {
      console.error('Error deleting logs:', err)
      setDeleteResult({
        success: false,
        message: err.message || 'Failed to delete logs'
      })
    } finally {
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Unable to Load Campaign Logs</h2>
          <p className="text-gray-600">{error}</p>
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Campaign Logs</h1>
                <p className="text-sm text-gray-600">
                  Contact status from DynamoDB • {filteredLogs.length} contact{filteredLogs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowUploadDialog(true)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowScheduleDialog(true)}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
                disabled={filteredLogs.length === 0 || loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/80 backdrop-blur-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none bg-white/80 backdrop-blur-sm"
            >
              {CALL_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Source File Filter */}
            <Input
              placeholder="Filter by source file..."
              value={sourceFileFilter}
              onChange={(e) => setSourceFileFilter(e.target.value)}
              className="bg-white/80 backdrop-blur-sm"
            />

            {/* Clear Filters */}
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
                setSourceFileFilter('')
              }}
              className="bg-white/80 backdrop-blur-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </div>
      </header>

      {/* Table */}
      <main className="px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {loading && logs.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Loading campaign logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No campaign logs found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? 'Try adjusting your search criteria' : 'No contacts have been uploaded yet'}
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="border overflow-hidden rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                      <TableHead className="w-[140px] font-semibold text-foreground pl-6">Phone Number</TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground">Alternative</TableHead>
                      <TableHead className="w-[160px] font-semibold text-foreground">FPO Name</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">FPO Login ID</TableHead>
                      <TableHead className="w-[100px] font-semibold text-foreground">Status</TableHead>
                      <TableHead className="w-[90px] font-semibold text-foreground">Retry Attempts</TableHead>
                      <TableHead className="w-[200px] font-semibold text-foreground">System  Error</TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground pr-6">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="cursor-default hover:bg-muted/30 transition-all duration-200 border-b border-border/50"
                      >
                        <TableCell className="font-medium pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Phone className="w-4 h-4 text-primary" />
                            </div>
                            <span className="font-medium">{log.phoneNumber}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600">{log.alternative_number || '-'}</span>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{log.fpoName}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <code className="text-xs bg-muted/60 px-2 py-1 rounded font-mono">
                            {log.fpoLoginId}
                          </code>
                        </TableCell>

                        <TableCell className="py-4">
                          <Badge
                            className={cn("text-xs font-medium px-2.5 py-1", getStatusColor(log.call_status))}
                          >
                            {log.call_status}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {log.real_attempt_count}
                          </div>
                        </TableCell>

                        <TableCell className="py-4">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {log.system_error_count}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground py-4 pr-6">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Load More */}
              <div ref={loadMoreRef} className="py-4">
                {loading && logs.length > 0 && (
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                    <p className="text-sm text-gray-600 mt-2">Loading more logs...</p>
                  </div>
                )}
                
                {!hasMore && logs.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No more logs to load</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Upload CSV Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload CSV File</h3>
              <p className="text-sm text-gray-600">Select a CSV file to upload to S3</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {csvFile && (
                <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                  <strong>Selected:</strong> {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowUploadDialog(false)
                  setCsvFile(null)
                }} 
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!csvFile || uploading}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload to S3
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Campaign Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Schedule Campaign</h3>
              <p className="text-sm text-gray-600">Configure your campaign schedule settings</p>
            </div>
            
            <div className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={scheduleData.start_date}
                    onChange={(e) => setScheduleData({ ...scheduleData, start_date: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={scheduleData.end_date}
                    onChange={(e) => setScheduleData({ ...scheduleData, end_date: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Start Time <span className="text-gray-500 text-xs">(24-hour format)</span>
                  </label>
                  <input
                    type="time"
                    value={scheduleData.start_time}
                    onChange={(e) => setScheduleData({ ...scheduleData, start_time: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    End Time <span className="text-gray-500 text-xs">(24-hour format)</span>
                  </label>
                  <input
                    type="time"
                    value={scheduleData.end_time}
                    onChange={(e) => setScheduleData({ ...scheduleData, end_time: e.target.value })}
                    disabled={scheduling}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 font-mono"
                  />
                </div>
              </div>

              {/* Concurrency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrency (Simultaneous Calls)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={scheduleData.concurrency}
                  onChange={(e) => setScheduleData({ ...scheduleData, concurrency: parseInt(e.target.value) || 1 })}
                  disabled={scheduling}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
                            </div>

              {/* Retry Configuration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Retry Configuration (Minutes)
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        SIP 408 (Request Timeout)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={scheduleData.retry_config['408']}
                        onChange={(e) => setScheduleData({ 
                          ...scheduleData, 
                          retry_config: { 
                            ...scheduleData.retry_config, 
                            '408': parseInt(e.target.value) || 60 
                          } 
                        })}
                        disabled={scheduling}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-green-500 focus:ring-1 focus:ring-green-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        SIP 480 (Temporarily Unavailable)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={scheduleData.retry_config['480']}
                        onChange={(e) => setScheduleData({ 
                          ...scheduleData, 
                          retry_config: { 
                            ...scheduleData.retry_config, 
                            '480': parseInt(e.target.value) || 60 
                          } 
                        })}
                        disabled={scheduling}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-green-500 focus:ring-1 focus:ring-green-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        SIP 486 (Busy Here)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={scheduleData.retry_config['486']}
                        onChange={(e) => setScheduleData({ 
                          ...scheduleData, 
                          retry_config: { 
                            ...scheduleData.retry_config, 
                            '486': parseInt(e.target.value) || 120 
                          } 
                        })}
                        disabled={scheduling}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-green-500 focus:ring-1 focus:ring-green-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        SIP 504 (Server Timeout)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={scheduleData.retry_config['504']}
                        onChange={(e) => setScheduleData({ 
                          ...scheduleData, 
                          retry_config: { 
                            ...scheduleData.retry_config, 
                            '504': parseInt(e.target.value) || 60 
                          } 
                        })}
                        disabled={scheduling}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-green-500 focus:ring-1 focus:ring-green-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        SIP 600 (Busy Everywhere)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={scheduleData.retry_config['600']}
                        onChange={(e) => setScheduleData({ 
                          ...scheduleData, 
                          retry_config: { 
                            ...scheduleData.retry_config, 
                            '600': parseInt(e.target.value) || 120 
                          } 
                        })}
                        disabled={scheduling}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-green-500 focus:ring-1 focus:ring-green-100"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <strong>Tip:</strong> Set retry intervals based on expected recovery time for each error type.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowScheduleDialog(false)
                  setScheduleData({
                    start_date: '',
                    end_date: '',
                    start_time: '09:00',
                    end_time: '17:00',
                    concurrency: 10,
                    retry_config: {
                      '408': 60,
                      '480': 60,
                      '486': 120,
                      '504': 60,
                      '600': 120
                    }
                  })
                }}
                disabled={scheduling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSchedule}
                disabled={scheduling}
                className="flex-1"
              >
                {scheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Create Schedule
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            {!deleteResult ? (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-red-900 mb-2">Delete All Campaign Logs</h3>
                  <p className="text-sm text-red-700">This will permanently delete all campaign logs from DynamoDB</p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 mb-2">
                    <strong>⚠️ Warning:</strong> This action cannot be undone!
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE ALL LOGS</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE ALL LOGS"
                      disabled={deleting}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  
                  {filteredLogs.length > 0 && (
                    <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
                      <strong>Records to be deleted:</strong> {filteredLogs.length} campaign log entries
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false)
                      setDeleteConfirmText('')
                      setDeleteResult(null)
                    }}
                    disabled={deleting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteAll}
                    disabled={deleteConfirmText !== 'DELETE ALL LOGS' || deleting}
                    className="flex-1"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete All Logs
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    deleteResult.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {deleteResult.success ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    deleteResult.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {deleteResult.success ? 'Deletion Successful!' : 'Deletion Failed'}
                  </h3>
                  <p className={`text-sm ${
                    deleteResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {deleteResult.message}
                  </p>
                  
                  {deleteResult.success && deleteResult.count && (
                    <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-3">
                      <strong>Deleted:</strong> {deleteResult.count} campaign log records
                    </div>
                  )}
                </div>
                
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false)
                      setDeleteConfirmText('')
                      setDeleteResult(null)
                    }}
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CampaignLogs 