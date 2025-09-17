'use client'
import React, { useState } from 'react'
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

// Mock data structure
const mockApiKey = {
  id: 'ak_1234567890abcdef',
  name: 'Production Key',
  masked_key: 'pype_1234...cdef',
  created_at: '2024-01-15T10:30:00Z',
  last_used_at: '2024-01-20T14:22:00Z',
  usage_count: 1247,
  is_active: true
}

interface APIKey {
  id: string
  name: string
  masked_key: string
  created_at: string
  last_used_at: string | null
  usage_count: number
  is_active: boolean
  full_key?: string
}

const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([mockApiKey])
  const [loading, setLoading] = useState<boolean>(false)
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<APIKey | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<APIKey | null>(null)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState<boolean>(false)
  const [newKeyData, setNewKeyData] = useState<APIKey | null>(null)
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState<string>('')
  const [copiedKey, setCopiedKey] = useState<boolean>(false)
  const [showNewKey, setShowNewKey] = useState<boolean>(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
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

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return
    
    setLoading(true)
    
    setTimeout(() => {
      const newKey: APIKey = {
        id: 'ak_' + Math.random().toString(36).substr(2, 16),
        name: newKeyName,
        full_key: 'pype_' + Math.random().toString(36).substr(2, 40),
        masked_key: 'pype_' + Math.random().toString(36).substr(2, 4) + '...' + Math.random().toString(36).substr(2, 4),
        created_at: new Date().toISOString(),
        last_used_at: null,
        usage_count: 0,
        is_active: true
      }
      
      setApiKeys([...apiKeys, newKey])
      setNewKeyData(newKey)
      setShowCreateDialog(false)
      setShowNewKeyDialog(true)
      setNewKeyName('')
      setLoading(false)
    }, 1000)
  }

  const handleRegenerateKey = (keyId: string) => {
    setRegeneratingKey(keyId)
    
    setTimeout(() => {
      const updatedKeys = apiKeys.map(key => {
        if (key.id === keyId) {
          return {
            ...key,
            full_key: 'pype_' + Math.random().toString(36).substr(2, 40),
            masked_key: 'pype_' + Math.random().toString(36).substr(2, 4) + '...' + Math.random().toString(36).substr(2, 4),
            created_at: new Date().toISOString()
          }
        }
        return key
      })
      
      setApiKeys(updatedKeys)
      const updatedKey = updatedKeys.find(k => k.id === keyId)
      if (updatedKey) {
        setNewKeyData(updatedKey)
      }
      setShowRegenerateConfirm(null)
      setShowNewKeyDialog(true)
      setRegeneratingKey(null)
    }, 1000)
  }

  const handleDeleteKey = (keyId: string) => {
    setDeletingKey(keyId)
    
    setTimeout(() => {
      setApiKeys(apiKeys.filter(key => key.id !== keyId))
      setShowDeleteConfirm(null)
      setDeletingKey(null)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            API Keys
          </h1>
          {/* <Button 
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Plus className="w-3 h-3 mr-1.5" />
            New key
          </Button> */}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Manage API keys for secure programmatic access to this agent. Keys are hashed and cannot be retrieved after creation.
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
              Keys are displayed only once after creation. Store them securely and regenerate if compromised.
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
              Create your first API key to start integrating with this agent programmatically.
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Create key
            </Button>
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
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
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
                          <p className="text-xs">Regenerate key</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {/* <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(apiKey)}
                      disabled={deletingKey === apiKey.id}
                      className="h-7 px-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      {deletingKey === apiKey.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button> */}
                  </div>
                </div>

                {/* Metadata */}
                {/* <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Created {formatDate(apiKey.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Last used {formatRelativeTime(apiKey.last_used_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{apiKey.usage_count.toLocaleString()} requests</span>
                  </div>
                </div> */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Create API key</DialogTitle>
            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Choose a descriptive name to help identify this key later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., Production key, Development access"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="h-9 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setNewKeyName('')
              }}
              className="h-8 px-3 text-xs border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={!newKeyName.trim() || loading}
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-3 h-3 mr-1.5" />
              )}
              Create key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Your API key is ready</DialogTitle>
                <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Copy this key now — you won't be able to see it again.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {newKeyData && (
            <div className="py-4">
              <div className="relative">
                <Input
                  type={showNewKey ? 'text' : 'password'}
                  value={newKeyData.full_key || ''}
                  readOnly
                  className="font-mono text-xs h-9 pr-16 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showNewKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
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
                setShowNewKey(false)
                setCopiedKey(false)
              }}
              className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              I've saved it
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
              Applications using <span className="font-medium text-gray-900 dark:text-gray-100">"{showRegenerateConfirm?.name}"</span> will lose access until updated with the new key.
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
              onClick={() => showRegenerateConfirm && handleRegenerateKey(showRegenerateConfirm.id)}
              disabled={regeneratingKey === showRegenerateConfirm?.id}
              className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {regeneratingKey === showRegenerateConfirm?.id ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3 mr-1.5" />
              )}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete key</DialogTitle>
                <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-900 dark:text-gray-100">"{showDeleteConfirm?.name}"</span> will be permanently deleted and any applications using it will lose access immediately.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(null)}
              className="h-8 px-3 text-xs border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteKey(showDeleteConfirm.id)}
              disabled={deletingKey === showDeleteConfirm?.id}
              className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingKey === showDeleteConfirm?.id ? (
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3 mr-1.5" />
              )}
              Delete key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ApiKeys