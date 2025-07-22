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
  AlertCircle
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
              <Button variant="ghost" onClick={onBack} className="-ml-3 hover:bg-white/50">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              
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
                                             <TableHead className="w-[90px] font-semibold text-foreground">Real Attempts</TableHead>
                      <TableHead className="w-[200px] font-semibold text-foreground">Source File</TableHead>
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
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-gray-600 truncate max-w-[180px]" title={log.sourceFile}>
                              {log.sourceFile.split('/').pop()}
                            </span>
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
    </div>
  )
}

export default CampaignLogs 