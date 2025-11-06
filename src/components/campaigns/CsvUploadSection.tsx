// components/campaigns/CsvUploadSection.tsx
'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Upload, X, AlertCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Papa from 'papaparse'
import { CSV_TEMPLATE, RecipientRow, CsvValidationError } from '@/utils/campaigns/constants'

interface CsvUploadSectionProps {
  csvFile: File | null
  csvData: RecipientRow[]
  onFileUpload: (file: File, data: RecipientRow[], errors: CsvValidationError[]) => void
  onRemoveFile: () => void
}

export function CsvUploadSection({ 
  csvFile, 
  csvData, 
  onFileUpload, 
  onRemoveFile 
}: CsvUploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([])
  const [showErrorDialog, setShowErrorDialog] = useState(false)

  const downloadTemplate = () => {
    const csv = [
      CSV_TEMPLATE.headers.join(','),
      ...CSV_TEMPLATE.exampleRows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campaign_recipients_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const validateCsvHeaders = (headers: string[]): boolean => {
    const requiredHeaders = CSV_TEMPLATE.headers
    return requiredHeaders.every(header => 
      headers.map(h => h.trim().toLowerCase()).includes(header.toLowerCase())
    )
  }

  const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return false
  
  // Remove all whitespace, hyphens, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Check if phone starts with + followed by country code
  if (!cleaned.startsWith('+')) {
    return false
  }
  
  // Check for valid country codes (+91 for India, +1 for US/Canada)
  const hasValidCountryCode = cleaned.startsWith('+91') || cleaned.startsWith('+1')
  
  if (!hasValidCountryCode) {
    return false
  }
  
  // Validate format: +[country code][10 digits for India, 10 digits for US]
  const phoneRegex = /^\+(?:91[6-9]\d{9}|1[2-9]\d{9})$/
  
  return phoneRegex.test(cleaned)
}

const validateCsvData = (data: RecipientRow[]): CsvValidationError[] => {
  const errors: CsvValidationError[] = []

  data.forEach((row, index) => {
    // Validate phone number only
    if (!validatePhoneNumber(row.phone)) {
      errors.push({
        row: index + 2,
        field: 'phone',
        value: row.phone || 'empty',
        error: 'Invalid phone number format. Must start with +91 (India) or +1 (US/Canada) followed by 10 digits'
      })
    }
  })

  return errors
}

  const handleFileUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        
        if (!validateCsvHeaders(headers)) {
          setValidationErrors([{
            row: 1,
            field: 'headers',
            value: headers.join(', '),
            error: `Invalid CSV format. Required headers: ${CSV_TEMPLATE.headers.join(', ')}`
          }])
          setShowErrorDialog(true)
          return
        }

        const data = results.data as RecipientRow[]
        const errors = validateCsvData(data)
        
        setValidationErrors(errors)
        
        if (errors.length > 0) {
          setShowErrorDialog(true)
        }

        onFileUpload(file, data, errors)
      },
      error: (error) => {
        setValidationErrors([{
          row: 0,
          field: 'file',
          value: file.name,
          error: `Error parsing CSV: ${error.message}`
        }])
        setShowErrorDialog(true)
      }
    })
  }, [onFileUpload])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type === 'text/csv') {
      handleFileUpload(file)
    } else {
      setValidationErrors([{
        row: 0,
        field: 'file',
        value: file?.name || 'unknown',
        error: 'Please upload a valid CSV file'
      }])
      setShowErrorDialog(true)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Upload Recipients
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="h-7 text-xs gap-1.5 px-2"
        >
          <Download className="w-3 h-3" />
          Download template
        </Button>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        {csvFile ? (
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
              <div className="text-left">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {csvFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(csvFile.size / 1024).toFixed(2)} KB • {csvData.length} recipients
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveFile}
              className="h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-900 dark:text-gray-100 mb-1">
              Choose a csv or drag & drop it here.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Up to 50 MB
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <Label
              htmlFor="csv-upload"
              className="cursor-pointer inline-flex items-center justify-center h-7 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Choose File
            </Label>
          </>
        )}
      </div>

      {validationErrors.length > 0 && csvFile && (
        <Alert 
          variant="destructive" 
          className="mt-2 cursor-pointer" 
          onClick={() => setShowErrorDialog(true)}
        >
          <AlertCircle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Found {validationErrors.length} validation {validationErrors.length === 1 ? 'error' : 'errors'}. 
            <span className="underline ml-1">Click to view details</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              CSV Validation Errors
            </DialogTitle>
            <DialogDescription>
              Please fix the following issues in your CSV file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            {validationErrors.map((error, index) => (
              <div 
                key={index}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Row {error.row}: {error.field}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {error.error}
                    </p>
                    {error.value !== 'empty' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">
                        Value: {error.value}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
            <Button
              size="sm"
              onClick={() => setShowErrorDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}