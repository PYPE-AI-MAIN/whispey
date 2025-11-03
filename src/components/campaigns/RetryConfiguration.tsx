// components/campaigns/RetryConfiguration.tsx
'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RefreshCw, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface RetryConfig {
  errorCodes: string[]
  delayMinutes: number
  maxRetries: number
}

interface RetryConfigurationProps {
  onFieldChange: (field: string, value: any) => void
  values: {
    retryConfig: RetryConfig[]
  }
}

export function RetryConfiguration({ onFieldChange, values }: RetryConfigurationProps) {
  const errorCodeLabels: { [key: string]: string } = {
    '480': 'Temporarily Unavailable',
    '486': 'Busy Here',
  }

  const handleRetryChange = (index: number, field: 'delayMinutes' | 'maxRetries', value: string) => {
    const numValue = parseInt(value) || 0
    const updatedConfig = [...values.retryConfig]
    updatedConfig[index] = {
      ...updatedConfig[index],
      [field]: numValue
    }
    onFieldChange('retryConfig', updatedConfig)
  }

  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Retry Configuration
        </Label>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
          Configure retry behavior for different error codes. Each error code can have its own retry settings.
        </AlertDescription>
      </Alert>

      {/* Error Code Configurations */}
      <div className="space-y-3">
        {values.retryConfig.map((config, index) => {
          const errorCode = config.errorCodes[0]
          const label = errorCodeLabels[errorCode] || errorCode
          
          return (
            <div key={errorCode} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {errorCode}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {label}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Delay Minutes */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Delay (minutes)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="1440"
                    value={config.delayMinutes}
                    onChange={(e) => handleRetryChange(index, 'delayMinutes', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0-1440 min
                  </p>
                </div>

                {/* Max Retries */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Max Retries
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={config.maxRetries}
                    onChange={(e) => handleRetryChange(index, 'maxRetries', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0-10 attempts
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

