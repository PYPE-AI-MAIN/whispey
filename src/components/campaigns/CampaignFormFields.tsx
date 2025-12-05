// components/campaigns/CampaignFormFields.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { Field, ErrorMessage } from 'formik'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Clock, Phone, User, Info, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useUserPermissions } from '@/contexts/UserPermissionsContext'
import { PhoneNumber } from '@/utils/campaigns/constants'

interface CampaignFormFieldsProps {
  onFieldChange: (field: string, value: any) => void
  values: {
    campaignName: string
    agentId: string
    fromNumber: string
    callWindowStart: string
    callWindowEnd: string
    reservedConcurrency: number
  }
  projectId: string
}

export function CampaignFormFields({ onFieldChange, values, projectId }: CampaignFormFieldsProps) {
  const { permissions, loading: permissionsLoading } = useUserPermissions({ projectId })
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhones, setLoadingPhones] = useState(true)

  // Get agents from permissions
  const agents = permissions?.agent?.agents || []

  // Fetch phone numbers with outbound filter
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        setLoadingPhones(true)
        const response = await fetch(`/api/calls/phone-numbers/?limit=100`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch phone numbers')
        }

        const data: PhoneNumber[] = await response.json()
        
        // Filter by: project_id matching AND trunk_direction = 'outbound' AND status = 'active'
        const filteredNumbers = data.filter(phone => 
          phone.project_id === projectId && 
          phone.trunk_direction === 'outbound' &&
          phone.status === 'active'
        )
        setPhoneNumbers(filteredNumbers)
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
        setPhoneNumbers([])
      } finally {
        setLoadingPhones(false)
      }
    }

    if (projectId) {
      fetchPhoneNumbers()
    }
  }, [projectId])

  return (
    <>
      {/* Batch Call Name */}
      <div>
        <Label htmlFor="campaignName" className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
          Batch Call Name
        </Label>
        <Field
          as={Input}
          id="campaignName"
          name="campaignName"
          placeholder="Enter campaign name"
          className="w-full h-8 text-sm"
        />
        <ErrorMessage name="campaignName" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
      </div>

      {/* Select Agent */}
      <div>
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
          <User className="w-3 h-3" />
          Select Agent
        </Label>
        <Field name="agentId">
          {({ field }: any) => (
            <>
              {permissionsLoading ? (
                <div className="w-full h-8 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : agents.length === 0 ? (
                <div className="w-full h-8 flex items-center px-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">No agents available</span>
                </div>
              ) : (
                <Select 
                  value={field.value} 
                  onValueChange={(value) => onFieldChange('agentId', value)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.name}>
                        <div className="flex items-center gap-2">
                          <span>{agent.name}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              agent.status === 'active' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {agent.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </Field>
        <ErrorMessage name="agentId" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
      </div>

      {/* From Number - Now filtered for outbound only */}
      <div>
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
          <Phone className="w-3 h-3" />
          From Number (Outbound)
        </Label>
        <Field name="fromNumber">
          {({ field }: any) => (
            <>
              {loadingPhones ? (
                <div className="w-full h-8 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : phoneNumbers.length === 0 ? (
                <div className="w-full h-8 flex items-center px-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">No outbound phone numbers available for this project</span>
                </div>
              ) : (
                <Select 
                  value={field.value} 
                  onValueChange={(value) => onFieldChange('fromNumber', value)}
                >
                  <SelectTrigger className="w-full h-8 text-sm">
                    <SelectValue placeholder="Select phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneNumbers.map((phone) => (
                      <SelectItem key={phone.id} value={phone.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {phone.formatted_number || phone.phone_number}
                          </span>
                          {phone.provider && (
                            <span className="text-gray-500 text-xs">({phone.provider})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </Field>
        <ErrorMessage name="fromNumber" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
      </div>

      {/* Campaign Concurrency */}
      <div>
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          Campaign Concurrency
        </Label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Number of simultaneous calls for this campaign (1-5).
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFieldChange('reservedConcurrency', Math.max(1, values.reservedConcurrency - 1))}
            className="h-7 w-7 p-0"
          >
            -
          </Button>
          <Field
            as={Input}
            type="number"
            name="reservedConcurrency"
            className="flex-1 text-center h-7 text-xs"
            min="1"
            max="5"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onFieldChange('reservedConcurrency', Math.min(5, values.reservedConcurrency + 1))}
            className="h-7 w-7 p-0"
          >
            +
          </Button>
        </div>
        <ErrorMessage name="reservedConcurrency" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
      </div>
    </>
  )
}