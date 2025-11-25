'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Trash2,
  AlertTriangle,
  Database,
  Calendar,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'

interface DataManagementProps {
  projectId: string
}

const DataManagement: React.FC<DataManagementProps> = ({ projectId }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [daysOld, setDaysOld] = useState('90')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteType, setDeleteType] = useState<'project' | 'agent' | 'session' | 'cleanup' | null>(null)

  const handleDelete = async (type: 'project' | 'agent' | 'session' | 'cleanup', id?: string) => {
    const confirmMessage = {
      project: `Delete all errors for project on ${selectedDate}?`,
      agent: `Delete all errors for agent on ${selectedDate}?`,
      session: `Delete all errors for session ${id}?`,
      cleanup: `Delete all errors older than ${daysOld} days?`
    }[type]

    if (!confirm(confirmMessage)) return

    setIsDeleting(true)
    setDeleteType(type)

    try {
      const response = await fetch(`/api/admin/delete-errors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          projectId: type === 'project' ? projectId : undefined,
          agentId: type === 'agent' ? id : undefined,
          sessionId: type === 'session' ? id : undefined,
          date: selectedDate,
          daysOld: type === 'cleanup' ? parseInt(daysOld) : undefined
        })
      })

      if (!response.ok) throw new Error('Failed to delete errors')
      alert('Errors deleted successfully')
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete errors')
    } finally {
      setIsDeleting(false)
      setDeleteType(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management & Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Delete Project Errors */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold mb-1">Delete Project Errors</h3>
                <p className="text-sm text-gray-500">Remove all errors for this project on a specific date</p>
              </div>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
              <Button
                variant="destructive"
                onClick={() => handleDelete('project')}
                disabled={isDeleting}
              >
                {isDeleting && deleteType === 'project' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Project Errors
              </Button>
            </div>
          </div>

          {/* Cleanup Old Errors */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold mb-1">Cleanup Old Errors</h3>
                <p className="text-sm text-gray-500">Delete errors older than specified days</p>
              </div>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="daysOld">Days:</Label>
                <Input
                  id="daysOld"
                  type="number"
                  value={daysOld}
                  onChange={(e) => setDaysOld(e.target.value)}
                  className="w-24"
                  min="1"
                />
              </div>
              <Button
                variant="destructive"
                onClick={() => handleDelete('cleanup')}
                disabled={isDeleting}
              >
                {isDeleting && deleteType === 'cleanup' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Cleanup Old Errors
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Warning</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  These operations are permanent and cannot be undone. Please ensure you have backups before proceeding.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DataManagement

