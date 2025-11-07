// src/components/variables/VariableTextarea.tsx
'use client'

import React, { useEffect, useState, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import { validateVariables, ValidationResult } from '@/utils/variableValidator';

interface VariableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (validation: ValidationResult) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export const VariableTextarea: React.FC<VariableTextareaProps> = ({
  value,
  onChange,
  onValidationChange,
  placeholder,
  className = '',
  style,
  disabled = false
}) => {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    validVariables: new Set()
  });
  
  const editorRef = useRef<any>(null);
  const initialValueRef = useRef(value);
  const hasSetInitialHistory = useRef(false);

  useEffect(() => {
    const result = validateVariables(value);
    setValidation(result);
    
    if (onValidationChange) {
      onValidationChange(result);
    }
  }, [value, onValidationChange]);

  // Fix undo history on initial load
  useEffect(() => {
    if (!hasSetInitialHistory.current && value && editorRef.current) {
      // Small delay to ensure editor is mounted
      setTimeout(() => {
        if (editorRef.current?._input) {
          // Clear any existing history
          const textarea = editorRef.current._input;
          
          // Trick: set value, blur, focus to reset undo stack
          const currentValue = textarea.value;
          textarea.value = '';
          textarea.value = currentValue;
          
          // Mark as set so we don't do this again
          hasSetInitialHistory.current = true;
        }
      }, 100);
    }
  }, [value]);

  const highlightCode = (code: string) => {
    if (!code) return '';

    const errorVars = new Set(validation.errors.map(e => e.variable));
    
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    highlighted = highlighted.replace(/\{\{([^{}]*)\}\}/g, (match) => {
      const escapedMatch = match
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const hasError = errorVars.has(match);
      
      if (hasError) {
        return `<span class="var-error">${escapedMatch}</span>`;
      } else {
        return `<span class="var-valid">${escapedMatch}</span>`;
      }
    });

    return highlighted;
  };

  return (
    <div className={`var-editor ${className}`}>
      <style jsx global>{`
        /* Container */
        .var-editor {
            width: 100%;
            height: 100%;
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.06);
            border-radius: 8px;
            background: #ffffff;
            transition: border-color 0.15s ease;
        }

        .var-editor:focus-within {
            border-color: rgba(0, 0, 0, 0.12);
        }

        .dark .var-editor {
            border-color: rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.03);
        }

        .dark .var-editor:focus-within {
            border-color: rgba(255, 255, 255, 0.12);
        }

        /* Editor text */
        .var-editor textarea,
        .var-editor pre {
            font-family: ${style?.fontFamily || 'ui-monospace, SF Mono, Monaco, Cascadia Code, Courier New, monospace'} !important;
            font-size: ${style?.fontSize || '13px'} !important;
            line-height: ${style?.lineHeight || '1.6'} !important;
        }

        .var-editor textarea {
            outline: none !important;
            border: none !important;
            background: transparent !important;
            resize: none !important;
            padding: 12px !important;
            color: #1a1a1a !important;
        }

        .dark .var-editor textarea {
            color: rgba(255, 255, 255, 0.9) !important;
        }

        .var-editor textarea::placeholder {
            color: rgba(0, 0, 0, 0.3) !important;
        }

        .dark .var-editor textarea::placeholder {
            color: rgba(255, 255, 255, 0.3) !important;
        }

        .var-editor pre {
            padding: 12px !important;
            margin: 0 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
        }

        /* Valid Variable - Blue italic, NO background */
        .var-valid {
            color: #0969da;
            font-style: italic;
        }

        .dark .var-valid {
            color: #58a6ff;
        }

        /* Invalid Variable - Red underline */
        .var-error {
            color: #d1242f;
            text-decoration: underline;
            text-decoration-color: #d1242f;
            text-decoration-thickness: 1.5px;
            text-underline-offset: 2px;
        }

        .dark .var-error {
            color: #ff7b72;
            text-decoration-color: #ff7b72;
        }

        /* Editor container */
        .var-editor > div {
            height: 100% !important;
            overflow: auto !important;
        }

        /* Scrollbar */
        .var-editor > div::-webkit-scrollbar {
            width: 14px;
            height: 14px;
        }

        .var-editor > div::-webkit-scrollbar-track {
            background: transparent;
        }

        .var-editor > div::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 10px;
            border: 4px solid transparent;
            background-clip: padding-box;
        }

        .var-editor > div::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.25);
            border: 3px solid transparent;
            background-clip: padding-box;
        }

        .dark .var-editor > div::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
        }

        .dark .var-editor > div::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
        }

        /* Selection color */
        .var-editor ::selection {
            background: rgba(46, 170, 220, 0.2);
        }

        .dark .var-editor ::selection {
            background: rgba(88, 166, 255, 0.25);
        }
        `}</style>

      <Editor
        ref={editorRef}
        value={value}
        onValueChange={onChange}
        highlight={highlightCode}
        padding={0}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          ...style,
          fontFamily: style?.fontFamily || 'ui-monospace, SF Mono, Monaco, Cascadia Code, Courier New, monospace',
          fontSize: style?.fontSize || '13px',
          lineHeight: style?.lineHeight || '1.6',
          minHeight: '100%',
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
};