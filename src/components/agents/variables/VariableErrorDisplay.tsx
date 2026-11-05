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
            <button className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-medium">{errors.length} {errors.length === 1 ? 'Error' : 'Errors'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Variable Validation Errors
              </h4>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={`${error.type}-${index}`}
                    className="p-2 rounded-md bg-destructive/10 border border-destructive/30"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-destructive font-medium">
                          {error.message}
                        </p>
                        {error.variable && (
                          <code className="text-xs text-destructive bg-destructive/15 px-1.5 py-0.5 rounded mt-1 inline-block font-mono">
                            {error.variable}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-2 border-t border-border bg-muted/50">
              <p className="text-xs text-muted-foreground">
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
            <button className="flex items-center gap-1.5 text-xs text-success hover:text-success transition-colors px-2 py-1 rounded-md hover:bg-success/10">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-medium">{validVariables.length} {validVariables.length === 1 ? 'Variable' : 'Variables'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Detected Variables
              </h4>
            </div>
            <div className="max-h-64 overflow-y-auto p-3">
              <div className="flex flex-wrap gap-2">
                {validVariables.map((variable) => (
                  <code
                    key={variable}
                    className="px-2.5 py-1 rounded-md bg-success/10 text-success font-mono text-xs border border-success/30"
                  >
                    {`{{${variable}}}`}
                  </code>
                ))}
              </div>
            </div>
            <div className="p-2 border-t border-border bg-muted/50">
              <p className="text-xs text-muted-foreground">
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