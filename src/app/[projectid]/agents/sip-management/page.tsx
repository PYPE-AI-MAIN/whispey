// src/app/[projectid]/agents/sip-management/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Phone, 
  Search,
  Clock,
  Bot,
  X,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import PhoneRequestDialog from '@/components/sip-management/PhoneRequestDialog'

interface PhoneAgent {
  id: string
  name: string
  status: string
  created_at: string
  phone_number: string
}

interface Agent {
  id: string
  name: string
  agent_type?: string
}

interface PhoneNumbersResponse {
  usage: {
    active_count: number
  }
  agents: PhoneAgent[]
  limits: {
    max_agents: number
  }
  last_updated: string
}

export default function SimplifiedSipManagement() {
  const params = useParams()
  const projectId = params.projectid as string

  const [phoneAgents, setPhoneAgents] = useState<PhoneAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPhoneRequest, setShowPhoneRequest] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch phone numbers from the API with project ID
      const phoneResponse = await fetch(`/api/phone-numbers/list?project_id=${projectId}`)

      if (!phoneResponse.ok) {
        const errorData = await phoneResponse.json()
        throw new Error(errorData.error || 'Failed to fetch phone numbers')
      }

      const phoneData: PhoneNumbersResponse = await phoneResponse.json()
      setPhoneAgents(phoneData.agents || [])

    } catch (err) {
      setError('Failed to load phone configuration')
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      })
    }
  }

  const cleanAgentName = (name: string) => {
    // UUID pattern with underscores (8_4_4_4_12 format)
    const uuidPattern = /_[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$/i
    
    // Check if the name ends with a UUID pattern
    if (uuidPattern.test(name)) {
      // Remove the UUID suffix (including the underscore before it)
      return name.replace(uuidPattern, '')
    }
    
    // Return the name as-is if no UUID pattern found
    return name
  }

  const handleRequestPhone = (agentId: string, agentName: string) => {
    setSelectedAgent({ id: agentId, name: agentName })
    setShowPhoneRequest(true)
  }

  const filteredAgents = phoneAgents.filter(phoneAgent => {
    const matchesSearch = !searchQuery || 
      phoneAgent.phone_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phoneAgent.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading Phone Settings...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Phone Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage phone numbers and assignments
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{phoneAgents.length}</div>
              <div className="text-gray-500 dark:text-gray-400">Total Numbers</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {phoneAgents.filter(p => p.status === 'active').length}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-red-800 dark:text-red-400 flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError('')} className="h-4 w-4 p-0 text-red-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="mx-4 mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-green-800 dark:text-green-400 flex-1">{success}</span>
            <Button variant="ghost" size="sm" onClick={() => setSuccess('')} className="h-4 w-4 p-0 text-green-400 hover:text-green-600">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {filteredAgents.length !== 0 && <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search phone numbers or agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>}

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
            <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            {searchQuery ? 'No phone numbers match your search' : 'No agents created yet'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-sm">
            {searchQuery 
              ? 'Try adjusting your search criteria'
              : 'Create an agent with Pype then request for numbers!'
            }
          </p>
          {searchQuery && (
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="text-xs h-7">
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="p-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                <div>Number</div>
                <div>Assigned Agent Name</div>
                <div>Last Updated</div>
                <div>Actions</div>
              </div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAgents.map((phoneAgent) => {
                return (
                  <div
                    key={phoneAgent.id}
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="grid grid-cols-4 gap-4 items-center">
                      {/* Phone Number */}
                      <div>
                        <Badge variant="outline" className="text-sm font-mono">
                          {phoneAgent.phone_number}
                        </Badge>
                      </div>
                      
                      {/* Assigned Agent */}
                      <div>
                        {phoneAgent.name ? (
                          <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={phoneAgent.name}>
                              {cleanAgentName(phoneAgent.name)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                            Unassigned
                          </span>
                        )}
                      </div>
                      
                      {/* Last Updated */}
                      <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate max-w-[150px]" title={formatDate(phoneAgent.created_at)}>
                            {formatDate(phoneAgent.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        {!phoneAgent.phone_number && phoneAgent.name && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRequestPhone(phoneAgent.id, phoneAgent.name)}
                            className="h-7 text-xs"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Request Number
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      </div>

      <PhoneRequestDialog
        isOpen={showPhoneRequest}
        onClose={() => {
          setShowPhoneRequest(false)
          setSelectedAgent(null)
        }}
        onSuccess={() => {
          loadData()
          setSelectedAgent(null)
        }}
        agentId={selectedAgent?.id}
        agentName={selectedAgent?.name}
      />
    </div>
  )
}