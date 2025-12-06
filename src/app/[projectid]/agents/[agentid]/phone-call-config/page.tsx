'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PhoneCall, Loader2, AlertCircle, CheckCircle, Phone, Clock, History, Trash2, RotateCcw, Settings, Delete, PhoneOff, Pencil, Check, X } from 'lucide-react'

interface Agent {
  id: string
  name: string
  agent_type: string
  is_active: boolean
}

interface RunningAgent {
  agent_name: string
  pid: number
  status: string
}

interface PhoneNumber {
  id: string
  phone_number: string
  formatted_number: string | null
  provider: string | null
  trunk_id: string | null
  country_code: string | null
  status: string
  trunk_direction: string
  project_id: string | null
  project_name: string | null
}

interface CallRecord {
  id: string
  to_phone_number: string
  country_code: string
  from_phone_number_id: string
  from_phone_display: string
  timestamp: number
  status: string
  formatted_number: string
  name: string
  call_count?: number
}

const COUNTRIES = [
  { code: 'US', name: 'United States', prefix: '+1', placeholder: '(555) 123-4567', flag: '🇺🇸' },
  { code: 'IN', name: 'India', prefix: '+91', placeholder: '98765 43210', flag: '🇮🇳' }
]

const STORAGE_KEY = 'phone_call_history'
const HISTORY_LIMIT_KEY = 'phone_call_history_limit'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export default function PhoneCallConfig() {
  const params = useParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [runningAgents, setRunningAgents] = useState<RunningAgent[]>([])
  const [isCheckingRunning, setIsCheckingRunning] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('US')
  const [fromPhoneNumberId, setFromPhoneNumberId] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAgent, setIsLoadingAgent] = useState(true)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
   const [callHistory, setCallHistory] = useState<CallRecord[]>([])
  const [historyLimit, setHistoryLimit] = useState<number>(10)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [showDialer, setShowDialer] = useState(false)
  const [editingCallId, setEditingCallId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [callCounter, setCallCounter] = useState(1)

  const agentId = params.agentid as string
  const projectId = params.projectid as string
  const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0]

  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY}_${agentId}`)
        const limit = localStorage.getItem(`${HISTORY_LIMIT_KEY}_${agentId}`)
        const counter = localStorage.getItem(`phone_call_counter_${agentId}`)
        
        if (limit) {
          setHistoryLimit(parseInt(limit))
        }
        
        if (counter) {
          setCallCounter(parseInt(counter))
        }
        
        if (stored) {
          const parsed: CallRecord[] = JSON.parse(stored)
          const now = Date.now()
          const filtered = parsed.filter(call => (now - call.timestamp) < SEVEN_DAYS_MS)
          setCallHistory(filtered)
          
          if (filtered.length !== parsed.length) {
            localStorage.setItem(`${STORAGE_KEY}_${agentId}`, JSON.stringify(filtered))
          }
        }
      } catch (error) {
        console.error('Error loading call history:', error)
      }
    }
    
    if (agentId) {
      loadHistory()
    }
  }, [agentId])

  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        setLoadingPhoneNumbers(true)
        const response = await fetch(`/api/calls/phone-numbers/?limit=100`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch phone numbers')
        }

        const data: PhoneNumber[] = await response.json()
        
        const filtered = data.filter(phone => 
          phone.project_id === projectId && 
          phone.trunk_direction === 'outbound' &&
          phone.status === 'active'
        )
        setPhoneNumbers(filtered)
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
        setPhoneNumbers([])
      } finally {
        setLoadingPhoneNumbers(false)
      }
    }

    if (projectId) {
      fetchPhoneNumbers()
    }
  }, [projectId])

  const updateHistoryLimit = (limit: number) => {
    setHistoryLimit(limit)
    localStorage.setItem(`${HISTORY_LIMIT_KEY}_${agentId}`, limit.toString())
    
    if (callHistory.length > limit) {
      const trimmed = callHistory.slice(0, limit)
      setCallHistory(trimmed)
      localStorage.setItem(`${STORAGE_KEY}_${agentId}`, JSON.stringify(trimmed))
    }
  }

  const getRunningAgentName = (agent: Agent, runningAgents: RunningAgent[]): { isRunning: boolean; agentName: string | null } => {
    if (agent.agent_type !== 'pype_agent' || !runningAgents.length) {
      return { isRunning: false, agentName: null }
    }

    const sanitizedAgentId = agent.id.replace(/-/g, '_')
    const newFormat = `${agent.name}_${sanitizedAgentId}`
    let runningAgent = runningAgents.find(ra => ra.agent_name === newFormat)
    
    if (runningAgent) {
      return { isRunning: true, agentName: newFormat }
    }
    
    runningAgent = runningAgents.find(ra => ra.agent_name === agent.name)
    
    if (runningAgent) {
      return { isRunning: true, agentName: agent.name }
    }
    
    return { isRunning: false, agentName: null }
  }

  const fetchRunningAgents = async () => {
    try {
      setIsCheckingRunning(true)
      const response = await fetch('/api/agents/running_agents')
      if (response.ok) {
        const data = await response.json()
        setRunningAgents(data || [])
      } else {
        setRunningAgents([])
      }
    } catch (error) {
      console.error('Error fetching running agents:', error)
      setRunningAgents([])
    } finally {
      setIsCheckingRunning(false)
    }
  }

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

  useEffect(() => {
    if (agent && agent.agent_type === 'pype_agent') {
      fetchRunningAgents()
    }
  }, [agent])

  const handleDispatchCall = async () => {
    if (!agent || !phoneNumber.trim()) return

    const cleaned = phoneNumber.replace(/\D/g, '')
    if (cleaned.length < 10) {
      setMessage('Please enter a valid phone number')
      setMessageType('error')
      return
    }

    if (!fromPhoneNumberId.trim()) {
      setMessage('Please select a phone number to call from')
      setMessageType('error')
      return
    }

    const selectedPhone = phoneNumbers.find(p => p.id === fromPhoneNumberId)
    if (!selectedPhone || !selectedPhone.trunk_id || !selectedPhone.provider) {
      setMessage('Selected phone number is missing trunk ID or provider')
      setMessageType('error')
      return
    }

    const { isRunning, agentName } = getRunningAgentName(agent, runningAgents)

    if (!isRunning || !agentName) {
      setMessage('Agent is not currently running. Please start the agent first.')
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
          agent_name: agentName,
          phone_number: formattedNumber,
          sip_trunk_id: selectedPhone.trunk_id,
          provider: selectedPhone.provider,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        const successMessage = `Call dispatched successfully to ${formattedNumber}`
        setMessage(successMessage)
        setMessageType('success')
        toast.success(successMessage)
        
        const existingCallIndex = callHistory.findIndex(
          call => call.to_phone_number === cleaned && 
                  call.country_code === selectedCountry &&
                  call.from_phone_number_id === fromPhoneNumberId
        )

        let updatedHistory: CallRecord[]

        if (existingCallIndex !== -1) {
          // Update existing call: move to top and increment count
          const existingCall = callHistory[existingCallIndex]
          const updatedCall: CallRecord = {
            ...existingCall,
            timestamp: Date.now(),
            status: result.status || 'dispatched',
            call_count: (existingCall.call_count || 1) + 1
          }
          
          // Remove old entry and add updated one at the top
          const filteredHistory = callHistory.filter((_, index) => index !== existingCallIndex)
          updatedHistory = [updatedCall, ...filteredHistory].slice(0, historyLimit)
        } else {
          // New call entry
          const newCall: CallRecord = {
            id: `${Date.now()}-${Math.random()}`,
            to_phone_number: cleaned,
            country_code: selectedCountry,
            from_phone_number_id: fromPhoneNumberId,
            from_phone_display: selectedPhone.formatted_number || selectedPhone.phone_number,
            timestamp: Date.now(),
            status: result.status || 'dispatched',
            formatted_number: formattedNumber,
            name: callCounter.toString(),
            call_count: 1
          }
          
          const nextCounter = callCounter + 1
          setCallCounter(nextCounter)
          localStorage.setItem(`phone_call_counter_${agentId}`, nextCounter.toString())
          
          updatedHistory = [newCall, ...callHistory].slice(0, historyLimit)
        }

        setCallHistory(updatedHistory)
        localStorage.setItem(`${STORAGE_KEY}_${agentId}`, JSON.stringify(updatedHistory))
        
        setPhoneNumber('')
        setFromPhoneNumberId('')
        setSelectedCallId(null)
      } else {
        // Handle errors with toast notification
        let errorMessage = 'Failed to dispatch call'
        
        // Extract error message from response
        if (result.error) {
          if (typeof result.error === 'string') {
            errorMessage = result.error
          } else if (result.error.message) {
            errorMessage = result.error.message
          }
        } else if (result.message) {
          if (typeof result.message === 'string') {
            errorMessage = result.message
          }
        }
        
        // Handle 429 rate limit errors specifically
        if (response.status === 429) {
          if (result.current_calls !== undefined && result.max_calls !== undefined) {
            errorMessage = `Rate limit exceeded. Current calls: ${result.current_calls}/${result.max_calls}. Please try again later.`
          } else {
            errorMessage = 'Rate limit exceeded. Please try again later.'
          }
        }
        
        setMessage(errorMessage)
        setMessageType('error')
        toast.error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to dispatch call'
      setMessage(errorMessage)
      setMessageType('error')
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }


  const startEditingName = (callId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCallId(callId)
    setEditingName(currentName)
  }

  const saveEditedName = (callId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    const trimmedName = editingName.trim()
    if (!trimmedName) {
      cancelEditingName(e)
      return
    }
    
    const updated = callHistory.map(call => 
      call.id === callId ? { ...call, name: trimmedName } : call
    )
    setCallHistory(updated)
    localStorage.setItem(`${STORAGE_KEY}_${agentId}`, JSON.stringify(updated))
    setEditingCallId(null)
    setEditingName('')
  }

  const cancelEditingName = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingCallId(null)
    setEditingName('')
  }

  const handleNameKeyDown = (callId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditedName(callId)
    } else if (e.key === 'Escape') {
      cancelEditingName()
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

  const handleDialerClick = (digit: string) => {
    setPhoneNumber(prev => prev + digit)
    if (message) {
      setMessage('')
      setMessageType('')
    }
  }

  const handleDialerBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1))
  }

  const loadCallFromHistory = (call: CallRecord) => {
    setPhoneNumber(call.to_phone_number)
    setSelectedCountry(call.country_code)
    setFromPhoneNumberId(call.from_phone_number_id)
    setSelectedCallId(call.id)
    setMessage('')
    setMessageType('')
  }

  const deleteCallFromHistory = (callId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = callHistory.filter(call => call.id !== callId)
    setCallHistory(updated)
    localStorage.setItem(`${STORAGE_KEY}_${agentId}`, JSON.stringify(updated))
    
    if (selectedCallId === callId) {
      setPhoneNumber('')
      setFromPhoneNumberId('')
      setSelectedCallId(null)
    }
  }

  const clearAllHistory = () => {
    setCallHistory([])
    localStorage.removeItem(`${STORAGE_KEY}_${agentId}`)
    setPhoneNumber('')
    setFromPhoneNumberId('')
    setSelectedCallId(null)
  }

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (isLoadingAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Loading agent...</span>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Agent Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">The requested agent could not be loaded.</p>
        </div>
      </div>
    )
  }

  const runningStatus = getRunningAgentName(agent, runningAgents)

  const dialerButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="flex h-screen">
        <div className="w-[45%] border-r border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="p-8 flex-1 flex flex-col overflow-y-auto">
            <div className="mb-6 flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg shadow-blue-500/20">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Dispatch Call
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  with <span className="font-semibold text-gray-900 dark:text-gray-100">{agent.name}</span>
                </p>
              </div>
            </div>

            <div className="mb-5">
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isCheckingRunning 
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                  : agent.agent_type === 'pype_agent'
                    ? runningStatus.isRunning
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : agent.is_active
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}>
                {isCheckingRunning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-400">Checking...</span>
                  </>
                ) : agent.agent_type === 'pype_agent' ? (
                  runningStatus.isRunning ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">Running</span>
                    </>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                      <span className="text-xs font-semibold text-red-700 dark:text-red-400">Stopped</span>
                    </>
                  )
                ) : agent.is_active ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Inactive</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-5 flex-1 w-full">
              <div className='w-full'>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Calling From <span className="text-red-500">*</span>
                </label>
                {loadingPhoneNumbers ? (
                  <div className="h-12 w-full flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : phoneNumbers.length === 0 ? (
                  <div className="h-12 flex items-center px-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                    <span className="text-sm text-gray-500 dark:text-gray-400">No outbound phone numbers available</span>
                  </div>
                ) : (
                  <Select value={fromPhoneNumberId} onValueChange={setFromPhoneNumberId}>
                    <SelectTrigger className="h-12 w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                      <SelectValue placeholder="Select your outbound number" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      {phoneNumbers.map((phone) => (
                        <SelectItem 
                          key={phone.id} 
                          value={phone.id}
                          className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {phone.formatted_number || phone.phone_number}
                            </span>
                            {phone.provider && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({phone.provider})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex gap-4 items-center">
                    Calling To <span className="text-red-500">*</span>
                    <button
                      onClick={() => setShowDialer(!showDialer)}
                      className={`h-7 w-7 flex items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 ${
                        showDialer
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                      title={showDialer ? 'Hide dialer' : 'Show dialer'}
                    >
                      {showDialer ? (
                        <PhoneOff className="w-4 h-4" />
                      ) : (
                        <PhoneCall className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </label>
                <div className="flex gap-2">
                  <div className="flex h-12 flex-1">
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="w-[100px] h-full bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-r-none rounded-l-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        {COUNTRIES.map((country) => (
                          <SelectItem 
                            key={country.code} 
                            value={country.code}
                            className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{country.flag}</span>
                              <span className="font-mono text-xs font-semibold">{country.prefix}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="tel"
                      placeholder={currentCountry.placeholder}
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="flex-1 rounded-l-none rounded-r-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-base font-mono focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  

                </div>
              </div>

              {showDialer && (
                <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-inner">
                  <div className="grid grid-cols-3 gap-2">
                    {dialerButtons.map(({ digit, letters }) => (
                      <button
                        key={digit}
                        onClick={() => handleDialerClick(digit)}
                        className="group relative h-11 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/30 dark:hover:to-blue-800/30 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {digit}
                          </span>
                          {letters && (
                            <span className="text-[8px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 tracking-wide">
                              {letters}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={handleDialerBackspace}
                    disabled={!phoneNumber}
                    className="mt-2 w-full h-10 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/30 dark:hover:to-red-800/30 rounded-lg border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-50 disabled:hover:to-red-100 dark:disabled:hover:from-red-900/20 dark:disabled:hover:to-red-800/20 active:scale-95 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <Delete className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-semibold text-red-700 dark:text-red-400">Backspace</span>
                  </button>
                </div>
              )}

              {message && (
                <div className={`p-4 rounded-xl border backdrop-blur-sm transition-all ${
                  messageType === 'success' 
                    ? 'bg-green-50/80 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' 
                    : 'bg-red-50/80 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-3">
                    {messageType === 'success' ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{message}</span>
                  </div>
                </div>
              )}

              {agent.agent_type === 'pype_agent' && !runningStatus.isRunning && !isCheckingRunning && (
                <div className="p-4 rounded-xl border bg-yellow-50/80 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      Start the agent to dispatch calls
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <Button 
                onClick={handleDispatchCall}
                disabled={
                  isLoading || 
                  !phoneNumber.trim() || 
                  !fromPhoneNumberId.trim() ||
                  isCheckingRunning ||
                  (agent.agent_type === 'pype_agent' && !runningStatus.isRunning) ||
                  (agent.agent_type !== 'pype_agent' && !agent.is_active)
                }
                className="w-full h-13 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Dispatching Call...
                  </>
                ) : (
                  <>
                    <PhoneCall className="mr-2 h-5 w-5" />
                    Dispatch Call
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="w-[55%] flex flex-col bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm">
          <div className="p-8 pb-6 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Call History
                </h2>
              </div>
              {callHistory.length > 0 && (
                <Button
                  onClick={clearAllHistory}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Clear All
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3 mt-4">
              <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Store last</span>
              <Select value={historyLimit.toString()} onValueChange={(v) => updateHistoryLimit(parseInt(v))}>
                <SelectTrigger className="w-20 h-8 text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="5" className="text-sm">5</SelectItem>
                  <SelectItem value="10" className="text-sm">10</SelectItem>
                  <SelectItem value="15" className="text-sm">15</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600 dark:text-gray-400">calls for 7 days</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-6">
            {callHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <Phone className="w-10 h-10 text-gray-400 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Call History Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                  Your recent calls will appear here. Click on any call to quickly redial with the same settings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {callHistory.map((call) => (
                  <div
                    key={call.id}
                    onClick={() => loadCallFromHistory(call)}
                    className={`group relative p-5 rounded-xl border transition-all cursor-pointer ${
                      selectedCallId === call.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-md'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                    }`}
                  >
                    <button
                      onClick={(e) => deleteCallFromHistory(call.id, e)}
                      className={`absolute top-4 right-4 transition-opacity p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg z-10 ${
                        editingCallId === call.id ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>

                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        selectedCallId === call.id
                          ? 'bg-blue-100 dark:bg-blue-800/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Phone className={`w-6 h-6 ${
                          selectedCallId === call.id
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 pr-8">
                          {editingCallId === call.id ? (
                            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editingName || ''}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => handleNameKeyDown(call.id, e)}
                                className="h-7 text-sm font-semibold bg-white dark:bg-gray-700 border-blue-300 dark:border-blue-600"
                                placeholder="Enter name"
                                autoFocus
                              />
                              <button
                                onClick={(e) => saveEditedName(call.id, e)}
                                className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                              >
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                              <button
                                onClick={(e) => cancelEditingName(e)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                              >
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                {call.name}
                                {call.call_count && call.call_count > 1 && (
                                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                    ({call.call_count})
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={(e) => startEditingName(call.id, call.name, e)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-opacity"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              </button>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-mono font-medium text-gray-700 dark:text-gray-300">
                            {call.formatted_number}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                            {COUNTRIES.find(c => c.code === call.country_code)?.flag}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 dark:text-gray-400">From:</span>
                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{call.from_phone_display}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatRelativeTime(call.timestamp)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                            {call.status}
                          </span>
                        </div>
                      </div>

                      {selectedCallId === call.id && (
                        <div className="flex-shrink-0 mr-8">
                          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
                            <RotateCcw className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}