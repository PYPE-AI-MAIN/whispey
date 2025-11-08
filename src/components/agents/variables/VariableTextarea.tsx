// src/components/variables/VariableTextarea.tsx
'use client'

import React, { useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { validateVariables, ValidationResult } from '@/utils/variableValidator';

// Dynamically import Monaco Editor with no SSR
const Editor = dynamic(() => import('@monaco-editor/react'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#283442] border border-gray-200 dark:border-gray-700 rounded-lg">
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading editor...</p>
    </div>
  )
});

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
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [validation, setValidation] = React.useState<ValidationResult>({
    isValid: true,
    errors: [],
    validVariables: new Set()
  });

  useEffect(() => {
    const result = validateVariables(value);
    setValidation(result);
    
    if (onValidationChange) {
      onValidationChange(result);
    }
  }, [value, onValidationChange]);

  const handleEditorWillMount = useCallback((monaco: any) => {
    monacoRef.current = monaco;

    // Register a custom language
    monaco.languages.register({ id: 'prompt-with-variables' });

    // Define tokens for syntax highlighting
    monaco.languages.setMonarchTokensProvider('prompt-with-variables', {
        tokenizer: {
        root: [
            // Valid variables: {{variable_name}}
            // Must start with letter, can contain letters/numbers/underscores, must end with letter/number
            // Max 16 characters
            [/\{\{[a-zA-Z][a-zA-Z0-9_]{0,14}[a-zA-Z0-9]\}\}/, 'variable.valid'],
            // Single character valid variable (just a letter)
            [/\{\{[a-zA-Z]\}\}/, 'variable.valid'],
            // Invalid variables: anything else between {{ }}
            [/\{\{[^}]*\}\}/, 'variable.invalid'],
            // Unclosed braces
            [/\{\{[^}]*$/, 'variable.invalid'],
        ]
        }
    });

    // Define colors for tokens
    monaco.editor.defineTheme('variable-theme-light', {
        base: 'vs',
        inherit: true,
        rules: [
        { token: 'variable.valid', foreground: '0969da', fontStyle: 'italic' },
        { token: 'variable.invalid', foreground: 'd1242f', fontStyle: 'underline' }
        ],
        colors: {
        'editor.background': '#ffffff',
        }
    });

    monaco.editor.defineTheme('variable-theme-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
        { token: 'variable.valid', foreground: '58a6ff', fontStyle: 'italic' },
        { token: 'variable.invalid', foreground: 'ff7b72', fontStyle: 'underline' }
        ],
        colors: {
        'editor.background': '#283442',
        }
    });
    }, []);

    const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // No onKeyDown needed anymore!
    }, []);

  // Detect dark mode
  const [isDark, setIsDark] = React.useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      className={`var-editor-monaco border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-[#283442] ${className}`} 
      style={{ ...style, minHeight: style?.minHeight || '200px' }}
    >
      {/* Padding wrapper for left/right spacing */}
      <div className="px-3 h-full">
        <Editor
          height="100%"
          defaultLanguage="prompt-with-variables"
          theme={isDark ? 'variable-theme-dark' : 'variable-theme-light'}
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          beforeMount={handleEditorWillMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: 13,
            fontFamily: 'ui-monospace, SF Mono, Monaco, Cascadia Code, Courier New, monospace',
            readOnly: disabled,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 14,
              horizontalScrollbarSize: 14
            },
            padding: { 
              top: 16, 
              bottom: 16
            },
            hover: {
              enabled: false
            },
            quickSuggestions: false,
            parameterHints: {
              enabled: false
            },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnCommitCharacter: false,
            tabCompletion: 'off',
            wordBasedSuggestions: 'off',
            // Disable all validation markers and error squiggles
            'semanticHighlighting.enabled': false,
          }}
        />
      </div>
    </div>
  );
};