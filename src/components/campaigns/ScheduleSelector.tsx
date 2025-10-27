// components/campaigns/ScheduleSelector.tsx
'use client'

import React from 'react'
import { Field, ErrorMessage } from 'formik'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIMEZONES } from '@/utils/campaigns/constants'

interface ScheduleSelectorProps {
  sendType: 'now' | 'schedule'
  onSendTypeChange: (type: 'now' | 'schedule') => void
  onTimezoneChange: (timezone: string) => void
  timezone: string
  callWindowStart: string
  callWindowEnd: string
  onCallWindowChange: (field: string, value: string) => void
}

export function ScheduleSelector({ 
  sendType, 
  onSendTypeChange, 
  onTimezoneChange,
  timezone,
  callWindowStart,
  callWindowEnd,
  onCallWindowChange
}: ScheduleSelectorProps) {
  return (
    <div>
      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
        When to send the calls
      </Label>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => onSendTypeChange('now')}
          className={`p-3 border-2 rounded-lg text-left transition-all ${
            sendType === 'now'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
              Send Now
            </span>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              sendType === 'now'
                ? 'border-blue-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {sendType === 'now' && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSendTypeChange('schedule')}
          className={`p-3 border-2 rounded-lg text-left transition-all ${
            sendType === 'schedule'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
              Schedule
            </span>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              sendType === 'schedule'
                ? 'border-blue-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {sendType === 'schedule' && (
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Schedule Date & Timezone - Only for Schedule */}
      {sendType === 'schedule' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <Label htmlFor="scheduleDate" className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
              Select date
            </Label>
            <Field
              as={Input}
              type="date"
              id="scheduleDate"
              name="scheduleDate"
              className="w-full h-8 text-xs"
            />
            <ErrorMessage name="scheduleDate" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
          </div>

          <div>
            <Label htmlFor="timezone" className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
              Timezone
            </Label>
            <Field name="timezone">
              {({ field }: any) => (
                <Select 
                  value={timezone} 
                  onValueChange={onTimezoneChange}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <ErrorMessage name="timezone" component="p" className="text-xs text-red-600 dark:text-red-400 mt-1" />
          </div>
        </div>
      )}

      {/* Call Window - Always shown for both */}
      <div>
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Call Window
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={callWindowStart}
            onChange={(e) => onCallWindowChange('callWindowStart', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
          <span className="text-gray-500 text-xs">to</span>
          <Input
            type="time"
            value={callWindowEnd}
            onChange={(e) => onCallWindowChange('callWindowEnd', e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Calls will only run between these hours
        </p>
      </div>
    </div>
  )
}