// src/hooks/useVariableValidation.ts
'use client'

import { useState, useEffect, useCallback } from 'react';
import { validateVariables, ValidationResult, extractValidVariables } from '@/utils/variableValidator';

interface UseVariableValidationOptions {
  initialText?: string;
  onValidationChange?: (isValid: boolean) => void;
}

/**
 * Hook to manage variable validation state
 * Returns validation result and helper functions
 */
export const useVariableValidation = (options: UseVariableValidationOptions = {}) => {
  const { initialText = '', onValidationChange } = options;

  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    validVariables: new Set()
  });

  const [text, setText] = useState(initialText);

  // Validate text
  const validate = useCallback((textToValidate: string) => {
    const result = validateVariables(textToValidate);
    setValidation(result);
    
    if (onValidationChange) {
      onValidationChange(result.isValid);
    }
    
    return result;
  }, [onValidationChange]);

  // Update text and validate
  const updateText = useCallback((newText: string) => {
    setText(newText);
    validate(newText);
  }, [validate]);

  // Check if can save (no validation errors)
  const canSave = useCallback(() => {
    return validation.isValid;
  }, [validation.isValid]);

  // Get valid variables as array
  const getValidVariables = useCallback(() => {
    return Array.from(validation.validVariables);
  }, [validation.validVariables]);

  // Validate on initial text change
  useEffect(() => {
    validate(text);
  }, [text, validate]);

  return {
    validation,
    text,
    updateText,
    validate,
    canSave,
    getValidVariables,
    isValid: validation.isValid,
    errors: validation.errors,
    validVariables: Array.from(validation.validVariables)
  };
};