// components/campaigns/ScheduleSelector.tsx
'use client'

import React, { useState } from 'react'
import { Field, ErrorMessage } from 'formik'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock, Calendar, ChevronDown, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { TIMEZONES } from '@/utils/campaigns/constants'

interface ScheduleSelectorProps {
  sendType: 'now' | 'schedule'
  onSendTypeChange: (type: 'now' | 'schedule') => void
  onTimezoneChange: (timezone: string) => void
  timezone: string
  callWindowStart: string
  callWindowEnd: string
  onCallWindowChange: (field: string, value: string) => void
  selectedDays: string[]
  onDaysChange: (days: string[]) => void
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' },
  { value: 'sunday', label: 'Sunday', short: 'Sun' },
]

export function ScheduleSelector({ 
  sendType, 
  onSendTypeChange, 
  onTimezoneChange,
  timezone,
  callWindowStart,
  callWindowEnd,
  onCallWindowChange,
  selectedDays,
  onDaysChange
}: ScheduleSelectorProps) {
  const [open, setOpen] = useState(false)
  
  const handleDayToggle = (day: string) => {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter(d => d !== day))
    } else {
      onDaysChange([...selectedDays, day])
    }
  }

  const selectAllWeekdays = () => {
    onDaysChange(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  }

  const selectAllDays = () => {
    onDaysChange(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  }

  const clearAll = () => {
    onDaysChange([])
  }

  const getDisplayText = () => {
    if (selectedDays.length === 0) return 'Select days'
    if (selectedDays.length === 7) return 'Every day'
    if (selectedDays.length === 5 && 
        selectedDays.includes('monday') && 
        selectedDays.includes('tuesday') && 
        selectedDays.includes('wednesday') && 
        selectedDays.includes('thursday') && 
        selectedDays.includes('friday')) {
      return 'Weekdays (Mon-Fri)'
    }
    if (selectedDays.length <= 3) {
      return selectedDays.map(d => 
        DAYS_OF_WEEK.find(day => day.value === d)?.short
      ).join(', ')
    }
    return `${selectedDays.length} days selected`
  }

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

      {/* Days of Week Selection - Dropdown */}
      <div className="mb-3">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          Days to Run
        </Label>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={`w-full h-8 justify-between text-xs font-normal ${
                selectedDays.length === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {getDisplayText()}
              <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
            {/* Quick Actions */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Quick Select</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllWeekdays}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Weekdays
                </button>
                <span className="text-xs text-gray-400">•</span>
                <button
                  type="button"
                  onClick={selectAllDays}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  All Days
                </button>
                <span className="text-xs text-gray-400">•</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Days Grid */}
            <div className="space-y-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className="text-left">
                        <span className={`text-sm font-medium ${
                          isSelected 
                            ? 'text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {day.label}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${
                      isSelected 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {day.short}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Selected Count */}
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                {selectedDays.length === 0 
                  ? 'No days selected' 
                  : `${selectedDays.length} day${selectedDays.length !== 1 ? 's' : ''} selected`
                }
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {selectedDays.length === 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Please select at least one day
          </p>
        )}
      </div>

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
          Calls will only run between these hours on selected days
        </p>
      </div>
    </div>
  )
}