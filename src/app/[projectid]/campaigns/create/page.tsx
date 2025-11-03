// app/[projectid]/campaigns/create/page.tsx
'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { RecipientRow, CsvValidationError, PhoneNumber } from '@/utils/campaigns/constants'
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
      errorCodes: Yup.array().of(Yup.string()).required(),
      delayMinutes: Yup.number()
        .required('Delay minutes is required')
        .min(0, 'Must be at least 0')
        .max(1440, 'Cannot exceed 1440 minutes'),
      maxRetries: Yup.number()
        .required('Max retries is required')
        .min(0, 'Must be at least 0')
        .max(10, 'Cannot exceed 10'),
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
        errorCodes: ['480'],
        delayMinutes: 30,
        maxRetries: 2,
      },
      {
        errorCodes: ['486'],
        delayMinutes: 30,
        maxRetries: 2,
      },
    ],
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
      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n')

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
          agentName: values.agentId,
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
          retryConfig: values.retryConfig,
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