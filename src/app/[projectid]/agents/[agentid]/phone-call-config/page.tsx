// src/app/[projectid]/agents/[agentid]/phone-call-config/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneCall, Loader2, AlertCircle, CheckCircle, Phone, Clock } from 'lucide-react'

interface Agent {
  id: string
  name: string
  agent_type: string
  is_active: boolean
}

interface DispatchResponse {
  status: string
  room_name?: string
  dispatch_id?: string
  phone_number?: string
}

const COUNTRIES = [
  { code: 'US', name: 'United States', prefix: '+1', placeholder: '(555) 123-4567', flag: '🇺🇸' },
  { code: 'IN', name: 'India', prefix: '+91', placeholder: '98765 43210', flag: '🇮🇳' }
]

export default function PhoneCallConfig() {
  const params = useParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('US')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAgent, setIsLoadingAgent] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [recentCalls, setRecentCalls] = useState<DispatchResponse[]>([])

  const agentId = params.agentid as string
  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0]

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setIsLoadingAgent(true)
        const response = await fetch(`/api/agents/${agentId}`)
        if (response.ok) {
          const agentData = await response.json()
          setAgent(agentData)
        }
      } catch (error) {
        console.error('Error fetching agent:', error)
      } finally {
        setIsLoadingAgent(false)
      }
    }

    if (agentId) {
      fetchAgent()
    }
  }, [agentId])

  const handleDispatchCall = async () => {
    if (!agent || !phoneNumber.trim()) return

    const cleaned = phoneNumber.replace(/\D/g, '')
    if (cleaned.length < 10) {
      setMessage('Please enter a valid phone number')
      setMessageType('error')
      return
    }

    setIsLoading(true)
    setMessage('')
    setMessageType('')

    try {
      const formattedNumber = `${currentCountry.prefix}${cleaned}`
      
      const response = await fetch('/api/agents/dispatch-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agent.name,
          phone_number: formattedNumber,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(`Call dispatched successfully to ${formattedNumber}`)
        setMessageType('success')
        setRecentCalls(prev => [{ ...result, phone_number: formattedNumber }, ...prev.slice(0, 4)])
        setPhoneNumber('')
      } else {
        setMessage(result.error || 'Failed to dispatch call')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('Failed to dispatch call')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d\s\-\(\)]/g, '')
    setPhoneNumber(value)
    if (message) {
      setMessage('')
      setMessageType('')
    }
  }

  if (isLoadingAgent) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
          <span className="text-gray-700 dark:text-gray-300">Loading agent...</span>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Agent Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">The requested agent could not be loaded.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-6">
              <Phone className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Dispatch Call
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              Make an outbound call with <span className="font-medium text-gray-900 dark:text-gray-100">{agent.name}</span>
            </p>
            
            {/* Agent Status */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {agent.is_active ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">Active</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Inactive</span>
                </>
              )}
            </div>
          </div>

          {/* Main Form */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="space-y-6">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Country
                </label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {COUNTRIES.map((country) => (
                      <SelectItem 
                        key={country.code} 
                        value={country.code}
                        className="text-gray-900 dark:text-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{country.flag}</span>
                          <span>{country.name}</span>
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">
                            {country.prefix}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Phone Number Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Phone Number
                </label>
                <div className="flex">
                  <div className="flex items-center px-4 bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg">
                    <span className="text-sm font-mono text-gray-700 dark:text-gray-300 font-medium">
                      {currentCountry.prefix}
                    </span>
                  </div>
                  <Input
                    type="tel"
                    placeholder={currentCountry.placeholder}
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    className="rounded-l-none bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 h-12 text-base font-mono focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Message Display */}
              {message && (
                <div className={`p-4 rounded-lg border ${
                  messageType === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {messageType === 'success' ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{message}</span>
                  </div>
                </div>
              )}

              {/* Dispatch Button */}
              <Button 
                onClick={handleDispatchCall}
                disabled={isLoading || !phoneNumber.trim() || !agent.is_active}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium text-base"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dispatching Call...
                  </>
                ) : (
                  <>
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Dispatch Call
                  </>
                )}
              </Button>

              {!agent.is_active && (
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                  Agent must be active to dispatch calls
                </p>
              )}
            </div>
          </div>

          {/* Recent Calls */}
          {recentCalls.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Recent Calls
              </h3>
              <div className="space-y-3">
                {recentCalls.map((call, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {call.phone_number || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {call.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Just now</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}