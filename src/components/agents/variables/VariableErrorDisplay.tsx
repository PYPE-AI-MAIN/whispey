// src/components/variables/VariableErrorDisplay.tsx
'use client'

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ValidationError } from '@/utils/variableValidator';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface VariableValidationIndicatorProps {
  errors: ValidationError[];
  validVariables: string[];
  className?: string;
}

/**
 * Compact validation indicator with popover for details
 * Shows as a small badge/icon that can be clicked for more info
 */
export const VariableValidationIndicator: React.FC<VariableValidationIndicatorProps> = ({
  errors,
  validVariables,
  className = ''
}) => {
  const hasErrors = errors.length > 0;
  const hasVariables = validVariables.length > 0;

  if (!hasErrors && !hasVariables) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Error Indicator */}
      {hasErrors && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-medium">{errors.length} {errors.length === 1 ? 'Error' : 'Errors'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Variable Validation Errors
              </h4>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={`${error.type}-${index}`}
                    className="p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                          {error.message}
                        </p>
                        {error.variable && (
                          <code className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded mt-1 inline-block font-mono">
                            {error.variable}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Fix these errors to enable config updates
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Valid Variables Indicator */}
      {!hasErrors && hasVariables && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors px-2 py-1 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">{validVariables.length} {validVariables.length === 1 ? 'Variable' : 'Variables'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Detected Variables
              </h4>
            </div>
            <div className="max-h-64 overflow-y-auto p-3">
              <div className="flex flex-wrap gap-2">
                {validVariables.map((variable) => (
                  <code
                    key={variable}
                    className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-mono text-xs border border-green-200 dark:border-green-800"
                  >
                    {`{{${variable}}}`}
                  </code>
                ))}
              </div>
            </div>
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                These variables will be available in your agent
              </p>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

// Keep old exports for backward compatibility but mark as deprecated
export const VariableErrorDisplay = () => null;
export const VariableSuccessDisplay = () => null;