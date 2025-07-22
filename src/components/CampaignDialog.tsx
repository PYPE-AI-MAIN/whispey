"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle, Upload, Calendar, Clock, RotateCcw, Rocket } from 'lucide-react'

interface CampaignDialogProps {
  isOpen: boolean
  onClose: () => void
  onCampaignCreated?: (campaignData: any) => void
  agent: any
}

const CampaignDialog: React.FC<CampaignDialogProps> = ({ 
  isOpen, 
  onClose, 
  onCampaignCreated,
  agent
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '17:00',
    concurrency: 10,
    retry_config: {
      '408': 60,  // Request Timeout
      '480': 60,  // Temporarily Unavailable
      '486': 120, // Busy Here
      '504': 60,  // Server Timeout
      '600': 120  // Busy Everywhere
    }
  })
  
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaignResult, setCampaignResult] = useState<any>(null)

  // Set default dates to today and tomorrow
  React.useEffect(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    setFormData(prev => ({
      ...prev,
      start_date: today.toISOString().split('T')[0],
      end_date: tomorrow.toISOString().split('T')[0]
    }))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('Please select a CSV file')
        return
      }
      setCsvFile(file)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.start_date || !formData.end_date) {
      setError('Start date and end date are required')
      return
    }

    if (!csvFile) {
      setError('Please select a CSV file')
      return
    }

    // Validate retry configuration
    const retryValues = Object.values(formData.retry_config)
    if (retryValues.some(val => val < 1 || val > 1440)) {
      setError('Retry intervals must be between 1 and 1440 minutes (24 hours)')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Create campaign using the unified API
      const campaignFormData = new FormData()
      
      // Add all form fields to FormData
      campaignFormData.append('project_id', agent.project_id)
      campaignFormData.append('start_date', formData.start_date)
      campaignFormData.append('end_date', formData.end_date)
      campaignFormData.append('start_time', formData.start_time)
      campaignFormData.append('end_time', formData.end_time)
      campaignFormData.append('concurrency', formData.concurrency.toString())
      campaignFormData.append('retry_config', JSON.stringify(formData.retry_config))
      campaignFormData.append('csv_file', csvFile)
      
      const response = await fetch('/api/campaign', {
        method: 'POST',
        body: campaignFormData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create campaign')
      }

      const result = await response.json()
      setCampaignResult(result)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('Error creating campaign:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create campaign'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      // Reset all state
      setCurrentStep('form')
      setFormData({
        start_date: '',
        end_date: '',
        start_time: '09:00',
        end_time: '17:00',
        concurrency: 10,
        retry_config: {
          '408': 60,
          '480': 60,
          '486': 120,
          '504': 60,
          '600': 120
        }
      })
      setCsvFile(null)
      setError(null)
      setCampaignResult(null)
      onClose()
    }
  }

  const handleFinish = () => {
    // Call success callback with the campaign result
    if (onCampaignCreated) {
      onCampaignCreated(campaignResult)
    }
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 rounded-xl border shadow-2xl max-h-[90vh] overflow-y-auto">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-1 flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5" />
                Run Campaign
              </DialogTitle>
              <p className="text-sm text-gray-600 font-normal">
                Configure and launch a campaign for "{agent?.name}"
              </p>
            </DialogHeader>

            {/* Form */}
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Campaign Schedule */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                    <Calendar className="w-4 h-4" />
                    Campaign Schedule
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Start Date */}
                    <div>
                      <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <Input
                        id="start-date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        disabled={loading}
                        className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    {/* End Date */}
                    <div>
                      <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <Input
                        id="end-date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        disabled={loading}
                        className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Start Time */}
                    <div>
                      <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Start Time <span className="text-gray-500 text-xs">(24-hour format)</span>
                      </label>
                      <Input
                        id="start-time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        disabled={loading}
                        placeholder="09:00"
                        step="300"
                        className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                      />
                    </div>

                    {/* End Time */}
                    <div>
                      <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        End Time <span className="text-gray-500 text-xs">(24-hour format)</span>
                      </label>
                      <Input
                        id="end-time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        disabled={loading}
                        placeholder="17:00"
                        step="300"
                        className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Concurrency */}
                  <div>
                    <label htmlFor="concurrency" className="block text-sm font-medium text-gray-700 mb-2">
                      Concurrency (simultaneous calls)
                    </label>
                    <Input
                      id="concurrency"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.concurrency}
                      onChange={(e) => setFormData({ ...formData, concurrency: parseInt(e.target.value) || 1 })}
                      disabled={loading}
                      className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>

                {/* Retry Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                    <RotateCcw className="w-4 h-4" />
                    Retry Configuration
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <p className="text-sm text-gray-600">Configure retry intervals (in minutes) for different call failure types:</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Request Timeout (408) */}
                      <div>
                        <label htmlFor="retry-408" className="block text-sm font-medium text-gray-700 mb-2">
                          Request Timeout (408)
                        </label>
                        <Input
                          id="retry-408"
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.retry_config['408']}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            retry_config: { 
                              ...formData.retry_config, 
                              '408': parseInt(e.target.value) || 1 
                            }
                          })}
                          disabled={loading}
                          placeholder="Minutes"
                          className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Temporarily Unavailable (480) */}
                      <div>
                        <label htmlFor="retry-480" className="block text-sm font-medium text-gray-700 mb-2">
                          No Answer (480)
                        </label>
                        <Input
                          id="retry-480"
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.retry_config['480']}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            retry_config: { 
                              ...formData.retry_config, 
                              '480': parseInt(e.target.value) || 1 
                            }
                          })}
                          disabled={loading}
                          placeholder="Minutes"
                          className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Busy Here (486) */}
                      <div>
                        <label htmlFor="retry-486" className="block text-sm font-medium text-gray-700 mb-2">
                          User Busy (486)
                        </label>
                        <Input
                          id="retry-486"
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.retry_config['486']}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            retry_config: { 
                              ...formData.retry_config, 
                              '486': parseInt(e.target.value) || 1 
                            }
                          })}
                          disabled={loading}
                          placeholder="Minutes"
                          className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Server Timeout (504) */}
                      <div>
                        <label htmlFor="retry-504" className="block text-sm font-medium text-gray-700 mb-2">
                          Server Timeout (504)
                        </label>
                        <Input
                          id="retry-504"
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.retry_config['504']}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            retry_config: { 
                              ...formData.retry_config, 
                              '504': parseInt(e.target.value) || 1 
                            }
                          })}
                          disabled={loading}
                          placeholder="Minutes"
                          className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>

                      {/* Busy Everywhere (600) */}
                      <div>
                        <label htmlFor="retry-600" className="block text-sm font-medium text-gray-700 mb-2">
                          Busy Everywhere (600)
                        </label>
                        <Input
                          id="retry-600"
                          type="number"
                          min="1"
                          max="1440"
                          value={formData.retry_config['600']}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            retry_config: { 
                              ...formData.retry_config, 
                              '600': parseInt(e.target.value) || 1 
                            }
                          })}
                          disabled={loading}
                          placeholder="Minutes"
                          className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> Retry intervals determine how long to wait before retrying a failed call. 
                        Set higher values for busy/unavailable scenarios and lower values for timeouts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CSV Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                    <Upload className="w-4 h-4" />
                    Campaign Data
                  </h3>
                  
                  <div>
                    <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 mb-2">
                      Upload CSV File
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                      <input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={loading}
                        className="hidden"
                      />
                      <label 
                        htmlFor="csv-file" 
                        className="cursor-pointer block"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        {csvFile ? (
                          <p className="text-sm font-medium text-gray-900">
                            {csvFile.name}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-600">
                            Click to select CSV file or drag and drop
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          CSV file with phoneNumber, fpoName, fpoLoginId, alternative_number columns
                        </p>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 h-11 font-medium text-gray-700 border-gray-300 hover:bg-gray-50 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !csvFile}
                    className="flex-1 h-11 text-white rounded-lg font-medium shadow-sm disabled:bg-gray-300 disabled:text-gray-500 transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Launching Campaign...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Launch Campaign
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-1">
                Campaign Launched Successfully!
              </DialogTitle>
              <p className="text-sm text-gray-600 font-normal">
                Your campaign for "{agent?.name}" has been launched and scheduled
              </p>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* Campaign Details */}
              {campaignResult?.campaign && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 text-sm mb-2 flex items-center gap-2">
                    <Rocket className="w-4 h-4" />
                    Campaign Details
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Period:</span>
                      <span className="text-blue-900">
                        {campaignResult.campaign.start_date} to {campaignResult.campaign.end_date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Time:</span>
                      <span className="text-blue-900">
                        {campaignResult.campaign.start_time} - {campaignResult.campaign.end_time}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Calls:</span>
                      <span className="text-blue-900">{campaignResult.campaign.call_count} contacts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Concurrency:</span>
                      <span className="text-blue-900">{campaignResult.campaign.concurrency} simultaneous</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Note */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800">
                  <strong>Success:</strong> Your campaign has been scheduled and will run automatically according to the configured schedule. You can monitor progress in the call logs.
                </p>
              </div>

              {/* Finish Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleFinish}
                  className="w-full h-11 text-white rounded-lg font-medium shadow-sm"
                >
                  View Campaign Progress
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default CampaignDialog 