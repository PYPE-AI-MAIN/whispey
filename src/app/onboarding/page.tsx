'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query' // ✅ ADD THIS
import { Building2, Loader2, Sparkles, ArrowRight, Rocket } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from 'react-hot-toast'
import Image from 'next/image'

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useUser()
  const queryClient = useQueryClient() // ✅ ADD THIS
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    environment: 'production'
  })

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Please enter an organization name')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create organization')
      }

      const newOrg = await response.json()

      // ✅ INVALIDATE ALL ORGANIZATION-RELATED QUERIES
      // This forces a refetch of organizations data everywhere
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['organizations'] }),
        queryClient.invalidateQueries({ queryKey: ['projects'] }),
        queryClient.invalidateQueries({ queryKey: ['project', newOrg.id] })
      ])

      // Save as last visited org
      if (typeof window !== 'undefined') {
        localStorage.setItem('whispey-last-org', newOrg.id)
      }

      toast.success('Organization created successfully!')
      
      // ✅ Small delay to ensure cache is updated before navigation
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Redirect to the new organization
      router.push(`/${newOrg.id}/agents`)
    } catch (error) {
      console.error('Error creating organization:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create organization')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <a href="https://pypeai.com/" target="_blank" rel="noopener noreferrer">
              <Image
                src="/logo-light.png"
                alt="Pype Logo"
                width={48}
                height={48}
                className="animate-bounce dark:hidden"
              />
              <Image
                src="/logo-dark.png"
                alt="Pype Logo"
                width={48}
                height={48}
                className="animate-bounce hidden dark:block"
              />
            </a>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Welcome to Whispey!
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Let's get you started by creating your first organization
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-primary/20 shadow-xl bg-card">
            <CardHeader className="space-y-4 pb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <CardTitle className="text-2xl font-bold text-foreground mb-2">
                  Create Your Organization
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  This will be your workspace for managing voice AI agents
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleCreateOrganization} className="space-y-6">
                {/* Organization Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                    Organization Name *
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Acme Corp, My Startup"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-11 bg-card border-border text-foreground"
                    maxLength={100}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a name that represents your team or project
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs font-medium text-muted-foreground">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="What will you use this organization for?"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-[100px] bg-card border-border text-foreground resize-none"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground">
                    Help your team understand the purpose of this organization
                  </p>
                </div>

                {/* Environment */}
                <div className="space-y-2">
                  <Label htmlFor="environment" className="text-xs font-medium text-muted-foreground">
                    Environment
                  </Label>
                  <Select
                    value={formData.environment}
                    onValueChange={(value) => setFormData({ ...formData, environment: value })}
                  >
                    <SelectTrigger className="h-11 bg-card border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="production" className="text-foreground">
                        Production
                      </SelectItem>
                      <SelectItem value="development" className="text-foreground">
                        Development
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    You can create multiple organizations for different environments
                  </p>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        What you'll get:
                      </p>
                      <ul className="text-sm text-primary space-y-1">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                          Voice agent management dashboard
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                          Real-time observability and analytics
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isCreating || !formData.name.trim()}
                  className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating Organization...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5 mr-2" />
                      Create Organization
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Footer Note */}
          <div className="text-center mt-8">
            <p className="text-sm text-muted-foreground">
              You can create more organizations or invite team members later from settings
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}