'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Loader2,
  Search,
  User,
  AlertCircle
} from 'lucide-react'

interface CustomerTrackingProps {
  projectId: string
}

const CustomerTracking: React.FC<CustomerTrackingProps> = ({ projectId }) => {
  const [customerNumber, setCustomerNumber] = useState('')
  const [searchCustomer, setSearchCustomer] = useState('')

  // Fetch customer errors
  const { data: customerData, isLoading, refetch } = useQuery({
    queryKey: ['customer-errors', searchCustomer],
    queryFn: async () => {
      if (!searchCustomer) return null

      const response = await fetch(`/api/admin/customer-errors?customerNumber=${searchCustomer}`)
      if (!response.ok) throw new Error('Failed to fetch customer errors')
      return response.json()
    },
    enabled: !!searchCustomer
  })

  const handleSearch = () => {
    if (customerNumber.trim()) {
      setSearchCustomer(customerNumber.trim())
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Error Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter customer number..."
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!customerNumber.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : customerData ? (
        <div className="space-y-6">
          {/* Customer Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer: {searchCustomer}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Total Errors</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {customerData.totalErrors || 0}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Unique Sessions</div>
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {customerData.uniqueSessions || 0}
                  </div>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-green-600 dark:text-green-400 mb-1">Components Affected</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {Object.keys(customerData.componentBreakdown || {}).length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error List */}
          {customerData.errors && customerData.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Error History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {customerData.errors.map((error: any, index: number) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{error.Component}</Badge>
                        <Badge variant="outline">{error.ErrorType}</Badge>
                        {error.SipStatus && <Badge variant="secondary">SIP {error.SipStatus}</Badge>}
                        {error.HttpStatus && <Badge variant="secondary">HTTP {error.HttpStatus}</Badge>}
                      </div>
                      {error.ErrorMessage && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          {error.ErrorMessage}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {new Date(error.Timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : searchCustomer ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-500">No errors found for this customer</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export default CustomerTracking

