// app/[projectid]/campaigns/create/page.tsx
'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Formik } from 'formik'
import * as Yup from 'yup'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { RecipientRow, CsvValidationError, PhoneNumber, RetryConfig } from '@/utils/campaigns/constants'
import { supabase } from '@/lib/supabase'
import { CampaignFormFields } from '@/components/campaigns/CampaignFormFields'
import { CsvUploadSection } from '@/components/campaigns/CsvUploadSection'
import { ScheduleSelector } from '@/components/campaigns/ScheduleSelector'
import { RecipientsPreview } from '@/components/campaigns/RecipientsPreview'
import { RetryConfiguration } from '@/components/campaigns/RetryConfiguration'

const validationSchema = Yup.object({
  campaignName: Yup.string()
    .required('Campaign name is required')
    .min(3, 'Must be at least 3 characters'),
  agentId: Yup.string().required('Please select an agent'),
  fromNumber: Yup.string().required('Please select a phone number'),
  sendType: Yup.string().oneOf(['now', 'schedule']).required(),
  scheduleDate: Yup.date().when('sendType', {
    is: 'schedule',
    then: (schema) => schema.required('Schedule date is required'),
  }),
  timezone: Yup.string().when('sendType', {
    is: 'schedule',
    then: (schema) => schema.required('Timezone is required'),
  }),
  callWindowStart: Yup.string().required('Call window start time is required'),
  callWindowEnd: Yup.string().required('Call window end time is required'),
  reservedConcurrency: Yup.number()
    .required('Campaign concurrency is required')
    .min(1, 'Must be at least 1')
    .max(5, 'Cannot exceed 5'),
  retryConfig: Yup.array().of(
    Yup.object().shape({
      type: Yup.string().oneOf(['sipCode', 'metric', 'fieldExtractor']).required('Retry type is required'),
      // SIP Code fields (optional, but required if type is sipCode)
      errorCodes: Yup.array().of(Yup.string()),
      // Metric fields (optional, but required if type is metric)
      metricName: Yup.string(),
      threshold: Yup.number().min(0, 'Threshold must be at least 0'),
      // Field Extractor fields (optional, but required if type is fieldExtractor)
      fieldName: Yup.string(),
      expectedValue: Yup.mixed(),
      // Operator can be either metric or fieldExtractor type - validate in test
      operator: Yup.mixed(),
      // Common fields
      delayMinutes: Yup.number()
        .required('Delay minutes is required')
        .min(0, 'Must be at least 0')
        .max(1440, 'Cannot exceed 1440 minutes'),
      maxRetries: Yup.number()
        .required('Max retries is required')
        .min(0, 'Must be at least 0')
        .max(10, 'Cannot exceed 10'),
    }).test('validate-retry-config', 'Invalid retry configuration', function(value) {
      if (!value || !value.type) return true // Let required() handle this
      
      if (value.type === 'sipCode') {
        if (!value.errorCodes || !Array.isArray(value.errorCodes) || value.errorCodes.length === 0) {
          return this.createError({ message: 'At least one error code is required for SIP code retries' })
        }
      } else if (value.type === 'metric') {
        // Allow undefined metricName if no options available, but require it if it exists
        if (value.metricName !== undefined && value.metricName !== null && value.metricName.trim() === '') {
          return this.createError({ message: 'Metric name cannot be empty if provided' })
        }
        if (!value.operator || !['<', '>', '<=', '>=', '==', '!='].includes(value.operator)) {
          return this.createError({ message: 'Operator is required and must be one of: <, >, <=, >=, ==, !=' })
        }
        if (value.threshold === undefined || value.threshold === null) {
          return this.createError({ message: 'Threshold is required' })
        }
        // Only require metricName if operator and threshold are set (meaning user is configuring)
        if (value.operator && value.threshold !== undefined && (!value.metricName || value.metricName.trim() === '')) {
          return this.createError({ message: 'Metric name is required' })
        }
      } else if (value.type === 'fieldExtractor') {
        // Allow undefined fieldName if no options available, but require it if it exists
        if (value.fieldName !== undefined && value.fieldName !== null && value.fieldName.trim() === '') {
          return this.createError({ message: 'Field name cannot be empty if provided' })
        }
        if (!value.operator || !['missing', 'equals', 'not_equals', 'contains', 'not_contains'].includes(value.operator)) {
          return this.createError({ message: 'Operator is required' })
        }
        if (value.operator !== 'missing' && (!value.expectedValue || value.expectedValue === '')) {
          return this.createError({ message: 'Expected value is required when operator is not "missing"' })
        }
        // Only require fieldName if operator is set (meaning user is configuring)
        if (value.operator && (!value.fieldName || value.fieldName.trim() === '')) {
          return this.createError({ message: 'Field name is required' })
        }
      }
      return true
    })
  ),
})

