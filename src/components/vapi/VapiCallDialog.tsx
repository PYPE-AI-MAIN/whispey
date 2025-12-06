import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Phone, Loader2, AlertCircle, CheckCircle, Flag, User, Building, Monitor, Globe } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WebCallWidget } from './WebCallWidget'

interface CallDialogProps {
  assistantName: string
  agentId: string
  vapiAssistantId: string
}

interface CountryCode {
  code: string
  flag: string
  name: string
  digits: number
  placeholder: string
  format: (value: string) => string
}

interface PhoneNumber {
  id: string
  number: string
  provider: string
  assistantId: string | null
  name: string | null
  createdAt: string
  updatedAt: string
}

const COUNTRY_CODES: CountryCode[] = [
  {
    code: '+1',
    flag: '🇺🇸',
    name: 'United States',
    digits: 10,
    placeholder: '(555) 123-4567',
    format: (value: string) => {
      const digits = value.replace(/\D/g, '')
      if (digits.length <= 3) return digits
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }
  },
  {
    code: '+91',
    flag: '🇮🇳',
    name: 'India',
    digits: 10,
    placeholder: '98765 43210',
    format: (value: string) => {
      const digits = value.replace(/\D/g, '')
      if (digits.length <= 5) return digits
      return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`
    }
  }
]

const CallDialog: React.FC<CallDialogProps> = ({ agentId, assistantName, vapiAssistantId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle')
  const [callId, setCallId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [availablePhoneNumbers, setAvailablePhoneNumbers] = useState<PhoneNumber[]>([])
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('')
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false)
  const [phoneNumberError, setPhoneNumberError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'phone' | 'web'>('phone')

  useEffect(() => {
    if (isOpen) {
      fetchPhoneNumbers()
    }
  }, [isOpen])

  const fetchPhoneNumbers = async () => {
    setLoadingPhoneNumbers(true)
    setPhoneNumberError(null)
    
    try {
      console.log(`Fetching phone numbers for Vapi assistant ID: ${vapiAssistantId}`)
      console.log(`Using agent ID: ${agentId}`)
      
      const url = `/api/agents/${agentId}/vapi/phone-numbers?assistantId=${vapiAssistantId}`
      console.log(`Calling endpoint: ${url}`)
      
      const response = await fetch(url)
      const result = await response.json()
      
      console.log(`Response status: ${response.status}`)
      console.log(`Response data:`, result)
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch phone numbers')
      }
      
      setAvailablePhoneNumbers(result.phoneNumbers || [])
      
      if (result.phoneNumbers && result.phoneNumbers.length > 0) {
        setSelectedPhoneNumberId(result.phoneNumbers[0].id)
      }
      
      console.log(`Fetched ${result.phoneNumbers?.length || 0} phone numbers for assistant ${vapiAssistantId}:`, result.phoneNumbers)
    } catch (err) {
      console.error('Error fetching phone numbers:', err)
      setPhoneNumberError(err instanceof Error ? err.message : 'Failed to fetch phone numbers')
    } finally {
      setLoadingPhoneNumbers(false)
    }
  }

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = selectedCountry.format(e.target.value)
    setPhoneNumber(formatted)
  }

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRY_CODES.find(c => c.code === countryCode)
    if (country) {
      setSelectedCountry(country)
      setPhoneNumber('')
    }
  }

  const validatePhoneNumber = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '')
    return digits.length === selectedCountry.digits
  }

  const getSelectedPhoneNumber = (): PhoneNumber | null => {
    return availablePhoneNumbers.find(num => num.id === selectedPhoneNumberId) || null
  }

  const formatPhoneNumber = (number: string) => {
    if (number.startsWith('+1')) {
      const digits = number.slice(2)
      if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      }
    } else if (number.startsWith('+91')) {
      const digits = number.slice(3)
      if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
      }
    }
    return number
  }

  const initiateCall = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number')
      return
    }

    if (!selectedPhoneNumberId) {
      setError('Please select a phone number to call from')
      return
    }

    setIsLoading(true)
    setError(null)
    setCallStatus('connecting')

    try {
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '')
      const formattedNumber = `${selectedCountry.code}${cleanPhoneNumber}`

      const callData = {
        type: 'outboundPhoneCall',
        assistantId: vapiAssistantId,
        phoneNumberId: selectedPhoneNumberId,
        customer: {
          number: formattedNumber,
        },
        ...(customMessage && {
          assistantOverrides: {
            firstMessage: customMessage
          }
        })
      }

      console.log('Initiating call with data:', callData)
      console.log('Using Vapi assistant ID:', vapiAssistantId)
      console.log('Using database agent ID for API:', agentId)

      const response = await fetch(`/api/agents/${agentId}/vapi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_call',
          ...callData
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        let errorMessage = 'Failed to initiate call'
        
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
        
        throw new Error(errorMessage)
      }

      setCallId(result.call?.id || result.data?.id || 'Unknown')
      setCallStatus('success')
      console.log('Call initiated successfully:', result)
      toast.success('Call initiated successfully')

    } catch (err) {
      console.error('Error initiating call:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate call'
      setError(errorMessage)
      setCallStatus('error')
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setPhoneNumber('')
    setCustomMessage('')
    setCallStatus('idle')
    setCallId(null)
    setError(null)
    setSelectedCountry(COUNTRY_CODES[0])
  }

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(handleReset, 300)
  }

  const selectedPhoneNum = getSelectedPhoneNumber()

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-300 dark:border-gray-600">
          <Phone className="w-4 h-4 mr-2" />
          Call
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Phone className="w-5 h-5" />
            Initiate Call
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Start an outbound call using "{assistantName}" assistant
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Vapi ID: {vapiAssistantId}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="phone" className="w-full" onValueChange={(value) => setActiveTab(value as 'phone' | 'web')}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800">
            <TabsTrigger value="phone" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900">
              <Phone className="h-4 w-4" />
              Phone Call
            </TabsTrigger>
            <TabsTrigger value="web" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900">
              <Monitor className="h-4 w-4" />
              Web Call
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone" className="space-y-4">
            {callStatus === 'idle' || callStatus === 'connecting' ? (
          <div className="space-y-4">
            {/* Phone Number Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Call From (Your Numbers) <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              
              {loadingPhoneNumbers ? (
                <div className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Loading phone numbers...</span>
                </div>
              ) : phoneNumberError ? (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">{phoneNumberError}</AlertDescription>
                </Alert>
              ) : availablePhoneNumbers.length === 0 ? (
                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <div className="space-y-2">
                      <p className="font-medium">No phone numbers connected to this assistant.</p>
                      <p className="text-sm">
                        To make calls, you need to connect a phone number to assistant "{assistantName}" in your Vapi dashboard.
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        Looking for Vapi assistant ID: {vapiAssistantId}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-red-300 dark:border-red-700"
                        onClick={() => window.open('https://dashboard.vapi.ai/phone-numbers', '_blank')}
                      >
                        Configure Phone Numbers
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                  <SelectTrigger className="w-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    <SelectValue>
                      {selectedPhoneNum ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatPhoneNumber(selectedPhoneNum.number)}</span>
                          </div>
                          <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-700">
                            {selectedPhoneNum.provider}
                          </Badge>
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">
                            <User className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        </div>
                      ) : (
                        'Select a phone number'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-48 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                    {availablePhoneNumbers.map((phoneNum) => (
                      <SelectItem key={phoneNum.id} value={phoneNum.id}>
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {formatPhoneNumber(phoneNum.number)}
                            </span>
                            <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-700">
                              {phoneNum.provider}
                            </Badge>
                            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">
                              <User className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Country Selection */}
            <div className="space-y-3">
              <Label htmlFor="country" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Country <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{selectedCountry.flag}</span>
                      <span className="text-gray-900 dark:text-gray-100">{selectedCountry.code}</span>
                      <span className="text-gray-500 dark:text-gray-400">({selectedCountry.name})</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                  {COUNTRY_CODES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag}</span>
                        <span className="text-gray-900 dark:text-gray-100">{country.code}</span>
                        <span className="text-gray-600 dark:text-gray-400">({country.name})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number Input */}
            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Call To (Customer Number) <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm">
                  <span className="text-lg">{selectedCountry.flag}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedCountry.code}</span>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={selectedCountry.placeholder}
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  maxLength={selectedCountry.code === '+91' ? 11 : 14}
                  className="flex-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter {selectedCountry.name} phone number ({selectedCountry.digits} digits)
              </p>
            </div>

            {/* Custom Message */}
            <div>
              <Label htmlFor="message" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Custom First Message (Optional)
              </Label>
              <Textarea
                id="message"
                placeholder="Override the default greeting message..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="mt-1 min-h-[80px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to use the assistant's default first message
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : callStatus === 'success' ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">Call Initiated Successfully!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Calling {selectedCountry.code} {phoneNumber}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                From: {selectedPhoneNum ? formatPhoneNumber(selectedPhoneNum.number) : 'Unknown'}
              </p>
              {callId && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
                  Call ID: {callId}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Call Failed</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{error}</p>
            </div>
          </div>
        )}

          </TabsContent>

          <TabsContent value="web" className="space-y-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Globe className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Web Call</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Start a browser-based voice conversation with {assistantName}
              </p>
            </div>
            
            <WebCallWidget
              agentId={agentId}
              assistantId={vapiAssistantId}
              agentName={assistantName}
              publicApiKey="64dc1d61-4156-42ea-aa75-fc86ff0f3ceb"
              onCallStart={(callId) => {
                console.log('Web call started in modal:', callId)
              }}
              onCallEnd={(callId, reason) => {
                console.log('Web call ended in modal:', callId, 'reason:', reason)
              }}
              onTranscript={(transcript, role) => {
                console.log('Web call transcript:', role, transcript)
              }}
              hideStartButton={false}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          {callStatus === 'idle' || callStatus === 'connecting' ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="border-gray-300 dark:border-gray-600"
              >
                Cancel
              </Button>
              {activeTab === 'phone' && (
                <Button
                  onClick={initiateCall}
                  disabled={
                    isLoading || 
                    !phoneNumber.trim() || 
                    !validatePhoneNumber(phoneNumber) ||
                    !selectedPhoneNumberId ||
                    availablePhoneNumbers.length === 0
                  }
                  className="text-white"
                  style={{ backgroundColor: '#328c81' }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calling...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 mr-2" />
                      Start Call
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-gray-300 dark:border-gray-600"
              >
                Make Another Call
              </Button>
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white">
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CallDialog