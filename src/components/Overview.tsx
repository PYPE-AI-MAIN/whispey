'use client'
import React from 'react'
import { Tooltip } from 'recharts'
import { EnhancedChartBuilder } from './EnhancedChartBuilder'

import {
  Phone,
  Clock,
  CheckCircle,
  TrendUp,
  CircleNotch,
  Warning,
  CalendarBlank,
  CurrencyDollar,
  Lightning,
  XCircle,
  ChartBar,
  Activity,
  Target,
  Users,
  Percent,
  ArrowUp,
  ArrowDown,
} from 'phosphor-react'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useOverviewQuery } from '../hooks/useOverviewQuery'
import AgentCustomLogsView from './calls/AgentCustomLogsView'

interface OverviewProps {
  project: any
  agent: any
  dateRange: {
    from: string
    to: string
  }
  quickFilter?: string
  isCustomRange?: boolean
}

const Overview: React.FC<OverviewProps> = ({ 
  project, 
  agent,
  dateRange
}) => {
  const { data: analytics, loading, error } = useOverviewQuery({
    agentId: agent.id,
    dateFrom: dateRange.from,
    dateTo: dateRange.to
  })

  // Prepare chart data
  const successFailureData = (analytics?.successfulCalls !== undefined && analytics?.totalCalls !== undefined) ? [
    { name: 'Success', value: analytics.successfulCalls, color: '#007AFF' },
    { name: 'Failed', value: analytics.totalCalls - analytics.successfulCalls, color: '#FF3B30' }
  ] : []

  const successRate = (analytics?.totalCalls && analytics?.successfulCalls !== undefined && analytics.totalCalls > 0) 
    ? (analytics.successfulCalls / analytics.totalCalls) * 100 
    : 0

  if (loading) {
    return (
      <div className="h-full bg-gray-25 flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mx-auto shadow-sm">
              <CircleNotch weight="light" className="w-7 h-7 animate-spin text-gray-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Loading Analytics</h3>
            <p className="text-sm text-gray-500">Fetching your dashboard data</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full bg-gray-25 flex items-center justify-center p-6" style={{ backgroundColor: '#fafafa' }}>
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-16 h-16 bg-white rounded-2xl border border-red-200 flex items-center justify-center mx-auto shadow-sm">
            <Warning weight="light" className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-900">Unable to Load Analytics</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full" style={{ backgroundColor: '#fafafa' }}>
      <div className="p-8 space-y-8">
        {analytics ? (
          <>
            {/* Smaller Metrics Grid */}
            <div className="grid grid-cols-6 gap-4">
              {/* Total Calls */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <Phone weight="regular" className="w-5 h-5 text-blue-600" />
                      </div>
                      
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Calls</h3>
                      <p className="text-2xl font-light text-gray-900 tracking-tight">{analytics?.totalCalls?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400 font-medium">All time</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Minutes */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                        <Clock weight="regular" className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          {analytics?.totalCalls && analytics?.totalMinutes ? Math.round(analytics.totalMinutes / analytics.totalCalls) : 0}m avg
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Minutes</h3>
                      <p className="text-2xl font-light text-gray-900 tracking-tight">{analytics?.totalMinutes?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400 font-medium">Duration</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Cost */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <CurrencyDollar weight="regular" className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500">INR</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Cost</h3>
                      <p className="text-2xl font-light text-gray-900 tracking-tight">₹{analytics?.totalCost?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-gray-400 font-medium">Cumulative</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Latency */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                        <Lightning weight="regular" className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">avg</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Response Time</h3>
                      <p className="text-2xl font-light text-gray-900 tracking-tight">{analytics?.averageLatency?.toFixed(2) || '0.00'}<span className="text-lg text-gray-400 ml-1">s</span></p>
                      <p className="text-xs text-gray-400 font-medium">Performance</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Successful Calls */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <CheckCircle weight="regular" className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                          <ArrowUp weight="bold" className="w-3 h-3 text-green-600" />
                          <span className="text-xs font-bold text-green-600">
                            {analytics ? successRate.toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Successful</h3>
                      <p className="text-2xl font-light text-green-600 tracking-tight">{analytics?.successfulCalls?.toLocaleString() || '0'}</p>
                      <p className="text-xs text-gray-400 font-medium">Completed calls</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Failed Calls */}
              <div className="group">
                <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                        <XCircle weight="regular" className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                          <ArrowDown weight="bold" className="w-3 h-3 text-red-600" />
                          <span className="text-xs font-bold text-red-600">
                            {analytics ? (100 - successRate).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Failed</h3>
                      <p className="text-2xl font-light text-red-600 tracking-tight">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls).toLocaleString() : '0'}</p>
                      <p className="text-xs text-gray-400 font-medium">Incomplete calls</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2x2 Chart Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Daily Calls Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-7 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <TrendUp weight="regular" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Daily Call Volume</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Trend analysis over selected period</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500">Peak</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {analytics?.dailyData ? Math.max(...analytics.dailyData.map(d => d.calls || 0)) : 0}
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200"></div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500">Avg</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {analytics?.dailyData ? Math.round(analytics.dailyData.reduce((sum, d) => sum + (d.calls || 0), 0) / analytics.dailyData.length) : 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={45}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            backdropFilter: 'blur(20px)'
                          }}
                          labelStyle={{ color: '#374151', fontWeight: '600' }}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                          formatter={(value) => [`${value}`, 'Calls']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="calls" 
                          stroke="#007aff" 
                          strokeWidth={3}
                          fill="url(#callsGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: '#007aff', 
                            strokeWidth: 3, 
                            stroke: '#ffffff',
                            filter: 'drop-shadow(0 2px 4px rgba(0, 122, 255, 0.3))'
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Professional Success Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-7 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                        <Target weight="regular" className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Success Analysis</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Call completion metrics</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500">Success Rate</div>
                      <div className="text-2xl font-light text-green-600">{analytics ? successRate.toFixed(1) : '0.0'}%</div>
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <div className="h-80 flex items-center justify-center">
                    <div className="relative">
                      {/* Modern Ring Chart */}
                      <div className="w-48 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={successFailureData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={2}
                              dataKey="value"
                              strokeWidth={0}
                              startAngle={90}
                              endAngle={450}
                            >
                              {successFailureData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                backdropFilter: 'blur(20px)'
                              }}
                              formatter={(value, name) => [`${value} calls`, name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Center Statistics */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-3xl font-light text-gray-900 mb-1">{analytics?.totalCalls || 0}</div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="ml-8 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#007AFF' }}></div>
                        <div className="text-sm font-medium text-gray-700">Successful</div>
                        <div className="text-sm font-light text-gray-500">{analytics?.successfulCalls || 0}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF3B30' }}></div>
                        <div className="text-sm font-medium text-gray-700">Failed</div>
                        <div className="text-sm font-light text-gray-500">{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls) : 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Minutes Chart */}
              <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-7 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <ChartBar weight="regular" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Usage Minutes</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Daily conversation duration</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#007aff" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#007aff" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}m`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value) => [`${value} min`, 'Duration']}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                        />
                        <Bar 
                          dataKey="minutes" 
                          fill="url(#minutesGradient)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Average Latency Chart */}
              <div className="bg-white rounded-xl border border-gray-300 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="border-b border-gray-200 px-7 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
                        <Activity weight="regular" className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Response Performance</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Average latency metrics</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                        <defs>
                          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff9500" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#ff9500" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 1" stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          height={40}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                          width={40}
                          tickFormatter={(value) => `${value}s`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '500',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            backdropFilter: 'blur(20px)'
                          }}
                          formatter={(value) => [`${value}s`, 'Latency']}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('en-US', { 
                              weekday: 'short',
                              month: 'short', 
                              day: 'numeric' 
                            })
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avg_latency" 
                          stroke="#ff9500" 
                          strokeWidth={3}
                          fill="url(#latencyGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: '#ff9500', 
                            strokeWidth: 3, 
                            stroke: '#ffffff',
                            filter: 'drop-shadow(0 2px 4px rgba(255, 149, 0, 0.3))'
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Components */}
            <div className="space-y-6">
              <AgentCustomLogsView
                agentId={agent.id}
                dateRange={dateRange}
              />

              <EnhancedChartBuilder 
                agentId={agent.id}
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-8">
              <div className="w-20 h-20 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mx-auto shadow-sm">
                <CalendarBlank weight="light" className="w-10 h-10 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-medium text-gray-900">No Data Available</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  No calls found for the selected time period. Try adjusting your date range or check back later.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Overview