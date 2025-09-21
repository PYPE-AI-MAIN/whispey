'use client'

import { useState, useEffect, useCallback } from 'react'

interface PromptSettings {
  fontSize: number
  fontFamily: 'mono' | 'sans' | 'serif'
  theme?: string
  lineHeight?: number
  wordWrap?: boolean
}

const DEFAULT_SETTINGS: PromptSettings = {
  fontSize: 11,
  fontFamily: 'mono',
  theme: 'default',
  lineHeight: 1.5,
  wordWrap: true
}

const STORAGE_KEY = 'whispey_prompt_settings'

export const usePromptSettings = () => {
  const [settings, setSettings] = useState<PromptSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedSettings = JSON.parse(stored)
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings })
      }
    } catch (error) {
      console.warn('Failed to load prompt settings from localStorage:', error)
      // Fall back to defaults
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save settings to localStorage whenever they change
  const updateSettings = useCallback((newSettings: Partial<PromptSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (error) {
        console.warn('Failed to save prompt settings to localStorage:', error)
      }
      
      return updated
    })
  }, [])

  // Individual setters for convenience
  const setFontSize = useCallback((fontSize: number) => {
    updateSettings({ fontSize })
  }, [updateSettings])

  const setFontFamily = useCallback((fontFamily: 'mono' | 'sans' | 'serif') => {
    updateSettings({ fontFamily })
  }, [updateSettings])

  const setLineHeight = useCallback((lineHeight: number) => {
    updateSettings({ lineHeight })
  }, [updateSettings])

  const setWordWrap = useCallback((wordWrap: boolean) => {
    updateSettings({ wordWrap })
  }, [updateSettings])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear prompt settings from localStorage:', error)
    }
  }, [])

  // Get CSS styles for the textarea
  const getTextareaStyles = useCallback(() => {
    const fontFamilyMap = {
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
    }

    return {
      fontSize: `${settings.fontSize}px`,
      fontFamily: fontFamilyMap[settings.fontFamily],
      lineHeight: settings.lineHeight,
      whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre'
    } as React.CSSProperties
  }, [settings])

  return {
    settings,
    isLoaded,
    updateSettings,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setWordWrap,
    resetSettings,
    getTextareaStyles
  }
}