function CreateCampaign() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectid as string

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<RecipientRow[]>([])
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[]>([])
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])

  const initialValues = {
    campaignName: '',
    agentId: '',
    fromNumber: '',
    sendType: 'now' as 'now' | 'schedule',
    scheduleDate: '',
    timezone: 'Asia/Kolkata',
    callWindowStart: '00:00',
    callWindowEnd: '23:59',
    reservedConcurrency: 5,
    selectedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // Default to weekdays
    retryConfig: [
      {
        type: 'sipCode' as const,
        errorCodes: ['480'],
        delayMinutes: 5,
        maxRetries: 2,
      },
      {
        type: 'sipCode' as const,
        errorCodes: ['486'],
        delayMinutes: 5,
        maxRetries: 2,
      },
    ] as RetryConfig[],
  }

  // Fetch phone numbers when component mounts
  React.useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_PYPEAI_API_URL
        const response = await fetch(`${baseUrl}/api/calls/phone-numbers/?limit=50`)
        
        if (response.ok) {
          const data: PhoneNumber[] = await response.json()
          const filteredNumbers = data.filter(phone => phone.project_id === projectId)
          setPhoneNumbers(filteredNumbers)
        }
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
      }
    }

    fetchPhoneNumbers()
  }, [projectId])

  const handleFileUpload = (file: File, data: RecipientRow[], errors: CsvValidationError[]) => {
    setCsvFile(file)
    setCsvData(data)
    setValidationErrors(errors)
  }

  const handleRemoveFile = () => {
    setCsvFile(null)
    setCsvData([])
    setValidationErrors([])
  }

  const handleSubmit = async (values: typeof initialValues, { setSubmitting }: any) => {
    if (csvData.length === 0) {
      alert('Please upload recipients CSV file')
      setSubmitting(false)
      return
    }

    if (validationErrors.length > 0) {
      alert('Please fix validation errors before submitting')
      setSubmitting(false)
      return
    }

    try {
      // Generate unique campaign ID
      const campaignId = uuidv4()

      // Step 1: Upload CSV to S3
      // Use Papa.unparse to properly format CSV with quoted fields
      // Preserve all columns from the CSV - phone is required, others will be stored as additionalData
      const normalizedData = csvData.map(row => {
        const rowData: any = {}
        // Include all columns from the parsed CSV (headers are already normalized)
        Object.keys(row).forEach(key => {
          const value = (row as any)[key]
          // Only include non-empty values
          if (value !== undefined && value !== null && value !== '') {
            rowData[key] = value
          }
        })
        return rowData
      })
      
      const csvContent = Papa.unparse(normalizedData, {
        header: true,
        quotes: true,
        quoteChar: '"',
      })

      const uploadResponse = await fetch(`/api/campaigns/upload-file?campaignId=${campaignId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
        },
        body: csvContent,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload CSV')
      }

      const uploadData = await uploadResponse.json()
      const s3FileKey = uploadData.s3FileKey || uploadData.fileKey

      // Get phone number details for trunk_id and provider
      const selectedPhone = phoneNumbers.find(phone => phone.id === values.fromNumber)
      
      if (!selectedPhone) {
        throw new Error('Selected phone number not found')
      }

      // Get agent name from agent ID and construct name with ID suffix (as expected by backend)
      let agentName = values.agentId
      try {
        const { data: agent } = await supabase
          .from('pype_voice_agents')
          .select('name, id')
          .eq('id', values.agentId)
          .single()
        
        if (agent?.name && agent?.id) {
          // Construct agent name with ID suffix (matching backend format)
          // Replace dashes with underscores in the ID, as done in agent creation
          const sanitizedAgentId = agent.id.replace(/-/g, '_')
          agentName = `${agent.name}_${sanitizedAgentId}`
        } else if (agent?.name) {
          // Fallback to just name if ID is missing
          agentName = agent.name
        }
      } catch (err) {
        console.error('Error fetching agent name:', err)
        // Fallback to using agentId as agentName
      }

      // Step 2: Create campaign
      const createResponse = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          projectId,
          campaignName: values.campaignName,
          s3FileKey,
          agentName: agentName,
          sipTrunkId: selectedPhone.trunk_id,
          provider: selectedPhone.provider || 'Unknown',
        }),
      })

      if (!createResponse.ok) {
        const error = await createResponse.json()
        throw new Error(error.error || 'Failed to create campaign')
      }

      // Step 3: Schedule campaign
      const scheduleDate = values.sendType === 'schedule' 
        ? new Date(values.scheduleDate).toISOString()
        : new Date().toISOString()

      // Format retryConfig according to backend requirements
      const formattedRetryConfig = values.retryConfig.map(config => {
        if (config.type === 'sipCode' || !config.type) {
          // SIP Code retry: ensure errorCodes is an array of strings
          return {
            type: 'sipCode',
            errorCodes: Array.isArray(config.errorCodes) 
              ? config.errorCodes.map(code => String(code).trim()).filter(code => code.length > 0)
              : (config.errorCodes ? [String(config.errorCodes).trim()] : ['480']),
            delayMinutes: Number(config.delayMinutes),
            maxRetries: Number(config.maxRetries),
          }
        } else if (config.type === 'metric') {
          // Metric retry: NO errorCodes field
          const metricConfig: any = {
            type: 'metric',
            metricName: config.metricName,
            operator: config.operator,
            threshold: Number(config.threshold),
            delayMinutes: Number(config.delayMinutes),
            maxRetries: Number(config.maxRetries),
          }
          // Remove any errorCodes if present
          return metricConfig
        } else if (config.type === 'fieldExtractor') {
          // Field Extractor retry: NO errorCodes field
          const fieldConfig: any = {
            type: 'fieldExtractor',
            fieldName: config.fieldName,
            operator: config.operator,
            delayMinutes: Number(config.delayMinutes),
            maxRetries: Number(config.maxRetries),
          }
          // Include expectedValue only if operator is not 'missing'
          // Type assertion needed because operator can be either metric or fieldExtractor type
          const fieldOperator = config.operator as 'missing' | 'equals' | 'not_equals' | 'contains' | 'not_contains' | undefined
          if (fieldOperator && fieldOperator !== 'missing' && config.expectedValue) {
            fieldConfig.expectedValue = config.expectedValue
          }
          // Remove any errorCodes if present
          return fieldConfig
        }
        return config
      })

      const scheduleResponse = await fetch('/api/campaigns/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId,
          startTime: values.callWindowStart,
          endTime: values.callWindowEnd,
          timezone: values.timezone,
          startDate: scheduleDate,
          frequency: values.reservedConcurrency,
          enabled: true,
          days: values.selectedDays.length > 0 ? values.selectedDays : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          retryConfig: formattedRetryConfig,
        }),
      })

      if (!scheduleResponse.ok) {
        const error = await scheduleResponse.json()
        throw new Error(error.error || 'Failed to schedule campaign')
      }

      // Success!
      alert('Campaign created successfully!')
      router.push(`/${projectId}/campaigns/${campaignId}`)
    } catch (error) {
      console.error('Campaign creation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create campaign. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDraft = (values: typeof initialValues) => {
    console.log('Saving draft:', values)
    router.push(`/${projectId}/campaigns`)
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${projectId}/campaigns`)}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Create a batch call
          </h1>
        </div>
      </div>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue, isSubmitting, dirty, isValid, handleSubmit: formikHandleSubmit }) => (
          <div className="flex-1 overflow-hidden flex">
            {/* Left Panel - Form */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Form Fields */}
                <CampaignFormFields 
                  onFieldChange={setFieldValue}
                  values={values}
                  projectId={projectId}
                />

                {/* CSV Upload */}
                <CsvUploadSection
                  csvFile={csvFile}
                  csvData={csvData}
                  onFileUpload={handleFileUpload}
                  onRemoveFile={handleRemoveFile}
                />

                {/* Retry Configuration */}
                <RetryConfiguration
                  onFieldChange={setFieldValue}
                  values={{
                    retryConfig: values.retryConfig,
                    agentId: values.agentId,
                  }}
                />

                {/* Schedule Selector */}
                <ScheduleSelector
                    sendType={values.sendType}
                    onSendTypeChange={(type) => setFieldValue('sendType', type)}
                    onTimezoneChange={(tz) => setFieldValue('timezone', tz)}
                    timezone={values.timezone}
                    callWindowStart={values.callWindowStart}
                    callWindowEnd={values.callWindowEnd}
                    onCallWindowChange={setFieldValue}
                    selectedDays={values.selectedDays}
                    onDaysChange={(days) => setFieldValue('selectedDays', days)}
                />

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pb-4">
                  {/* <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSaveDraft(values)}
                    disabled={!dirty || isSubmitting}
                    className="flex-1 h-8 text-xs"
                  >
                    Save as draft
                  </Button> */}
                  <Button
                    type="button"
                    onClick={() => formikHandleSubmit()}
                    disabled={!isValid || csvData.length === 0 || isSubmitting || validationErrors.length > 0}
                    className="flex-1 h-8 text-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Send'
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Panel - Recipients Preview */}
            <RecipientsPreview csvData={csvData} />
          </div>
        )}
      </Formik>
    </div>
  )
}

export default CreateCampaign