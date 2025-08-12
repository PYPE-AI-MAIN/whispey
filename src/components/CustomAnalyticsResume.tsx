'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  BarChart3, 
  PieChart as PieChartIcon,
  Download,
  Share,
  RefreshCw
} from 'lucide-react'

interface CustomAnalyticResult {
  id: string
  name: string
  type: 'total' | 'chart' | 'summary'
  value: number | any[]
  previousValue?: number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  color: string
  chartType?: 'line' | 'bar' | 'pie'
  description?: string
}

interface CustomAnalyticsResumeProps {
  results: CustomAnalyticResult[]
  isLoading?: boolean
  onRefresh?: () => void
  onExport?: () => void
}

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

const CustomAnalyticsResume: React.FC<CustomAnalyticsResumeProps> = ({
  results,
  isLoading = false,
  onRefresh,
  onExport
}) => {
  const renderChart = (data: any[], type: string, color: string) => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2} 
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.slice(0, 5)}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill={color}
              >
                {data.slice(0, 5).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  const renderTotalCard = (result: CustomAnalyticResult) => (
    <Card key={result.id} className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-gray-900">
            {result.name}
          </CardTitle>
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: result.color }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">
              {typeof result.value === 'number' ? result.value.toLocaleString() : '—'}
            </span>
            {result.change !== undefined && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                result.changeType === 'increase' 
                  ? 'bg-green-100 text-green-700' 
                  : result.changeType === 'decrease'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {result.changeType === 'increase' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : result.changeType === 'decrease' ? (
                  <TrendingDown className="w-3 h-3" />
                ) : null}
                {Math.abs(result.change)}%
              </div>
            )}
          </div>
          {result.description && (
            <p className="text-sm text-gray-600">{result.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const renderChartCard = (result: CustomAnalyticResult) => (
    <Card key={result.id} className="col-span-2 hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium text-gray-900 flex items-center gap-2">
              {result.name}
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: result.color }}
              />
            </CardTitle>
            {result.description && (
              <p className="text-sm text-gray-500 mt-1">{result.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {result.chartType}
            </Badge>
            {result.chartType === 'line' && <TrendingUp className="w-4 h-4 text-blue-500" />}
            {result.chartType === 'bar' && <BarChart3 className="w-4 h-4 text-green-500" />}
            {result.chartType === 'pie' && <PieChartIcon className="w-4 h-4 text-purple-500" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {Array.isArray(result.value) && result.chartType ? 
          renderChart(result.value, result.chartType, result.color) :
          <div className="h-48 flex items-center justify-center text-gray-500">
            No chart data available
          </div>
        }
      </CardContent>
    </Card>
  )

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Analytics Yet</h3>
        <p className="text-gray-500 mb-6">Create custom totals and charts to see your personalized dashboard here</p>
        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          <Calculator className="w-4 h-4 mr-2" />
          Create Your First Analytics
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Custom Analytics Resume</h2>
          <p className="text-sm text-gray-500">Your personalized insights and metrics</p>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Share className="w-4 h-4 mr-1" />
            Share
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {results.filter(r => r.type === 'total').length}
            </div>
            <div className="text-sm text-gray-600">Custom Totals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {results.filter(r => r.type === 'chart').length}
            </div>
            <div className="text-sm text-gray-600">Custom Charts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {results.filter(r => r.type === 'summary').length}
            </div>
            <div className="text-sm text-gray-600">Summary Reports</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {results.filter(r => r.changeType === 'increase').length}
            </div>
            <div className="text-sm text-gray-600">Trending Up</div>
          </CardContent>
        </Card>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map(result => {
          if (result.type === 'chart') {
            return renderChartCard(result)
          } else {
            return renderTotalCard(result)
          }
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Updating analytics...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomAnalyticsResume
