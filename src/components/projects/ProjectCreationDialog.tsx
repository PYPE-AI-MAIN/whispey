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
import { Loader2, Copy, Eye, EyeOff, CheckCircle } from 'lucide-react'

interface ProjectCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (project: any) => void
}

const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onProjectCreated 
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProjectData, setCreatedProjectData] = useState<any>(null)
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Project name is required')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()
      setCreatedProjectData(data)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('Error creating project:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToken = async () => {
    if (createdProjectData?.api_token) {
      try {
        await navigator.clipboard.writeText(createdProjectData.api_token)
        setTokenCopied(true)
        setTimeout(() => setTokenCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy token:', err)
      }
    }
  }

  const handleClose = () => {
    if (!loading) {
      // Reset all state
      setCurrentStep('form')
      setFormData({
        name: '',
        description: ''
      })
      setError(null)
      setCreatedProjectData(null)
      setShowToken(false)
      setTokenCopied(false)
      onClose()
    }
  }

  const handleFinish = () => {
    // Call success callback with the created project
    onProjectCreated(createdProjectData)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 p-0 gap-0 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Create New Project
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Set up your voice AI project with automatic API token generation
              </p>
            </DialogHeader>

            {/* Form */}
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Project Name */}
                <div>
                  <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Project Name
                  </label>
                  <Input
                    id="project-name"
                    placeholder="Enter project name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-11 px-4 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Description
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    placeholder="Brief description of your project..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:outline-none resize-none transition-all"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 h-11 font-medium cursor-pointer bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg transition-all"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 h-11 cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 dark:disabled:text-gray-400 rounded-lg font-medium shadow-sm transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Create Project'
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
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Project Created Successfully!
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Your project "{createdProjectData?.name}" has been created with API access
              </p>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* API Token */}
              {/* <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  API Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={createdProjectData?.api_token || ''}
                    readOnly
                    className="w-full h-11 px-4 pr-20 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowToken(!showToken)}
                      className="h-7 w-7 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyToken}
                      className="h-7 w-7 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {tokenCopied && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Token copied to clipboard!</p>
                )}
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Important:</strong> This token will only be shown once. Please save it in a secure location.
                  You can regenerate it later if needed.
                </p>
              </div> */}

              {/* Project Details */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">Project Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">ID:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{createdProjectData?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Environment:</span>
                    <span className="text-gray-800 dark:text-gray-200">{createdProjectData?.environment}</span>
                  </div>
                </div>
              </div>

              {/* Finish Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleFinish}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all"
                >
                  Continue to Project
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ProjectCreationDialog