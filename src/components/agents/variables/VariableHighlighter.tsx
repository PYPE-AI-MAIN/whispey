// src/components/variables/VariableHighlighter.tsx
'use client'

import React, { useMemo } from 'react';
import { ValidationError } from '@/utils/variableValidator';

interface VariableHighlighterProps {
  text: string;
  errors: ValidationError[];
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Highlights variables in text with different colors based on validation status
 * - Valid variables: blue
 * - Invalid variables: red with squiggly underline
 * - Unclosed braces: yellow warning
 */
export const VariableHighlighter: React.FC<VariableHighlighterProps> = ({
  text,
  errors,
  style,
  className = ''
}) => {
  const highlightedHTML = useMemo(() => {
    if (!text) return '';

    let highlighted = text;
    const errorPositions = new Set(errors.map(e => e.position));
    const errorVariables = new Set(errors.map(e => e.variable));

    // First, escape HTML
    highlighted = highlighted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    // Highlight valid variables (blue)
    highlighted = highlighted.replace(
      /\{\{([^{}]+)\}\}/g,
      (match, content, offset) => {
        // Check if this variable has an error
        const hasError = errorPositions.has(offset) || errorVariables.has(match);
        
        if (hasError) {
          // Invalid variable - red with squiggly underline
          return `<span class="variable-invalid">${match}</span>`;
        } else {
          // Valid variable - blue
          return `<span class="variable-valid">${match}</span>`;
        }
      }
    );

    // Highlight unclosed braces (yellow warning)
    // Only highlight if there's an unclosed bracket error
    const hasUnclosedError = errors.some(e => e.type === 'unclosed');
    if (hasUnclosedError) {
      // Find unclosed {{ that don't have matching }}
      highlighted = highlighted.replace(
        /\{\{(?![^{}]*\}\})/g,
        '<span class="variable-unclosed">{{</span>'
      );
    }

    return highlighted;
  }, [text, errors]);

  return (
    <div
      className={`variable-highlighter ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: highlightedHTML }}
    />
  );
};

// Add these styles to your global CSS or tailwind
// src/styles/variables.css
export const variableStyles = `
.variable-highlighter {
  white-space: pre-wrap;
  word-wrap: break-word;
  pointer-events: none;
}

.variable-valid {
  background-color: rgb(219, 234, 254); /* bg-blue-100 */
  color: rgb(29, 78, 216); /* text-blue-700 */
  padding: 1px 2px;
  border-radius: 2px;
}

.dark .variable-valid {
  background-color: rgba(30, 58, 138, 0.3); /* bg-blue-900/30 */
  color: rgb(147, 197, 253); /* text-blue-300 */
}

.variable-invalid {
  background-color: rgb(254, 226, 226); /* bg-red-100 */
  color: rgb(185, 28, 28); /* text-red-700 */
  padding: 1px 2px;
  border-radius: 2px;
  text-decoration: wavy underline;
  text-decoration-color: rgb(239, 68, 68); /* red-500 */
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}

.dark .variable-invalid {
  background-color: rgba(127, 29, 29, 0.3); /* bg-red-900/30 */
  color: rgb(252, 165, 165); /* text-red-300 */
  text-decoration-color: rgb(239, 68, 68); /* red-500 */
}

.variable-unclosed {
  background-color: rgb(254, 249, 195); /* bg-yellow-100 */
  color: rgb(161, 98, 7); /* text-yellow-700 */
  padding: 1px 2px;
  border-radius: 2px;
}

.dark .variable-unclosed {
  background-color: rgba(113, 63, 18, 0.3); /* bg-yellow-900/30 */
  color: rgb(253, 224, 71); /* text-yellow-300 */
}
`;