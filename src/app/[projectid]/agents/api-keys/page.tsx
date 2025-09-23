'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Key, 
  Copy, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  Plus, 
  Trash2, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  Calendar,
  Activity
} from 'lucide-react'

interface APIKey {
  id: string
  name: string
  masked_key: string
  created_at: string
  last_used: string | null
  is_active: boolean
  full_key?: string
  user_clerk_id?: string
  legacy?: boolean
}

const ApiKeys = () => {
  const params = useParams()
  const projectId = params?.projectid as string
  
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [showViewKeyDialog, setShowViewKeyDialog] = useState<APIKey | null>(null)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<APIKey | null>(null)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState<boolean>(false)
  const [newKeyData, setNewKeyData] = useState<APIKey | null>(null)
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null)
  const [viewingKey, setViewingKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<boolean>(false)
  const [showFullKey, setShowFullKey] = useState<boolean>(false)

  // Fetch API keys on component mount
  useEffect(() => {
    if (projectId) {
      fetchApiKeys()
    }
  }, [projectId])


  const fetchApiKeys = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/api-keys`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }
      
      const data = await response.json()
      
      if (data.success === false) {
        throw new Error(data.error || 'API returned error')
      }
      
      setApiKeys(data.keys || [])
      
    } catch (error) {
      setApiKeys([])
    } finally {
      setLoading(false)
    }
  }


  const handleViewFullKey = async (apiKey: APIKey) => {
    try {
      setViewingKey(apiKey.id)
      const response = await fetch(`/api/projects/${projectId}/api-keys/${apiKey.id}/decrypt`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Failed to decrypt key')
      }
      
      const data = await response.json()
      
      // Update the specific key in the array with the full key
      setApiKeys(prev => prev.map(key => 
        key.id === apiKey.id 
          ? { ...key, full_key: data.full_key }
          : key
      ))
    } catch (error) {
      console.error('Error decrypting key:', error)
      alert('Failed to decrypt API key')
    } finally {
      setViewingKey(null)
    }
  }

  const handleRegenerateKey = async () => {
    if (!showRegenerateConfirm) return
    
    try {
      setRegeneratingKey(showRegenerateConfirm.id)
      // Add leading slash here as well
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_token' })
      })
      
      if (!response.ok) {
        throw new Error('Failed to regenerate token')
      }
      
      const data = await response.json()
      
      await fetchApiKeys()
      
      setNewKeyData({ 
        ...showRegenerateConfirm, 
        full_key: data.api_token,
        created_at: new Date().toISOString()
      })
      setShowRegenerateConfirm(null)
      setShowNewKeyDialog(true)
    } catch (error) {
      console.error('Error regenerating key:', error)
      alert('Failed to regenerate API key')
    } finally {
      setRegeneratingKey(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return formatDate(dateString)
  }

  const handleCopyKey = async (keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } catch (err) {
      console.error('Failed to copy key:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            API Keys
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Manage API keys for secure programmatic access to this project. Keys are encrypted and can be viewed when needed.
        </p>
      </div>

      {/* Security Info */}
      <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
              Security Notice
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              Keys are securely encrypted. Use "View" to decrypt and copy when needed.
            </p>
          </div>
        </div>
      </div>

      {/* Keys List */}
      {apiKeys.length === 0 ? (
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="py-12 px-8 text-center">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Key className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              No API keys yet
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto leading-relaxed">
              Create your first project to generate an API key automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((apiKey: APIKey) => (
            <Card key={apiKey.id} className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-sm dark:hover:shadow-gray-900/20 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {apiKey.name}
                        </h3>
                        {apiKey.legacy && (
                          <Badge 
                            variant="outline"
                            className="text-xs px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                          >
                            Legacy
                          </Badge>
                        )}
                        <Badge 
                          variant="outline"
                          className={apiKey.is_active ? 
                            "text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800" : 
                            "text-xs px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                          }
                        >
                          {apiKey.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-2">
                        <span className="font-mono tracking-wider">{apiKey.masked_key}</span>
                      </div>

                      {apiKey.full_key && (
                        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                          <Input
                            type={showFullKey ? 'text' : 'password'}
                            value={apiKey.full_key}
                            readOnly
                            className="font-mono min-w-[700px] w-full text-xs h-7 pr-10 bg-transparent border-none p-0 text-gray-900 dark:text-gray-100 focus-visible:ring-0"
                          />
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullKey(!showFullKey)}
                              className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              {showFullKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyKey(apiKey.full_key || '')}
                              className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {copiedKey && (
                        <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                          Copied to clipboard
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Created {formatDate(apiKey.created_at)}</span>
                        </div>
                        {apiKey.last_used && (
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span>Last used {formatRelativeTime(apiKey.last_used)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!apiKey.legacy ? (
                      // New system key - can be viewed
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewFullKey(apiKey)}
                              disabled={viewingKey === apiKey.id}
                              className="h-7 px-2 text-gray-500 dark:text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                            >
                              {viewingKey === apiKey.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">View full key</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      // Legacy key - cannot be viewed
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="h-7 px-2 text-gray-400 dark:text-gray-500"
                            >
                              <Shield className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Legacy key - cannot be viewed</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRegenerateConfirm(apiKey)}
                            disabled={regeneratingKey === apiKey.id}
                            className="h-7 px-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                          >
                            {regeneratingKey === apiKey.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {apiKey.legacy ? 'Regenerate and migrate to new system' : 'Regenerate key'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Key Dialog */}
      <Dialog open={showViewKeyDialog !== null} onOpenChange={() => setShowViewKeyDialog(null)}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">API Key</DialogTitle>
                <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Copy this key for your applications.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {showViewKeyDialog && (
            <div className="py-4">
              <div className="relative">
                <Input
                  type={showFullKey ? 'text' : 'password'}
                  value={showViewKeyDialog.full_key || ''}
                  readOnly
                  className="font-mono text-xs h-9 pr-16 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullKey(!showFullKey)}
                    className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showFullKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyKey(showViewKeyDialog.full_key || '')}
                    className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {copiedKey && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Copied to clipboard
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowViewKeyDialog(null)
                setShowFullKey(false)
                setCopiedKey(false)
              }}
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Success Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Key regenerated successfully</DialogTitle>
                <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Your new API key is ready. The old key has been invalidated.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {newKeyData && (
            <div className="py-4">
              <div className="relative">
                <Input
                  type={showFullKey ? 'text' : 'password'}
                  value={newKeyData.full_key || ''}
                  readOnly
                  className="font-mono text-xs h-9 pr-16 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFullKey(!showFullKey)}
                    className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showFullKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyKey(newKeyData.full_key || '')}
                    className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {copiedKey && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Copied to clipboard
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowNewKeyDialog(false)
                setNewKeyData(null)
                setShowFullKey(false)
                setCopiedKey(false)
              }}
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirm */}
      <Dialog open={showRegenerateConfirm !== null} onOpenChange={() => setShowRegenerateConfirm(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Regenerate key</DialogTitle>
                <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  This will immediately invalidate the current key.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Applications using this API key will lose access until updated with the new key.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRegenerateConfirm(null)}
              className="h-8 px-3 text-xs border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateKey}
              disabled={regeneratingKey !== null}
              className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {regeneratingKey ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3 mr-1.5" />
              )}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ApiKeys