// src/utils/variableValidator.ts

export interface ValidationError {
  type: 'unclosed' | 'empty' | 'invalid_chars' | 'too_long' | 'starts_with_number' | 'invalid_underscore';
  variable: string;
  position: number;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validVariables: Set<string>;
}

/**
 * Validates variables in the format {{variable_name}}
 * Rules:
 * 1. Must be closed properly
 * 2. Cannot be empty
 * 3. Only alphanumeric and underscores (NO spaces)
 * 4. Cannot start with a number
 * 5. Cannot start or end with underscore
 * 6. Max 16 characters
 * 7. Trimmed whitespace
 * 8. Converted to lowercase
 * 
 * IMPORTANT: Variables are only added to validVariables if they pass ALL checks
 */
export const validateVariables = (text: string): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    validVariables: new Set()
  };

  // Check for unclosed braces
  const openBraces = (text.match(/\{\{/g) || []).length;
  const closeBraces = (text.match(/\}\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    result.isValid = false;
    const lastOpenIndex = text.lastIndexOf('{{');
    result.errors.push({
      type: 'unclosed',
      variable: '{{',
      position: lastOpenIndex,
      message: 'Unclosed variable bracket'
    });
  }

  // Extract and validate each COMPLETE variable (only between properly closed {{ }})
  const variablePattern = /\{\{([^{}]*)\}\}/g;
  let match;

  while ((match = variablePattern.exec(text)) !== null) {
    const rawContent = match[1];
    const position = match.index;
    const fullMatch = match[0]; // e.g., "{{patient_name}}"

    // Track if this specific variable is valid
    let isThisVariableValid = true;

    // Empty check (after trimming)
    if (!rawContent.trim()) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'empty',
        variable: fullMatch,
        position,
        message: 'Variable cannot be empty'
      });
      continue; // Don't add to validVariables
    }

    const varName = rawContent.trim();

    // Check for spaces
    if (/\s/.test(varName)) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'invalid_chars',
        variable: fullMatch,
        position,
        message: 'Variable cannot contain spaces. Use underscores instead.'
      });
      continue; // Don't add to validVariables
    }

    // Check for special characters (only allow alphanumeric and underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(varName)) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'invalid_chars',
        variable: fullMatch,
        position,
        message: 'Variable can only contain letters, numbers, and underscores'
      });
      continue; // Don't add to validVariables
    }

    // Check if starts with number
    if (/^\d/.test(varName)) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'starts_with_number',
        variable: fullMatch,
        position,
        message: 'Variable cannot start with a number'
      });
      continue; // Don't add to validVariables
    }

    // Check if starts or ends with underscore
    if (/^_/.test(varName) || /_$/.test(varName)) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'invalid_underscore',
        variable: fullMatch,
        position,
        message: 'Variable cannot start or end with an underscore'
      });
      continue; // Don't add to validVariables
    }

    // Check length (max 16 characters)
    if (varName.length > 16) {
      result.isValid = false;
      isThisVariableValid = false;
      result.errors.push({
        type: 'too_long',
        variable: fullMatch,
        position,
        message: `Variable cannot exceed 16 characters (currently ${varName.length})`
      });
      continue; // Don't add to validVariables
    }

    // ONLY add to validVariables if ALL checks passed
    if (isThisVariableValid) {
      result.validVariables.add(varName);
    }
  }

  return result;
};

/**
 * Extract only valid variables from text
 */
export const extractValidVariables = (text: string): string[] => {
  const validation = validateVariables(text);
  return Array.from(validation.validVariables);
};

/**
 * Check if text has any validation errors
 */
export const hasVariableErrors = (text: string): boolean => {
  return !validateVariables(text).isValid;
};