'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { 
  Trash2, 
  Plus, 
  Save, 
  Wand2, 
  Download, 
  Upload, 
  Database, 
  FileJson, 
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Zap,
  Settings,
  Sparkles,
  Edit3,
  X,
  Phone,
  Clock,
  DollarSign,
  User,
  Calendar,
  Building2,
  CheckCircle,
  ChartBar,
  FileText,
  Edit
} from 'lucide-react'

interface JsonData {
  projects: any[]
  agents: any[]
  users: any[]
  callLogs: any[]
  customOverviewMetrics?: any[]
  agentOverrideMetrics?: any[]
}

interface EditingItem {
  type: 'project' | 'agent' | 'callLog' | 'metric'
  id: string
  field: string
  value?: any
}

export default function MagicPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [jsonData, setJsonData] = useState<JsonData>({
    projects: [],
    agents: [],
    users: [],
    callLogs: [],
    customOverviewMetrics: [],
    agentOverrideMetrics: []
  })
  const [jsonString, setJsonString] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null)
  const [showAddProject, setShowAddProject] = useState(false)
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [showAddCallLog, setShowAddCallLog] = useState(false)
  const [showJsonCallLog, setShowJsonCallLog] = useState(false)
  const [jsonCallLogInput, setJsonCallLogInput] = useState('')
  const [showAddMetric, setShowAddMetric] = useState(false)
  const [showAddAgentOverride, setShowAddAgentOverride] = useState(false)

  // Form states
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    environment: 'development',
    owner_clerk_id: 'user_demo_123'
  })

  const [newAgent, setNewAgent] = useState({
    name: '',
    agent_type: 'general',
    project_id: '',
    environment: 'development',
    field_extractor: false,
    field_extractor_prompt: '',
    field_extractor_keys: [],
    configuration: {
      voice: 'alloy',
      language: 'en',
      response_time_target: 2000
    }
  })

  const [newCallLog, setNewCallLog] = useState({
    call_id: '',
    agent_id: '',
    customer_number: '',
    call_ended_reason: 'completed',
    duration_seconds: 0,
    total_stt_cost: 0,
    total_tts_cost: 0,
    total_llm_cost: 0,
    transcript_json: [],
    recording_url: '',
    avg_latency: 0,
    metadata: {}
  })

  const [customFields, setCustomFields] = useState([
    { name: 'budget_qualified', type: 'boolean', value: false },
    { name: 'decision_timeframe', type: 'text', value: '' },
    { name: 'interest_level', type: 'text', value: '' },
    { name: 'lead_score', type: 'number', value: 0 },
    { name: 'next_action', type: 'text', value: '' }
  ])

  const [editingCallLog, setEditingCallLog] = useState<any>(null)
  const [showEditCallLog, setShowEditCallLog] = useState(false)
  const [editCustomFields, setEditCustomFields] = useState<any[]>([])

  const [newMetric, setNewMetric] = useState({
    name: '',
    value: 0,
    type: 'number',
    description: '',
    agentId: '',
    projectId: ''
  })

  const [newAgentOverride, setNewAgentOverride] = useState({
    agentId: '',
    totalCalls: 0,
    totalMinutes: 0,
    totalCost: 0,
    averageResponseTime: 0,
    successRate: 0,
    successfulCalls: 0,
    failedCalls: 0,
    peakDailyCalls: 0,
    avgDailyCalls: 0,
    latencyRangeMin: 0.5,
    latencyRangeMax: 2.0
  })

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/data?type=current')
      if (response.ok) {
        const data = await response.json()
        setJsonData(data)
        setJsonString(JSON.stringify(data, null, 2))
        setJsonError('')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setJsonError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const saveData = async () => {
    setSaving(true)
    try {
      let dataToSave = jsonData
      
      if (showRaw) {
        try {
          dataToSave = JSON.parse(jsonString)
          setJsonError('')
        } catch (e) {
          setJsonError('Invalid JSON format')
          setSaving(false)
          return
        }
      }

      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      })

      if (response.ok) {
        setJsonData(dataToSave)
        setJsonString(JSON.stringify(dataToSave, null, 2))
        setJsonError('')
        
        // Show success feedback
        const originalText = 'Save Changes'
        const saveButton = document.querySelector('[data-save-button]')
        if (saveButton) {
          saveButton.textContent = 'Saved!'
          setTimeout(() => {
            saveButton.textContent = originalText
          }, 2000)
        }
      } else {
        setJsonError('Failed to save data')
      }
    } catch (error) {
      console.error('Error saving data:', error)
      setJsonError('Failed to save data')
    } finally {
      setSaving(false)
    }
  }

  // Custom Metrics Management
  const addMetric = async () => {
    if (!newMetric.name.trim()) {
      alert('Please enter a metric name')
      return
    }

    if (editingItem) {
      // Update existing metric
      const updatedMetrics = (jsonData.customOverviewMetrics || []).map((metric: any) => 
        metric.id === editingItem.id 
          ? {
              ...metric,
              ...newMetric,
              updatedAt: new Date().toISOString()
            }
          : metric
      )
      
      const updatedData = {
        ...jsonData,
        customOverviewMetrics: updatedMetrics
      }
      
      setJsonData(updatedData)
      setJsonString(JSON.stringify(updatedData, null, 2))
    } else {
      // Add new metric
      const metricData = {
        ...newMetric,
        id: `metric_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const updatedData = {
        ...jsonData,
        customOverviewMetrics: [...(jsonData.customOverviewMetrics || []), metricData]
      }

      setJsonData(updatedData)
      setJsonString(JSON.stringify(updatedData, null, 2))
    }
    
    setNewMetric({
      name: '',
      value: 0,
      type: 'number',
      description: '',
      agentId: '',
      projectId: ''
    })
    setEditingItem(null)
    setShowAddMetric(false)
  }

  const editMetric = (metric: any) => {
    setNewMetric({
      name: metric.name,
      value: metric.value,
      type: metric.type,
      description: metric.description,
      agentId: metric.agentId || '',
      projectId: metric.projectId || ''
    })
    setEditingItem({
      type: 'metric' as any,
      id: metric.id,
      field: 'all'
    })
    setShowAddMetric(true)
  }

  const deleteMetric = async (metricId: string) => {
    if (!confirm('Delete this custom metric?')) return

    const updatedData = {
      ...jsonData,
      customOverviewMetrics: (jsonData.customOverviewMetrics || []).filter((m: any) => m.id !== metricId)
    }

    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
  }

  // Agent Override Metrics Management
  const addAgentOverride = async () => {
    if (!newAgentOverride.agentId) {
      alert('Please select an agent')
      return
    }

    const agent = jsonData.agents.find(a => a.id === newAgentOverride.agentId)
    
    if (editingItem) {
      // Update existing override
      const updatedOverrides = (jsonData.agentOverrideMetrics || []).map((override: any) => 
        override.id === editingItem.id 
          ? {
              ...override,
              ...newAgentOverride,
              agentName: agent?.name || newAgentOverride.agentId,
              updatedAt: new Date().toISOString()
            }
          : override
      )
      
      const updatedData = {
        ...jsonData,
        agentOverrideMetrics: updatedOverrides
      }
      
      setJsonData(updatedData)
      setJsonString(JSON.stringify(updatedData, null, 2))
    } else {
      // Add new override
      const overrideData = {
        ...newAgentOverride,
        id: `override_${newAgentOverride.agentId}`,
        agentName: agent?.name || newAgentOverride.agentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const updatedData = {
        ...jsonData,
        agentOverrideMetrics: [...(jsonData.agentOverrideMetrics || []), overrideData]
      }

      setJsonData(updatedData)
      setJsonString(JSON.stringify(updatedData, null, 2))
    }
    
    setNewAgentOverride({
      agentId: '',
      totalCalls: 0,
      totalMinutes: 0,
      totalCost: 0,
      averageResponseTime: 0,
      successRate: 0,
      successfulCalls: 0,
      failedCalls: 0,
      peakDailyCalls: 0,
      avgDailyCalls: 0,
      latencyRangeMin: 0.5,
      latencyRangeMax: 2.0
    })
    setEditingItem(null)
    setShowAddAgentOverride(false)
  }

  const editAgentOverride = (override: any) => {
    setNewAgentOverride({
      agentId: override.agentId,
      totalCalls: override.totalCalls,
      totalMinutes: override.totalMinutes,
      totalCost: override.totalCost,
      averageResponseTime: override.averageResponseTime,
      successRate: override.successRate,
      successfulCalls: override.successfulCalls,
      failedCalls: override.failedCalls,
      peakDailyCalls: override.peakDailyCalls,
      avgDailyCalls: override.avgDailyCalls,
      latencyRangeMin: override.latencyRangeMin || 0.5,
      latencyRangeMax: override.latencyRangeMax || 2.0
    })
    setEditingItem({
      type: 'agentOverride' as any,
      id: override.id,
      field: 'all'
    })
    setShowAddAgentOverride(true)
  }

  const deleteAgentOverride = async (overrideId: string) => {
    if (!confirm('Delete this agent override?')) return

    const updatedData = {
      ...jsonData,
      agentOverrideMetrics: (jsonData.agentOverrideMetrics || []).filter((o: any) => o.id !== overrideId)
    }

    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
  }

  const resetToDefault = async () => {
    if (!confirm('Reset to default data? This will overwrite all current data.')) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      })

      if (response.ok) {
        await loadAllData()
      }
    } catch (error) {
      console.error('Error resetting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async () => {
    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Backup created: ${result.backupFile}`)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Inline editing functions
  const startEditing = (type: 'project' | 'agent' | 'callLog', id: string, field: string, currentValue: any) => {
    setEditingItem({
      type,
      id,
      field,
      value: typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue)
    })
  }

  const saveEdit = () => {
    if (!editingItem) return

    const updatedData = { ...jsonData }
    const { type, id, field, value } = editingItem

    const tableName = type === 'project' ? 'projects' : type === 'agent' ? 'agents' : 'callLogs'
    const itemIndex = updatedData[tableName].findIndex((item: any) => item.id === id)
    
    if (itemIndex !== -1 && value !== undefined) {
      let parsedValue = value
      
      // Try to parse as JSON for object fields
      if (field === 'configuration' || field === 'metadata' || field === 'transcript_json') {
        try {
          parsedValue = JSON.parse(value)
        } catch (e) {
          // If parsing fails, keep as string
        }
      } else if (field === 'duration_seconds' || field === 'total_stt_cost' || field === 'total_tts_cost' || field === 'total_llm_cost') {
        parsedValue = parseFloat(value) || 0
      } else if (field === 'field_extractor') {
        parsedValue = value === 'true'
      }

      updatedData[tableName][itemIndex] = {
        ...updatedData[tableName][itemIndex],
        [field]: parsedValue,
        updated_at: new Date().toISOString()
      }
    }

    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
    setEditingItem(null)
  }

  const cancelEdit = () => {
    setEditingItem(null)
  }

  // Add new item functions
  const addProject = async () => {
    const projectData = {
      ...newProject,
          id: `proj_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
          is_active: true,
          user_role: 'owner',
      api_token: `sk_proj_${Date.now()}_demo_token`
    }

    const updatedData = {
      ...jsonData,
      projects: [...jsonData.projects, projectData]
    }
    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
    
    // Reset form
    setNewProject({
      name: '',
      description: '',
      environment: 'development',
      owner_clerk_id: 'user_demo_123'
    })
    setShowAddProject(false)
  }

  const addAgent = async () => {
    if (!newAgent.project_id) {
      alert('Please select a project for the agent')
      return
    }

    const agentData = {
      ...newAgent,
          id: `agent_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }

    const updatedData = {
      ...jsonData,
      agents: [...jsonData.agents, agentData]
    }
    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
    
    // Reset form
    setNewAgent({
      name: '',
      agent_type: 'general',
      project_id: '',
      environment: 'development',
      field_extractor: false,
      field_extractor_prompt: '',
      field_extractor_keys: [],
      configuration: {
        voice: 'alloy',
        language: 'en',
        response_time_target: 2000
      }
    })
    setShowAddAgent(false)
  }

  const generateRealisticMetrics = (role: string, content: string, timestamp: number) => {
    const contentLength = content.length
    const baseMetrics: any = { timestamp }
    
    if (role === 'assistant') {
      // Agent metrics (all in seconds)
      baseMetrics.stt_metrics = {
        duration: (Math.random() * 0.5 + 0.8).toFixed(3), // 0.8-1.3s
        confidence: (0.94 + Math.random() * 0.05).toFixed(3), // 0.94-0.99
        processing_time: (Math.random() * 0.1 + 0.12).toFixed(3) // 0.12-0.22s
      }
      baseMetrics.llm_metrics = {
        ttft: (Math.random() * 0.2 + 0.3).toFixed(3), // 0.3-0.5s
        tokens_per_second: Math.floor(Math.random() * 5) + 10, // 10-15 tokens/sec
        total_tokens: Math.floor(contentLength / 4) + Math.floor(Math.random() * 20), // ~1 token per 4 chars + variance
        response_time: (Math.random() * 0.4 + 0.7).toFixed(3) // 0.7-1.1s
      }
      baseMetrics.tts_metrics = {
        ttfb: (Math.random() * 0.05 + 0.13).toFixed(3), // 0.13-0.18s
        audio_duration: (contentLength * 0.05 + Math.random()).toFixed(3), // ~0.05s per char + variance
        synthesis_time: (Math.random() * 0.1 + 0.2).toFixed(3) // 0.2-0.3s
      }
    } else {
      // User metrics (all in seconds)
      baseMetrics.stt_metrics = {
        duration: (Math.random() * 0.4 + 0.7).toFixed(3), // 0.7-1.1s
        confidence: (0.90 + Math.random() * 0.08).toFixed(3), // 0.90-0.98
        processing_time: (Math.random() * 0.08 + 0.1).toFixed(3) // 0.1-0.18s
      }
      baseMetrics.eou_metrics = {
        end_of_utterance_delay: (Math.random() * 0.03 + 0.07).toFixed(3), // 0.07-0.1s
        confidence: (0.85 + Math.random() * 0.10).toFixed(3) // 0.85-0.95
      }
    }
    
    return baseMetrics
  }

  const generateSampleConversation = () => {
    const agentName = jsonData.agents.find(a => a.id === newCallLog.agent_id)?.name || 'Agent'
    const startTime = Math.floor(Date.now() / 1000)
    
    const sampleConversation = [
      {
        role: 'assistant',
        content: `Hello, this is ${agentName}. How can I help you today?`,
        ...generateRealisticMetrics('assistant', `Hello, this is ${agentName}. How can I help you today?`, startTime)
      },
      {
        role: 'user',
        content: 'Hi, I\'m interested in learning more about your services.',
        ...generateRealisticMetrics('user', 'Hi, I\'m interested in learning more about your services.', startTime + 8)
      },
      {
        role: 'assistant',
        content: 'Great! I\'d be happy to tell you about our solutions. What specific area are you most interested in?',
        ...generateRealisticMetrics('assistant', 'Great! I\'d be happy to tell you about our solutions. What specific area are you most interested in?', startTime + 15)
      },
      {
        role: 'user',
        content: 'I\'m looking for something to help streamline our business processes.',
        ...generateRealisticMetrics('user', 'I\'m looking for something to help streamline our business processes.', startTime + 23)
      }
    ]
    
    // Generate realistic custom field values
    const generatedFields = customFields.map(field => ({
      ...field,
      value: field.type === 'boolean' ? Math.random() > 0.5 :
             field.type === 'number' ? Math.floor(Math.random() * 100) :
             ['high', 'medium', 'low', 'within_month', 'schedule_demo', 'qualified'][Math.floor(Math.random() * 6)]
    }))
    
    setCustomFields(generatedFields)
    setNewCallLog({ 
      ...newCallLog, 
      transcript_json: sampleConversation as any,
      avg_latency: parseFloat((Math.random() * 0.5 + 0.8).toFixed(3))
    })
  }

  const addCustomField = () => {
    setCustomFields([...customFields, { name: '', type: 'text', value: '' }])
  }

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const updateCustomField = (index: number, field: string, value: any) => {
    const updated = [...customFields]
    updated[index] = { ...updated[index], [field]: value }
    setCustomFields(updated)
  }

  const addEditCustomField = () => {
    setEditCustomFields([...editCustomFields, { name: '', type: 'text', value: '' }])
  }

  const removeEditCustomField = (index: number) => {
    setEditCustomFields(editCustomFields.filter((_, i) => i !== index))
  }

  const updateEditCustomField = (index: number, field: string, value: any) => {
    const updated = [...editCustomFields]
    updated[index] = { ...updated[index], [field]: value }
    setEditCustomFields(updated)
  }

  const generateSampleCallLogJson = (agentId?: string) => {
    const agent = jsonData.agents.find(a => a.id === agentId) || jsonData.agents[0]
    const timestamp = Math.floor(Date.now() / 1000)
    
    return JSON.stringify({
      agent_id: agent?.id || 'agent_001',
      customer_number: '+1555' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      call_ended_reason: 'completed',
      duration_seconds: Math.floor(Math.random() * 300) + 60, // 60-360 seconds
      avg_latency: parseFloat((Math.random() * 0.5 + 0.8).toFixed(3)),
      recording_url: `https://storage.example.com/recordings/call_${Date.now()}.mp3`,
      transcript_json: [
        {
          role: 'assistant',
          content: `Hello, this is ${agent?.name || 'Agent'}. How can I help you today?`,
          timestamp: timestamp,
          stt_metrics: { duration: 1.200, confidence: 0.96, processing_time: 0.180 },
          llm_metrics: { ttft: 0.420, tokens_per_second: 12, total_tokens: 48, response_time: 0.890 },
          tts_metrics: { ttfb: 0.160, audio_duration: 2.800, synthesis_time: 0.240 }
        },
        {
          role: 'user',
          content: 'Hi, I need help with my account.',
          timestamp: timestamp + 5,
          stt_metrics: { duration: 0.980, confidence: 0.94, processing_time: 0.140 },
          eou_metrics: { end_of_utterance_delay: 0.085, confidence: 0.92 }
        },
        {
          role: 'assistant',
          content: 'I\'d be happy to help you with your account. What specific issue are you experiencing?',
          timestamp: timestamp + 12,
          stt_metrics: { duration: 1.400, confidence: 0.97, processing_time: 0.195 },
          llm_metrics: { ttft: 0.380, tokens_per_second: 14, total_tokens: 62, response_time: 1.050 },
          tts_metrics: { ttfb: 0.145, audio_duration: 3.200, synthesis_time: 0.280 }
        }
      ],
      metadata: {
        budget_qualified: Math.random() > 0.5,
        decision_timeframe: ['within_month', '1_3_months', '3_6_months'][Math.floor(Math.random() * 3)],
        interest_level: ['high', 'very_high', 'medium'][Math.floor(Math.random() * 3)],
        lead_score: Math.floor(Math.random() * 40) + 60,
        next_action: ['schedule_demo', 'send_info', 'follow_up_call'][Math.floor(Math.random() * 3)]
      },
      total_stt_cost: parseFloat((Math.random() * 0.1).toFixed(3)),
      total_tts_cost: parseFloat((Math.random() * 0.15).toFixed(3)),
      total_llm_cost: parseFloat((Math.random() * 0.2).toFixed(3))
    }, null, 2)
  }

  const addCallLogFromJson = async () => {
    try {
      const callLogData = JSON.parse(jsonCallLogInput)
      
      // Generate unique IDs
      const timestamp = Date.now()
      const finalCallLogData = {
        ...callLogData,
        id: `call_${timestamp}`,
        call_id: callLogData.call_id || `call_${timestamp}`,
        created_at: new Date().toISOString(),
        call_started_at: new Date().toISOString(),
        call_ended_at: new Date(Date.now() + (callLogData.duration_seconds * 1000)).toISOString(),
        transcript_type: 'agent',
        transcription_metrics: {
          transcript: callLogData.transcript_json?.[0]?.content?.substring(0, 50) + '...' || 'Generated call log',
          duration: callLogData.duration_seconds,
          call_ended_reason: callLogData.call_ended_reason
        }
      }

      const updatedData = {
        ...jsonData,
        callLogs: [...jsonData.callLogs, finalCallLogData]
      }
      
      setJsonData(updatedData)
      setJsonString(JSON.stringify(updatedData, null, 2))
      setJsonCallLogInput('')
      setShowJsonCallLog(false)
      
    } catch (error) {
      alert('Invalid JSON format. Please check your input.')
    }
  }

  const addCallLog = async () => {
    if (!newCallLog.agent_id) {
      alert('Please select an agent for the call log')
      return
    }

    // Convert custom fields to metadata object
    const metadata: any = {}
    customFields.forEach(field => {
      if (field.name.trim()) {
        metadata[field.name] = field.value
      }
    })

    const callLogData = {
      ...newCallLog,
      id: `call_${Date.now()}`,
      call_id: newCallLog.call_id || `call_${Date.now()}`,
      created_at: new Date().toISOString(),
      call_started_at: new Date().toISOString(),
      call_ended_at: new Date().toISOString(),
      transcript_type: 'agent',
      metadata,
      transcription_metrics: { 
        transcript: "Generated call log",
        duration: newCallLog.duration_seconds,
        call_ended_reason: newCallLog.call_ended_reason
      }
    }

    const updatedData = {
      ...jsonData,
      callLogs: [...jsonData.callLogs, callLogData]
    }
    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
    
    // Reset form
    setNewCallLog({
      call_id: '',
      agent_id: '',
      customer_number: '',
      call_ended_reason: 'completed',
      duration_seconds: 0,
      total_stt_cost: 0,
      total_tts_cost: 0,
      total_llm_cost: 0,
      transcript_json: [],
      recording_url: '',
      avg_latency: 0,
      metadata: {}
    })
    
    // Reset custom fields
    setCustomFields([
      { name: 'budget_qualified', type: 'boolean', value: false },
      { name: 'decision_timeframe', type: 'text', value: '' },
      { name: 'interest_level', type: 'text', value: '' },
      { name: 'lead_score', type: 'number', value: 0 },
      { name: 'next_action', type: 'text', value: '' }
    ])
    
    setShowAddCallLog(false)
  }

  const deleteItem = (type: keyof JsonData, id: string) => {
    if (!confirm(`Delete this ${type.slice(0, -1)}?`)) return

    const updatedData = {
      ...jsonData,
      [type]: (jsonData[type] || []).filter((item: any) => item.id !== id)
    }
    setJsonData(updatedData)
    setJsonString(JSON.stringify(updatedData, null, 2))
  }

  // Render editable field
  const renderEditableField = (type: 'project' | 'agent' | 'callLog', id: string, field: string, value: any, label: string) => {
    const isEditing = editingItem?.type === type && editingItem?.id === id && editingItem?.field === field

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={editingItem.value}
            onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            autoFocus
          />
          <Button size="sm" onClick={saveEdit} className="h-8 w-8 p-0">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    }

    return (
      <div 
        className="flex items-center gap-2 group cursor-pointer hover:bg-gray-50 p-1 rounded"
        onClick={() => startEditing(type, id, field, value)}
      >
        <div className="flex-1">
          <strong>{label}:</strong> {
            typeof value === 'object' 
              ? JSON.stringify(value, null, 2).slice(0, 50) + '...'
              : String(value)
          }
        </div>
        <Edit3 className="h-4 w-4 opacity-0 group-hover:opacity-100 text-gray-400" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading magic editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Wand2 className="h-6 w-6 text-white" />
            </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Magic Data Editor
            </h1>
                <p className="text-sm text-gray-600">Hands-free JSON data management</p>
          </div>
        </div>

            <div className="flex items-center gap-3">
            <Button 
                onClick={() => setShowRaw(!showRaw)}
              variant="outline"
                size="sm"
                className="border-purple-200 hover:bg-purple-50"
            >
                {showRaw ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showRaw ? 'Visual Mode' : 'Raw JSON'}
            </Button>
              
            <Button 
                onClick={copyToClipboard}
              variant="outline"
                size="sm"
                className="border-purple-200 hover:bg-purple-50"
            >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
          
          <Button 
                onClick={saveData}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-save-button
          >
                {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Saving...' : 'Save Changes'}
          </Button>
            </div>
        </div>

          {jsonError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-700 text-sm">{jsonError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {showRaw ? (
          // Raw JSON Editor
          <Card className="border-purple-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200">
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-purple-600" />
                Raw JSON Editor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Textarea
                value={jsonString}
                onChange={(e) => setJsonString(e.target.value)}
                className="min-h-[600px] font-mono text-sm border-0 resize-none focus:ring-0"
                placeholder="Enter JSON data..."
              />
            </CardContent>
          </Card>
        ) : (
          // Visual Editor
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-white/80 border border-purple-200">
            <TabsTrigger value="overview" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Projects ({jsonData.projects.length})
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Agents ({jsonData.agents.length})
            </TabsTrigger>
            <TabsTrigger value="callLogs" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Call Logs ({jsonData.callLogs.length})
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
            </TabsTrigger>
            <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Custom Metrics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-purple-700">Projects</p>
                        <p className="text-3xl font-bold text-purple-900">{jsonData.projects.length}</p>
                    </div>
                      <Building2 className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-blue-700">Agents</p>
                        <p className="text-3xl font-bold text-blue-900">{jsonData.agents.length}</p>
                    </div>
                      <Zap className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              
                <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-green-700">Call Logs</p>
                        <p className="text-3xl font-bold text-green-900">{jsonData.callLogs.length}</p>
                    </div>
                      <Phone className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              
                <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-orange-700">Total Records</p>
                        <p className="text-3xl font-bold text-orange-900">
                          {jsonData.projects.length + jsonData.agents.length + jsonData.callLogs.length}
                        </p>
                    </div>
                      <Database className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
              <Card className="border-purple-200">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Button onClick={() => setShowAddProject(true)} className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="h-4 w-4 mr-2" />
                    Add Project
                  </Button>
                    <Button onClick={() => setShowAddAgent(true)} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                    Add Agent
                  </Button>
                    <Button onClick={() => setShowAddCallLog(true)} className="bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Call Log
                  </Button>
                    <Button onClick={createBackup} variant="outline" className="border-purple-200">
                      <Download className="h-4 w-4 mr-2" />
                      Create Backup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Projects ({jsonData.projects.length})</h2>
                <Button onClick={() => setShowAddProject(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {jsonData.projects.map((project) => (
                  <Card key={project.id} className="border-purple-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-purple-600" />
                        <CardTitle className="text-lg">Project Details</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.environment === 'production' ? 'default' : 'secondary'}>
                          {project.environment}
                        </Badge>
                      <Button
                          onClick={() => deleteItem('projects', project.id)}
                        size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                          <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                    <CardContent className="space-y-3">
                      {renderEditableField('project', project.id, 'name', project.name, 'Name')}
                      {renderEditableField('project', project.id, 'description', project.description, 'Description')}
                      {renderEditableField('project', project.id, 'environment', project.environment, 'Environment')}
                      <div className="text-sm text-gray-600">
                        <div><strong>ID:</strong> {project.id}</div>
                        <div><strong>Created:</strong> {new Date(project.created_at).toLocaleDateString()}</div>
                        <div><strong>Agents:</strong> {jsonData.agents.filter(a => a.project_id === project.id).length}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
                    </div>
          </TabsContent>

          {/* Agents Tab */}
            <TabsContent value="agents" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Agents ({jsonData.agents.length})</h2>
                <Button onClick={() => setShowAddAgent(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {jsonData.agents.map((agent) => {
                  const project = jsonData.projects.find(p => p.id === agent.project_id)
                  return (
                    <Card key={agent.id} className="border-blue-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-lg">Agent Details</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{agent.agent_type}</Badge>
                      <Button
                            onClick={() => deleteItem('agents', agent.id)}
                        size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                            <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                      <CardContent className="space-y-3">
                        {renderEditableField('agent', agent.id, 'name', agent.name, 'Name')}
                        {renderEditableField('agent', agent.id, 'agent_type', agent.agent_type, 'Type')}
                        {renderEditableField('agent', agent.id, 'environment', agent.environment, 'Environment')}
                        {renderEditableField('agent', agent.id, 'field_extractor', agent.field_extractor, 'Field Extractor')}
                        {renderEditableField('agent', agent.id, 'configuration', agent.configuration, 'Configuration')}
                        <div className="text-sm text-gray-600">
                          <div><strong>ID:</strong> {agent.id}</div>
                          <div><strong>Project:</strong> {project?.name || 'Unknown'}</div>
                          <div><strong>Call Logs:</strong> {jsonData.callLogs.filter(c => c.agent_id === agent.id).length}</div>
                    </div>
                  </CardContent>
                </Card>
                  )
                })}
            </div>
          </TabsContent>

            {/* Call Logs Tab */}
            <TabsContent value="callLogs" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Call Logs ({jsonData.callLogs.length})</h2>
                <div className="flex gap-2">
                  <Button onClick={() => setShowAddCallLog(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Call Log
                  </Button>
                  <Button onClick={() => setShowJsonCallLog(true)} variant="outline" className="border-green-200 text-green-600 hover:bg-green-50">
                    <FileText className="h-4 w-4 mr-2" />
                    JSON Import
                  </Button>
                </div>
                    </div>
              
              <div className="space-y-4">
                {jsonData.callLogs.map((callLog) => {
                  const agent = jsonData.agents.find(a => a.id === callLog.agent_id)
                  return (
                    <Card key={callLog.id} className="border-green-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-lg">Call Log Details</CardTitle>
                    </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={callLog.call_ended_reason === 'completed' ? 'default' : 'destructive'}>
                            {callLog.call_ended_reason}
                          </Badge>
                          <Button
                            onClick={() => {
                              setEditingCallLog(callLog)
                              // Convert metadata to custom fields format
                              const fields = Object.entries(callLog.metadata || {}).map(([key, value]) => ({
                                name: key,
                                type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text',
                                value: value as any
                              }))
                              setEditCustomFields(fields.length > 0 ? fields : [
                                { name: 'budget_qualified', type: 'boolean', value: false },
                                { name: 'decision_timeframe', type: 'text', value: '' },
                                { name: 'interest_level', type: 'text', value: '' },
                                { name: 'lead_score', type: 'number', value: 0 },
                                { name: 'next_action', type: 'text', value: '' }
                              ])
                              setShowEditCallLog(true)
                            }}
                            size="sm"
                            variant="outline"
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => deleteItem('callLogs', callLog.id)}
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                </Button>
              </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            {renderEditableField('callLog', callLog.id, 'call_id', callLog.call_id, 'Call ID')}
                            {renderEditableField('callLog', callLog.id, 'customer_number', callLog.customer_number, 'Customer')}
                            {renderEditableField('callLog', callLog.id, 'call_ended_reason', callLog.call_ended_reason, 'Status')}
                            {renderEditableField('callLog', callLog.id, 'duration_seconds', callLog.duration_seconds, 'Duration (s)')}
            </div>
                          <div className="space-y-3">
                            {renderEditableField('callLog', callLog.id, 'total_stt_cost', callLog.total_stt_cost, 'STT Cost')}
                            {renderEditableField('callLog', callLog.id, 'total_tts_cost', callLog.total_tts_cost, 'TTS Cost')}
                            {renderEditableField('callLog', callLog.id, 'total_llm_cost', callLog.total_llm_cost, 'LLM Cost')}
                            <div className="text-sm text-gray-600">
                              <div><strong>Agent:</strong> {agent?.name || 'Unknown'}</div>
                              <div><strong>Created:</strong> {new Date(callLog.created_at).toLocaleDateString()}</div>
                            </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  )
                })}
            </div>
          </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card className="border-red-200">
                  <CardHeader>
                  <CardTitle className="text-red-700">Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h3 className="font-medium text-red-800 mb-2">Reset to Default Data</h3>
                    <p className="text-sm text-red-600 mb-4">
                      This will replace all current data with the original default data. This action cannot be undone.
                    </p>
                      <Button
                      onClick={resetToDefault}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset to Default
                </Button>
                    </div>
                </CardContent>
              </Card>
            </TabsContent>

                        {/* Custom Metrics Tab */}
            <TabsContent value="metrics" className="space-y-6">
              {/* Core Overview Metrics Section */}
              <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Clock className="h-5 w-5" />
                    Core Overview Metrics
                  </CardTitle>
                  <p className="text-blue-600 text-sm">
                    These are the main metrics shown at the top of agent overviews (Total Calls, Minutes, Cost, etc.)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Calls */}
                    <div className="p-4 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Phone className="h-4 w-4 text-blue-600" />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                </Button>
              </div>
                      <p className="text-xs font-medium text-blue-700">Total Calls</p>
                      <p className="text-lg font-bold text-blue-900">
                        {jsonData.callLogs.filter(c => c.agent_id === 'agent_003').length}
                      </p>
                      <p className="text-xs text-blue-600">All time</p>
            </div>
            
                    {/* Total Minutes */}
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs font-medium text-green-700">Total Minutes</p>
                      <p className="text-lg font-bold text-green-900">
                        {Math.round(jsonData.callLogs.filter(c => c.agent_id === 'agent_003').reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60)}m avg
                      </p>
                      <p className="text-xs text-green-600">Duration</p>
                    </div>

                    {/* Total Cost */}
                    <div className="p-4 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs font-medium text-purple-700">Total Cost</p>
                      <p className="text-lg font-bold text-purple-900">
                        ₹{jsonData.callLogs.filter(c => c.agent_id === 'agent_003').reduce((sum, c) => sum + (c.total_stt_cost || 0) + (c.total_tts_cost || 0) + (c.total_llm_cost || 0), 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-purple-600">Cumulative</p>
                    </div>

                    {/* Success Rate */}
                    <div className="p-4 bg-white rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <CheckCircle className="h-4 w-4 text-orange-600" />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs font-medium text-orange-700">Success Rate</p>
                      <p className="text-lg font-bold text-orange-900">
                        {((jsonData.callLogs.filter(c => c.agent_id === 'agent_003' && c.call_ended_reason === 'completed').length / 
                          Math.max(1, jsonData.callLogs.filter(c => c.agent_id === 'agent_003').length)) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-orange-600">Performance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts & Analytics Section */}
              <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <ChartBar className="h-5 w-5" />
                    Charts & Analytics
                  </CardTitle>
                  <p className="text-green-600 text-sm">
                    Manage the charts and graphs displayed in agent overviews
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Daily Call Volume */}
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-green-800">Daily Call Volume</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-green-600 mb-2">Trend analysis over selected period</p>
                      <div className="flex justify-between text-sm">
                    <div>
                          <span className="text-xs text-green-600">Peak</span>
                          <p className="font-bold text-green-900">
                            {Math.max(...Array.from({length: 7}, (_, i) => 
                              jsonData.callLogs.filter(c => c.agent_id === 'agent_003').length
                            ), 0)}
                          </p>
                    </div>
                    <div>
                          <span className="text-xs text-green-600">Avg</span>
                          <p className="font-bold text-green-900">
                            {Math.round(jsonData.callLogs.filter(c => c.agent_id === 'agent_003').length / 7)}
                          </p>
                    </div>
                      </div>
                    </div>

                    {/* Success Analysis */}
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-green-800">Success Analysis</h4>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-green-600 mb-2">Call completion metrics</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Success Rate</span>
                          <span className="font-bold text-green-900">
                            {((jsonData.callLogs.filter(c => c.agent_id === 'agent_003' && c.call_ended_reason === 'completed').length / 
                              Math.max(1, jsonData.callLogs.filter(c => c.agent_id === 'agent_003').length)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Successful</span>
                          <span className="font-bold text-green-900">
                            {jsonData.callLogs.filter(c => c.agent_id === 'agent_003' && c.call_ended_reason === 'completed').length}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Failed</span>
                          <span className="font-bold text-green-900">
                            {jsonData.callLogs.filter(c => c.agent_id === 'agent_003' && c.call_ended_reason !== 'completed').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Override Metrics Section */}
              <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
                <CardHeader>
                  <div className="flex justify-between items-center">
                      <div>
                      <CardTitle className="flex items-center gap-2 text-orange-800">
                        <User className="h-5 w-5" />
                        Agent Override Metrics
                      </CardTitle>
                      <p className="text-orange-600 text-sm">
                        Manually set core metrics (Total Calls, Minutes, Cost, etc.) for each agent
                      </p>
                      </div>
                    <Button onClick={() => setShowAddAgentOverride(true)} className="bg-orange-600 hover:bg-orange-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Agent Override
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {(jsonData.agentOverrideMetrics || []).map((override: any) => (
                      <Card key={override.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                      <div>
                              <h3 className="font-semibold text-lg text-orange-800">{override.agentName}</h3>
                              <Badge variant="secondary" className="text-xs mt-1">
                                Agent ID: {override.agentId}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => editAgentOverride(override)}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteAgentOverride(override.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded border border-orange-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Phone className="h-3 w-3 text-orange-600" />
                                <span className="text-xs font-medium text-orange-700">Total Calls</span>
                              </div>
                              <p className="text-lg font-bold text-orange-900">{override.totalCalls}</p>
                            </div>
                            
                            <div className="bg-white p-3 rounded border border-orange-200">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-3 w-3 text-orange-600" />
                                <span className="text-xs font-medium text-orange-700">Total Minutes</span>
                              </div>
                              <p className="text-lg font-bold text-orange-900">{override.totalMinutes}m</p>
                            </div>
                            
                            <div className="bg-white p-3 rounded border border-orange-200">
                              <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-3 w-3 text-orange-600" />
                                <span className="text-xs font-medium text-orange-700">Total Cost</span>
                              </div>
                              <p className="text-lg font-bold text-orange-900">₹{override.totalCost}</p>
                            </div>
                            
                            <div className="bg-white p-3 rounded border border-orange-200">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle className="h-3 w-3 text-orange-600" />
                                <span className="text-xs font-medium text-orange-700">Success Rate</span>
                              </div>
                              <p className="text-lg font-bold text-orange-900">{override.successRate}%</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div className="text-center">
                              <p className="text-xs text-orange-600">Response Time</p>
                              <p className="font-bold text-orange-900">{override.averageResponseTime}s</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-orange-600">Successful</p>
                              <p className="font-bold text-orange-900">{override.successfulCalls}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-orange-600">Failed</p>
                              <p className="font-bold text-orange-900">{override.failedCalls}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-orange-600">Peak Daily</p>
                              <p className="font-bold text-orange-900">{override.peakDailyCalls}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
                    
                    {(!jsonData.agentOverrideMetrics || jsonData.agentOverrideMetrics.length === 0) && (
                      <Card className="border-dashed border-2 border-orange-300">
                        <CardContent className="p-12 text-center">
                          <User className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-orange-600 mb-2">No Agent Overrides Yet</h3>
                          <p className="text-orange-500 mb-4">Set custom metrics for agents to override calculated values</p>
                          <Button onClick={() => setShowAddAgentOverride(true)} variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Agent Override
                </Button>
                        </CardContent>
                      </Card>
                    )}
              </div>
                </CardContent>
              </Card>

              {/* Custom Metrics Section */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Custom Overview Metrics</h2>
                  <p className="text-gray-600">Add your own custom metrics to display alongside core metrics</p>
                </div>
                <Button onClick={() => setShowAddMetric(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Metric
                </Button>
            </div>
            
              <div className="grid gap-4">
                {(jsonData.customOverviewMetrics || []).map((metric: any) => (
                  <Card key={metric.id} className="border-l-4 border-l-purple-500">
                    <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{metric.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {metric.type}
                            </Badge>
                            {metric.agentId && (
                              <Badge variant="secondary" className="text-xs">
                                {jsonData.agents.find((a: any) => a.id === metric.agentId)?.name || metric.agentId}
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{metric.description}</p>
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-purple-600">
                              {metric.type === 'currency' ? `$${metric.value.toLocaleString()}` :
                               metric.type === 'percentage' ? `${metric.value}%` :
                               metric.value}
                            </div>
                            <div className="text-xs text-gray-500">
                              Updated: {new Date(metric.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                      <Button
                            variant="outline"
                        size="sm"
                            onClick={() => editMetric(metric)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMetric(metric.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {(!jsonData.customOverviewMetrics || jsonData.customOverviewMetrics.length === 0) && (
                  <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="p-12 text-center">
                      <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No Custom Metrics Yet</h3>
                      <p className="text-gray-500 mb-4">Add custom metrics to display in your agent overviews</p>
                      <Button onClick={() => setShowAddMetric(true)} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Metric
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
                      <div>
              <Label htmlFor="project-name">Project Name</Label>
                        <Input
                id="project-name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Enter project name"
                        />
                      </div>
                      <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Enter project description"
                rows={3}
                        />
                      </div>
            <div>
              <Label htmlFor="project-environment">Environment</Label>
              <Select value={newProject.environment} onValueChange={(value) => setNewProject({ ...newProject, environment: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddProject(false)}>Cancel</Button>
              <Button onClick={addProject} disabled={!newProject.name.trim()}>Add Project</Button>
                    </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom Metric Dialog */}
      <Dialog open={showAddMetric} onOpenChange={setShowAddMetric}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Custom Metric' : 'Add Custom Metric'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
                    <div>
              <Label htmlFor="metric-name">Metric Name</Label>
              <Input
                id="metric-name"
                value={newMetric.name}
                onChange={(e) => setNewMetric({ ...newMetric, name: e.target.value })}
                placeholder="e.g., Lead Conversion Rate"
              />
            </div>
            <div>
              <Label htmlFor="metric-value">Value</Label>
              <Input
                id="metric-value"
                type="number"
                value={newMetric.value}
                onChange={(e) => setNewMetric({ ...newMetric, value: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 24.5"
              />
            </div>
            <div>
              <Label htmlFor="metric-type">Type</Label>
              <Select value={newMetric.type} onValueChange={(value) => setNewMetric({ ...newMetric, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                      <div>
              <Label htmlFor="metric-description">Description</Label>
              <Textarea
                id="metric-description"
                value={newMetric.description}
                onChange={(e) => setNewMetric({ ...newMetric, description: e.target.value })}
                placeholder="Brief description of what this metric represents"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="metric-agent">Agent (Optional)</Label>
              <Select value={newMetric.agentId} onValueChange={(value) => setNewMetric({ ...newMetric, agentId: value })}>
                          <SelectTrigger>
                  <SelectValue placeholder="Select an agent (or leave blank for all)" />
                          </SelectTrigger>
                                          <SelectContent>
                  {jsonData.agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                      <div>
              <Label htmlFor="metric-project">Project (Optional)</Label>
              <Select value={newMetric.projectId} onValueChange={(value) => setNewMetric({ ...newMetric, projectId: value })}>
                          <SelectTrigger>
                  <SelectValue placeholder="Select a project (or leave blank for all)" />
                          </SelectTrigger>
                          <SelectContent>
                  {jsonData.projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                          </SelectContent>
                        </Select>
                      </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddMetric(false)
                setEditingItem(null)
                setNewMetric({ name: '', value: 0, type: 'number', description: '', agentId: '', projectId: '' })
              }}>
                Cancel
                </Button>
              <Button onClick={addMetric} disabled={!newMetric.name.trim()}>
                {editingItem ? 'Update' : 'Add'} Metric
                </Button>
                      </div>
                    </div>
        </DialogContent>
      </Dialog>

      {/* Add Agent Override Dialog */}
      <Dialog open={showAddAgentOverride} onOpenChange={setShowAddAgentOverride}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Agent Override' : 'Add Agent Override'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="override-agent">Agent</Label>
              <Select value={newAgentOverride.agentId} onValueChange={(value) => setNewAgentOverride({ ...newAgentOverride, agentId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {jsonData.agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="override-totalCalls">Total Calls</Label>
                <Input
                  id="override-totalCalls"
                  type="number"
                  value={newAgentOverride.totalCalls}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, totalCalls: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 45"
                />
              </div>
              <div>
                <Label htmlFor="override-totalMinutes">Total Minutes</Label>
                <Input
                  id="override-totalMinutes"
                  type="number"
                  value={newAgentOverride.totalMinutes}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, totalMinutes: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 320"
                />
            </div>
                    </div>
            
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                <Label htmlFor="override-totalCost">Total Cost (₹)</Label>
                        <Input
                  id="override-totalCost"
                  type="number"
                  step="0.01"
                  value={newAgentOverride.totalCost}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, totalCost: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 125.50"
                        />
                      </div>
                      <div>
                <Label htmlFor="override-responseTime">Avg Response Time (seconds)</Label>
                        <Input
                  id="override-responseTime"
                          type="number"
                  step="0.1"
                  value={newAgentOverride.averageResponseTime}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, averageResponseTime: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 1.2"
                        />
                      </div>
                    </div>
            
            <div className="grid grid-cols-2 gap-4">
                    <div>
                <Label htmlFor="override-successRate">Success Rate (%)</Label>
                      <Input
                  id="override-successRate"
                  type="number"
                  step="0.1"
                  value={newAgentOverride.successRate}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, successRate: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 78.5"
                      />
                    </div>
              <div>
                <Label htmlFor="override-successfulCalls">Successful Calls</Label>
                <Input
                  id="override-successfulCalls"
                  type="number"
                  value={newAgentOverride.successfulCalls}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, successfulCalls: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 35"
                />
              </div>
            </div>
            
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                <Label htmlFor="override-failedCalls">Failed Calls</Label>
                <Input
                  id="override-failedCalls"
                  type="number"
                  value={newAgentOverride.failedCalls}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, failedCalls: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 10"
                />
              </div>
              <div>
                <Label htmlFor="override-peakDaily">Peak Daily Calls</Label>
                <Input
                  id="override-peakDaily"
                  type="number"
                  value={newAgentOverride.peakDailyCalls}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, peakDailyCalls: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 12"
                />
              </div>
              <div>
                <Label htmlFor="override-avgDaily">Avg Daily Calls</Label>
                <Input
                  id="override-avgDaily"
                  type="number"
                  value={newAgentOverride.avgDailyCalls}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, avgDailyCalls: parseInt(e.target.value) || 0 })}
                  placeholder="e.g., 6"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="override-latencyMin">Min Latency (seconds)</Label>
                <Input
                  id="override-latencyMin"
                  type="number"
                  step="0.1"
                  value={newAgentOverride.latencyRangeMin}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, latencyRangeMin: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 0.5"
                />
              </div>
              <div>
                <Label htmlFor="override-latencyMax">Max Latency (seconds)</Label>
                <Input
                  id="override-latencyMax"
                  type="number"
                  step="0.1"
                  value={newAgentOverride.latencyRangeMax}
                  onChange={(e) => setNewAgentOverride({ ...newAgentOverride, latencyRangeMax: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 2.0"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddAgentOverride(false)
                setEditingItem(null)
                setNewAgentOverride({
                  agentId: '',
                  totalCalls: 0,
                  totalMinutes: 0,
                  totalCost: 0,
                  averageResponseTime: 0,
                  successRate: 0,
                  successfulCalls: 0,
                  failedCalls: 0,
                  peakDailyCalls: 0,
                  avgDailyCalls: 0,
                  latencyRangeMin: 0.5,
                  latencyRangeMax: 2.0
                })
              }}>
                Cancel
              </Button>
              <Button onClick={addAgentOverride} disabled={!newAgentOverride.agentId}>
                {editingItem ? 'Update' : 'Add'} Override
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={showAddAgent} onOpenChange={setShowAddAgent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
                      <div>
              <Label htmlFor="agent-name">Agent Name</Label>
                        <Input
                id="agent-name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="Enter agent name"
                        />
                      </div>
                      <div>
              <Label htmlFor="agent-project">Project</Label>
              <Select value={newAgent.project_id} onValueChange={(value) => setNewAgent({ ...newAgent, project_id: value })}>
                          <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                  {jsonData.projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
              <Label htmlFor="agent-type">Agent Type</Label>
              <Select value={newAgent.agent_type} onValueChange={(value) => setNewAgent({ ...newAgent, agent_type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="inbound_support">Inbound Support</SelectItem>
                  <SelectItem value="outbound_sales">Outbound Sales</SelectItem>
                  <SelectItem value="appointment_scheduling">Appointment Scheduling</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
              <Label htmlFor="agent-environment">Environment</Label>
              <Select value={newAgent.environment} onValueChange={(value) => setNewAgent({ ...newAgent, environment: value })}>
                          <SelectTrigger>
                  <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddAgent(false)}>Cancel</Button>
              <Button onClick={addAgent} disabled={!newAgent.name.trim() || !newAgent.project_id}>Add Agent</Button>
                    </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* Add Call Log Dialog */}
      <Dialog open={showAddCallLog} onOpenChange={(open) => {
        setShowAddCallLog(open)
        if (!open) {
          // Reset form
          setNewCallLog({
            call_id: '',
            agent_id: '',
            customer_number: '',
            call_ended_reason: 'completed',
            duration_seconds: 0,
            total_stt_cost: 0,
            total_tts_cost: 0,
            total_llm_cost: 0,
            transcript_json: [],
            recording_url: '',
            avg_latency: 0,
            metadata: {}
          })
          
          // Reset custom fields
          setCustomFields([
            { name: 'budget_qualified', type: 'boolean', value: false },
            { name: 'decision_timeframe', type: 'text', value: '' },
            { name: 'interest_level', type: 'text', value: '' },
            { name: 'lead_score', type: 'number', value: 0 },
            { name: 'next_action', type: 'text', value: '' }
          ])
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Call Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="call-agent">Agent</Label>
              <Select value={newCallLog.agent_id} onValueChange={(value) => setNewCallLog({ ...newCallLog, agent_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent>
                  {jsonData.agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                      </SelectContent>
                    </Select>
                </div>
            <div>
              <Label htmlFor="call-customer">Customer Number</Label>
              <Input
                id="call-customer"
                value={newCallLog.customer_number}
                onChange={(e) => setNewCallLog({ ...newCallLog, customer_number: e.target.value })}
                placeholder="+1234567890"
              />
              </div>
                  <div>
              <Label htmlFor="call-duration">Duration (seconds)</Label>
              <Input
                id="call-duration"
                type="number"
                value={newCallLog.duration_seconds}
                onChange={(e) => setNewCallLog({ ...newCallLog, duration_seconds: parseInt(e.target.value) || 0 })}
                placeholder="120"
                    />
              </div>
              
                  <div>
              <Label htmlFor="call-recording">Recording URL</Label>
              <Input
                id="call-recording"
                value={newCallLog.recording_url}
                onChange={(e) => setNewCallLog({ ...newCallLog, recording_url: e.target.value })}
                placeholder="https://storage.example.com/recordings/call_123.mp3"
                    />
                  </div>
            
                        <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="call-transcript">Conversation Transcript</Label>
                    <Button 
                  type="button" 
                      variant="outline"
                  size="sm"
                  onClick={generateSampleConversation}
                  disabled={!newCallLog.agent_id}
                    >
                  Generate Sample
                  </Button>
                </div>
              <div className="text-xs text-muted-foreground mb-2">
                Format: Agent/User messages with automatic metrics generation
            </div>
              <Textarea
                id="call-transcript"
                value={typeof newCallLog.transcript_json === 'string' ? newCallLog.transcript_json : JSON.stringify(newCallLog.transcript_json, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setNewCallLog({ ...newCallLog, transcript_json: parsed })
                  } catch {
                    setNewCallLog({ ...newCallLog, transcript_json: e.target.value as any })
                  }
                }}
                placeholder={`[
  {
    "role": "assistant",
    "content": "Hello, this is Sarah from TechCorp Sales...",
    "timestamp": 1705320000,
    "stt_metrics": { "duration": 1.200, "confidence": 0.96, "processing_time": 0.180 },
    "llm_metrics": { "ttft": 0.420, "tokens_per_second": 12, "total_tokens": 48, "response_time": 0.890 },
    "tts_metrics": { "ttfb": 0.160, "audio_duration": 2.800, "synthesis_time": 0.240 }
  },
  {
    "role": "user",
    "content": "Yes, I'm interested in your solution...",
    "timestamp": 1705320005,
    "stt_metrics": { "duration": 0.980, "confidence": 0.94, "processing_time": 0.140 },
    "eou_metrics": { "end_of_utterance_delay": 0.085, "confidence": 0.92 }
  }
]`}
                rows={8}
                            />
              </div>
              
            <div>
              <Label htmlFor="avg-latency">Average Latency (seconds)</Label>
              <Input
                id="avg-latency"
                type="number"
                step="0.001"
                value={newCallLog.avg_latency}
                onChange={(e) => setNewCallLog({ ...newCallLog, avg_latency: parseFloat(e.target.value) || 0 })}
                placeholder="1.200"
              />
            </div>
            
                        <div className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">Dynamic Custom Fields</h4>
                <Button 
                  type="button" 
                      variant="outline"
                  size="sm"
                  onClick={addCustomField}
                    >
                  + Add Field
                    </Button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {customFields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor={`field-name-${index}`}>Field Name</Label>
                      <Input
                        id={`field-name-${index}`}
                        value={field.name}
                        onChange={(e) => updateCustomField(index, 'name', e.target.value)}
                        placeholder="e.g. budget_qualified"
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="w-24">
                      <Label htmlFor={`field-type-${index}`}>Type</Label>
                      <select 
                        id={`field-type-${index}`}
                        className="w-full px-2 py-2 border rounded-md text-sm"
                        value={field.type}
                        onChange={(e) => updateCustomField(index, 'type', e.target.value)}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor={`field-value-${index}`}>Value</Label>
                      {field.type === 'boolean' ? (
                        <select 
                          id={`field-value-${index}`}
                          className="w-full px-2 py-2 border rounded-md text-sm"
                          value={field.value.toString()}
                          onChange={(e) => updateCustomField(index, 'value', e.target.value === 'true')}
                        >
                          <option value="false">False</option>
                          <option value="true">True</option>
                        </select>
                      ) : field.type === 'number' ? (
                        <Input
                          id={`field-value-${index}`}
                          type="number"
                          value={field.value as number}
                          onChange={(e) => updateCustomField(index, 'value', parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      ) : (
                        <Input
                          id={`field-value-${index}`}
                          value={field.value as string}
                          onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                          placeholder="Enter value"
                          className="text-sm"
                        />
                      )}
                    </div>
                    
                    <Button 
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeCustomField(index)}
                      className="px-2"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                
                {customFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No custom fields added. Click "Add Field" to create one.
                  </p>
                )}
            </div>
      </div>
            
            <div className="grid grid-cols-3 gap-2">
                  <div>
                <Label htmlFor="call-stt-cost">STT Cost</Label>
                <Input
                  id="call-stt-cost"
                  type="number"
                  step="0.01"
                  value={newCallLog.total_stt_cost}
                  onChange={(e) => setNewCallLog({ ...newCallLog, total_stt_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.05"
                    />
                  </div>
              <div>
                <Label htmlFor="call-tts-cost">TTS Cost</Label>
                <Input
                  id="call-tts-cost"
                  type="number"
                  step="0.01"
                  value={newCallLog.total_tts_cost}
                  onChange={(e) => setNewCallLog({ ...newCallLog, total_tts_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.12"
                />
      </div>
              <div>
                <Label htmlFor="call-llm-cost">LLM Cost</Label>
                <Input
                  id="call-llm-cost"
                  type="number"
                  step="0.01"
                  value={newCallLog.total_llm_cost}
                  onChange={(e) => setNewCallLog({ ...newCallLog, total_llm_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.08"
                />
      </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddCallLog(false)}>Cancel</Button>
              <Button onClick={addCallLog} disabled={!newCallLog.agent_id || !newCallLog.customer_number}>Add Call Log</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* JSON Import Call Log Dialog */}
      <Dialog open={showJsonCallLog} onOpenChange={(open) => {
        setShowJsonCallLog(open)
        if (!open) {
          setJsonCallLogInput('')
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Call Log from JSON</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Paste complete JSON data below. Call ID and timestamps will be auto-generated.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-selector">Select Agent (for sample generation)</Label>
              <Select onValueChange={(agentId) => setJsonCallLogInput(generateSampleCallLogJson(agentId))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose agent to generate sample JSON" />
                </SelectTrigger>
                <SelectContent>
                  {jsonData.agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label htmlFor="json-input">Call Log JSON Data</Label>
                    <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setJsonCallLogInput(generateSampleCallLogJson())}
                >
                  Generate Sample
                </Button>
              </div>
                    <Textarea
                id="json-input"
                value={jsonCallLogInput}
                onChange={(e) => setJsonCallLogInput(e.target.value)}
                placeholder="Paste your JSON call log data here..."
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Required fields: agent_id, customer_number, call_ended_reason, duration_seconds, transcript_json, metadata
              </p>
                  </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowJsonCallLog(false)
                setJsonCallLogInput('')
              }}>
                Cancel
              </Button>
              <Button onClick={addCallLogFromJson} disabled={!jsonCallLogInput.trim()}>
                Import Call Log
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Call Log Custom Fields Dialog */}
      <Dialog open={showEditCallLog} onOpenChange={(open) => {
        setShowEditCallLog(open)
        if (!open) {
          setEditingCallLog(null)
          setEditCustomFields([])
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Custom Fields - Call {editingCallLog?.call_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-sm">Dynamic Custom Fields</h4>
                    <Button 
                  type="button" 
                      variant="outline"
                  size="sm"
                  onClick={addEditCustomField}
                    >
                  + Add Field
                    </Button>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {editCustomFields.map((field, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor={`edit-field-name-${index}`}>Field Name</Label>
                      <Input
                        id={`edit-field-name-${index}`}
                        value={field.name}
                        onChange={(e) => updateEditCustomField(index, 'name', e.target.value)}
                        placeholder="e.g. budget_qualified"
                        className="text-sm"
                      />
                    </div>
                    
                    <div className="w-24">
                      <Label htmlFor={`edit-field-type-${index}`}>Type</Label>
                      <select 
                        id={`edit-field-type-${index}`}
                        className="w-full px-2 py-2 border rounded-md text-sm"
                        value={field.type}
                        onChange={(e) => updateEditCustomField(index, 'type', e.target.value)}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    
                    <div className="flex-1">
                      <Label htmlFor={`edit-field-value-${index}`}>Value</Label>
                      {field.type === 'boolean' ? (
                        <select 
                          id={`edit-field-value-${index}`}
                          className="w-full px-2 py-2 border rounded-md text-sm"
                          value={field.value.toString()}
                          onChange={(e) => updateEditCustomField(index, 'value', e.target.value === 'true')}
                        >
                          <option value="false">False</option>
                          <option value="true">True</option>
                        </select>
                      ) : field.type === 'number' ? (
                        <Input
                          id={`edit-field-value-${index}`}
                          type="number"
                          value={field.value as number}
                          onChange={(e) => updateEditCustomField(index, 'value', parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                      ) : (
                        <Input
                          id={`edit-field-value-${index}`}
                          value={field.value as string}
                          onChange={(e) => updateEditCustomField(index, 'value', e.target.value)}
                          placeholder="Enter value"
                          className="text-sm"
                        />
                      )}
                    </div>
                    
                    <Button 
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeEditCustomField(index)}
                      className="px-2"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                
                {customFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No custom fields added. Click "Add Field" to create one.
                  </p>
                )}
            </div>
      </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowEditCallLog(false)
                setEditingCallLog(null)
                setEditCustomFields([])
              }}>Cancel</Button>
              <Button onClick={() => {
                if (!editingCallLog) return
                
                // Convert custom fields to metadata object
                const metadata: any = {}
                editCustomFields.forEach(field => {
                  if (field.name.trim()) {
                    metadata[field.name] = field.value
                  }
                })
                
                // Update the call log
                const updatedCallLogs = jsonData.callLogs.map(log => 
                  log.id === editingCallLog.id ? { ...log, metadata } : log
                )
                
                const updatedData = { ...jsonData, callLogs: updatedCallLogs }
                setJsonData(updatedData)
                setJsonString(JSON.stringify(updatedData, null, 2))
                setShowEditCallLog(false)
                setEditingCallLog(null)
                setEditCustomFields([])
              }}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}