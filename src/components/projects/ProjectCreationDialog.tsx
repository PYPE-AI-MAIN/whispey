"use client"

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle } from 'lucide-react'

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
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProjectData, setCreatedProjectData] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Organization name is required')
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
        throw new Error(errorData.error || 'Failed to create organization')
      }

      const data = await response.json()
      setCreatedProjectData(data)
      setCurrentStep('success')
      
      // Invalidate the organizations query to refetch the list
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      
      // Show success toast
      toast.success(`Organization "${data.name}" created successfully!`)
      
    } catch (err: unknown) {
      console.error('Error creating project:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create organization'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
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
      <DialogContent className="sm:max-w-[500px] bg-card p-0 gap-0 rounded-xl border border-border shadow-2xl">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-semibold text-foreground mb-1">
                Create New Organization
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Set up your organization with automatic API token generation
              </p>
            </DialogHeader>

            {/* Form */}
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Project Name */}
                <div>
                  <label htmlFor="project-name" className="block text-sm font-medium text-foreground mb-2">
                    Organization Name
                  </label>
                  <Input
                    id="project-name"
                    placeholder="Enter organization name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-11 px-4 text-sm bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-foreground mb-2">
                    Description
                    <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    placeholder="Brief description of your organization..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:outline-none resize-none transition-all"
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
                    className="flex-1 h-11 font-medium cursor-pointer bg-card text-foreground border-border hover:bg-muted/50 hover:text-foreground rounded-lg transition-all"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 h-11 cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-muted-foreground/30 text-white disabled:text-muted-foreground rounded-lg font-medium shadow-sm transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Create Organization'
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
              <DialogTitle className="text-xl font-semibold text-foreground mb-1">
                Organization Created Successfully!
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Your organization "{createdProjectData?.name}" has been created
              </p>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* Project Details */}
              <div className="p-3 bg-muted/50 border border-border rounded-lg">
                <h4 className="font-medium text-foreground text-sm mb-2">Organization Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono text-foreground">{createdProjectData?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="text-foreground">{createdProjectData?.environment}</span>
                  </div>
                </div>
              </div>

              {/* Finish Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleFinish}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-all"
                >
                  Continue to Organization
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