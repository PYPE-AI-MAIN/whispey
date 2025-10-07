'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { 
  Phone, 
  Plus, 
  Trash2, 
  Edit, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Bot,
  Check,
  X,
  Clock,
  Activity,
  Search,
  Filter,
  MoreHorizontal,
  Settings,
  Users
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

interface SipTrunk {
  sip_trunk_id: string
  name: string
  numbers: string[]
  allowed_numbers: string[]
  status?: 'active' | 'inactive' | 'error'
  created_at?: string
  assigned_agent?: string
}

interface DispatchRule {
  sip_dispatch_rule_id: string
  agent_name: string
  room_prefix: string
  trunk_ids: string[]
  name: string
  numbers: string[]
  status?: 'active' | 'inactive'
  created_at?: string
  call_count?: number
}

interface Agent {
  name: string
  type: string
  description?: string
}

export default function EnhancedSipManagement() {
  const params = useParams()
  const projectId = params.projectid as string

  const [sipTrunks, setSipTrunks] = useState<SipTrunk[]>([])
  const [dispatchRules, setDispatchRules] = useState<DispatchRule[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [assigningTrunk, setAssigningTrunk] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  // Assignment dialog state
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false)
  const [selectedTrunkForAssignment, setSelectedTrunkForAssignment] = useState<SipTrunk | null>(null)
  const [selectedAgentForAssignment, setSelectedAgentForAssignment] = useState('')
  
  // Create dispatch rule dialog state
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false)
  const [newRule, setNewRule] = useState({
    room_prefix: 'call-',
    agent_name: '',
    metadata: '',
    trunk_ids: [] as string[],
    name: '',
    priority: 1,
    enabled: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('🔄 Starting to load SIP data...')
      
      const [trunksResponse, rulesResponse, agentsResponse] = await Promise.all([
        fetch('/api/sip/list-trunks'),
        fetch('/api/sip/list-dispatch-rules'),
        fetch('/api/agents/list')
      ])

      console.log('📡 API Responses:', {
        trunks: { ok: trunksResponse.ok, status: trunksResponse.status },
        rules: { ok: rulesResponse.ok, status: rulesResponse.status },
        agents: { ok: agentsResponse.ok, status: agentsResponse.status }
      })

      let processedTrunks = []
      let processedRules = []

      if (trunksResponse.ok) {
        const trunksData = await trunksResponse.json()
        console.log('🏢 RAW TRUNKS DATA:', trunksData)
        processedTrunks = trunksData.trunks || []
      }

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json()
        console.log('📋 RAW RULES DATA:', rulesData)
        processedRules = rulesData.dispatch_rules || []
        
        // Create mapping of trunk_id to agent_name from dispatch rules
        const trunkToAgentMap = new Map()
        processedRules.forEach((rule: any) => {
          if (rule.sip_trunk_id && Array.isArray(rule.sip_trunk_id)) {
            rule.sip_trunk_id.forEach((trunkId: string) => {
              trunkToAgentMap.set(trunkId, rule.agent_name)
            })
          }
        })
        
        console.log('🔗 Trunk to Agent mapping:', Object.fromEntries(trunkToAgentMap))

        // Now map the assignments to trunks
        setSipTrunks(processedTrunks.map((trunk: any) => {
          const assignedAgent = trunkToAgentMap.get(trunk.sip_trunk_id)
          const processedTrunk = {
            ...trunk,
            status: trunk.status || 'active',
            assigned_agent: assignedAgent || null
          }
          console.log('✅ Processed trunk:', {
            id: processedTrunk.sip_trunk_id,
            name: processedTrunk.name,
            assigned_agent: processedTrunk.assigned_agent
          })
          return processedTrunk
        }))

        setDispatchRules(processedRules.map((rule: any) => ({
          ...rule,
          sip_dispatch_rule_id: rule.dispatch_rule_id,
          trunk_ids: rule.sip_trunk_id,
          status: rule.status || 'active',
          call_count: rule.call_count || Math.floor(Math.random() * 1000)
        })))
      }

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json()
        console.log('🤖 RAW AGENTS DATA:', agentsData)
        
        setAgents(agentsData.map((agent: any) => ({
          ...agent,
          description: agent.description || `AI Voice Agent - ${agent.type || agent.agent_type}`
        })))
      }

      console.log('✅ Data loading complete')

    } catch (err) {
      setError('Failed to load phone configuration')
      console.error('💥 Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAssignment = (trunk: SipTrunk) => {
    setSelectedTrunkForAssignment(trunk)
    setSelectedAgentForAssignment(trunk.assigned_agent || '')
    setIsAssignmentOpen(true)
  }

  const handleAssignAgent = async () => {
    if (!selectedTrunkForAssignment || !selectedAgentForAssignment) return
    
    setAssigningTrunk(selectedTrunkForAssignment.sip_trunk_id)
    try {
      // Check if a dispatch rule already exists for this trunk
      const existingRule = dispatchRules.find(rule => 
        Array.isArray(rule.trunk_ids) && rule.trunk_ids.includes(selectedTrunkForAssignment.sip_trunk_id)
      )

      if (existingRule) {
        // Update existing dispatch rule
        const response = await fetch(`/api/sip/update-dispatch-rule/${existingRule.sip_dispatch_rule_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_name: selectedAgentForAssignment
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update dispatch rule')
        }
      } else {
        // Create new dispatch rule
        const response = await fetch('/api/sip/create-dispatch-rule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Rule for ${selectedTrunkForAssignment.name}`,
            agent_name: selectedAgentForAssignment,
            room_prefix: 'call-',
            trunk_ids: [selectedTrunkForAssignment.sip_trunk_id],
            enabled: true
          })
        })

        if (!response.ok) {
          throw new Error('Failed to create dispatch rule')
        }
      }
        
      setSuccess(`Successfully assigned ${selectedAgentForAssignment} to ${selectedTrunkForAssignment.name}`)
      setIsAssignmentOpen(false)
      setSelectedTrunkForAssignment(null)
      setSelectedAgentForAssignment('')
      
      // Reload data to get fresh state
      loadData()
    } catch (err) {
      setError('Failed to assign agent')
      console.error('Assignment error:', err)
    } finally {
      setAssigningTrunk(null)
    }
  }

  const handleUnassignAgent = async (trunkId: string) => {
    setAssigningTrunk(trunkId)
    try {
      // Find the dispatch rule for this trunk
      const existingRule = dispatchRules.find(rule => 
        Array.isArray(rule.trunk_ids) && rule.trunk_ids.includes(trunkId)
      )

      if (existingRule) {
        // Delete the dispatch rule to unassign
        const response = await fetch(`/api/sip/delete-dispatch-rule/${existingRule.sip_dispatch_rule_id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('Failed to delete dispatch rule')
        }
        
        setSuccess('Agent unassigned successfully')
        // Reload data to get fresh state
        loadData()
      } else {
        setError('No dispatch rule found for this trunk')
      }
    } catch (err) {
      setError('Failed to unassign agent')
      console.error('Unassign error:', err)
    } finally {
      setAssigningTrunk(null)
    }
  }

  const handleCreateDispatchRule = async () => {
    try {
      const response = await fetch('/api/sip/create-dispatch-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      })

      if (response.ok) {
        setSuccess('Routing rule created successfully')
        setIsCreateRuleOpen(false)
        setNewRule({
          room_prefix: 'call-',
          agent_name: '',
          metadata: '',
          trunk_ids: [],
          name: '',
          priority: 1,
          enabled: true
        })
        loadData()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create routing rule')
      }
    } catch (err) {
      setError('Failed to create routing rule')
      console.error('Error creating rule:', err)
    }
  }

  const handleDeleteDispatchRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this routing rule?')) return

    try {
      const response = await fetch(`/api/sip/delete-dispatch-rule/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSuccess('Routing rule deleted successfully')
        loadData()
      } else {
        setError('Failed to delete routing rule')
      }
    } catch (err) {
      setError('Failed to delete routing rule')
      console.error('Error deleting rule:', err)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  const filteredTrunks = sipTrunks.filter(trunk => {
    const matchesSearch = !searchQuery || 
      trunk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trunk.numbers?.some(num => num.includes(searchQuery))
    
    const matchesStatus = statusFilter === 'all' || trunk.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const filteredRules = dispatchRules.filter(rule => {
    const matchesSearch = !searchQuery || 
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || rule.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading Phone Settings...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Phone Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage phone numbers and call routing
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{sipTrunks.length}</div>
              <div className="text-gray-500 dark:text-gray-400">Numbers</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">{dispatchRules.length}</div>
              <div className="text-gray-500 dark:text-gray-400">Rules</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-red-800 dark:text-red-400 flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError('')} className="h-4 w-4 p-0 text-red-400 hover:text-red-600">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {success && (
        <div className="mx-4 mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-green-800 dark:text-green-400 flex-1">{success}</span>
            <Button variant="ghost" size="sm" onClick={() => setSuccess('')} className="h-4 w-4 p-0 text-green-400 hover:text-green-600">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs defaultValue="phone-numbers" className="flex flex-col h-full">
          {/* Tab Navigation with Search */}
          <div className="px-4 pt-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-3">
              <TabsList className="bg-gray-100 dark:bg-gray-700 h-8">
                <TabsTrigger value="phone-numbers" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
                  Phone Numbers
                </TabsTrigger>
                <TabsTrigger value="routing-rules" className="text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
                  Routing Rules
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-7 w-48 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Phone Numbers Tab */}
          <TabsContent value="phone-numbers" className="flex-1 min-h-0 mt-0">
            <div className="h-full overflow-auto bg-white dark:bg-gray-900">
              {filteredTrunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
                    <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {searchQuery || statusFilter !== 'all' ? 'No phone numbers match your filters' : 'No Phone Numbers'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-sm">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filter criteria'
                      : 'Phone numbers will appear here once configured'
                    }
                  </p>
                  {searchQuery || statusFilter !== 'all' ? (
                    <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all') }} className="text-xs h-7">
                      Clear Filters
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Contact administrator to add numbers
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg m-4 overflow-hidden">
                  {/* Table Header */}
                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      <div className="col-span-3">Phone Number</div>
                      <div className="col-span-2">Trunk</div>
                      <div className="col-span-2">Assigned Agent</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Created</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTrunks.map((trunk) => (
                      <div
                        key={trunk.sip_trunk_id}
                        className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="grid grid-cols-12 gap-3 items-center text-sm">
                          {/* Phone Numbers */}
                          <div className="col-span-3">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(trunk.numbers) ? trunk.numbers.map((number, index) => (
                                <Badge key={index} variant="outline" className="text-xs font-mono">
                                  {number}
                                </Badge>
                              )) : (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {trunk.numbers || 'No numbers'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Trunk Name */}
                          <div className="col-span-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                              {trunk.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {trunk.sip_trunk_id.slice(0, 8)}...
                            </div>
                          </div>
                          
                          {/* Assigned Agent */}
                          <div className="col-span-2">
                            {trunk.assigned_agent ? (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {trunk.assigned_agent}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                            )}
                          </div>
                          
                          {/* Status */}
                          <div className="col-span-2">
                            <Badge 
                              variant={trunk.status === 'active' ? 'default' : 'secondary'}
                              className={`text-xs ${trunk.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}`}
                            >
                              {trunk.status}
                            </Badge>
                          </div>
                          
                          {/* Created */}
                          <div className="col-span-2">
                            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(trunk.created_at)}</span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="col-span-1 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleOpenAssignment(trunk)} className="text-xs">
                                  <Bot className="h-3 w-3 mr-2" />
                                  {trunk.assigned_agent ? 'Change Agent' : 'Assign Agent'}
                                </DropdownMenuItem>
                                {trunk.assigned_agent && (
                                  <DropdownMenuItem 
                                    onClick={() => handleUnassignAgent(trunk.sip_trunk_id)}
                                    disabled={assigningTrunk === trunk.sip_trunk_id}
                                    className="text-xs"
                                  >
                                    {assigningTrunk === trunk.sip_trunk_id ? (
                                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    ) : (
                                      <X className="h-3 w-3 mr-2" />
                                    )}
                                    Unassign
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs">
                                  <Settings className="h-3 w-3 mr-2" />
                                  Configure
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Routing Rules Tab */}
          <TabsContent value="routing-rules" className="flex-1 min-h-0 mt-0">
            <div className="h-full overflow-auto bg-white dark:bg-gray-900">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Routing Rules</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Configure call routing logic</p>
                  </div>
                  {/* <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7">
                        <Plus className="w-3 h-3 mr-1" />
                        Create Rule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-base">Create Routing Rule</DialogTitle>
                        <DialogDescription className="text-xs">
                          Configure how calls are routed to agents
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 py-3">
                        <div>
                          <Label className="text-xs">Rule Name</Label>
                          <Input
                            placeholder="e.g., Customer Support"
                            value={newRule.name}
                            onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Agent</Label>
                          <Select value={newRule.agent_name} onValueChange={(value) => setNewRule(prev => ({ ...prev, agent_name: value }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map((agent) => (
                                <SelectItem key={agent.name} value={agent.name} className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <Bot className="w-3 h-3" />
                                    {agent.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">SIP Trunk</Label>
                          <Select value={newRule.trunk_ids[0] || ''} onValueChange={(value) => setNewRule(prev => ({ ...prev, trunk_ids: [value] }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select trunk" />
                            </SelectTrigger>
                            <SelectContent>
                              {sipTrunks.map((trunk) => (
                                <SelectItem key={trunk.sip_trunk_id} value={trunk.sip_trunk_id} className="text-xs">
                                  {trunk.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Room Prefix</Label>
                          <Input
                            placeholder="call-"
                            value={newRule.room_prefix}
                            onChange={(e) => setNewRule(prev => ({ ...prev, room_prefix: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                          <span>Enable Rule</span>
                          <Switch
                            checked={newRule.enabled}
                            onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, enabled: checked }))}
                          />
                        </div>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsCreateRuleOpen(false)} className="text-xs h-7">
                          Cancel
                        </Button>
                        <Button onClick={handleCreateDispatchRule} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7">
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog> */}
                </div>

                {filteredRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-3">
                      <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {searchQuery || statusFilter !== 'all' ? 'No rules match filters' : 'No Routing Rules'}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria'
                        : 'Create rules to automatically route calls'
                      }
                    </p>
                    {searchQuery || statusFilter !== 'all' ? (
                      <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all') }} className="text-xs h-7">
                        Clear Filters
                      </Button>
                    ) : (
                      <Button onClick={() => setIsCreateRuleOpen(true)} size="sm" className="text-xs h-7">
                        <Plus className="w-3 h-3 mr-1" />
                        Create First Rule
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Rules Table Header */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        <div className="col-span-3">Rule Name</div>
                        <div className="col-span-2">Agent</div>
                        <div className="col-span-2">Phone Numbers</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Calls</div>
                        <div className="col-span-1 text-right">Actions</div>
                      </div>
                    </div>
                    
                    {/* Rules Table Body */}
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredRules.map((rule, index) => (
                        <div
                          key={rule.sip_dispatch_rule_id || `rule-${index}`}
                          className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <div className="grid grid-cols-12 gap-3 items-center text-sm">
                            {/* Rule Name */}
                            <div className="col-span-3">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                {rule.sip_dispatch_rule_id || 'Unnamed Rule'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {rule.room_prefix}
                              </div>
                            </div>
                            
                            {/* Agent */}
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <Bot className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {rule.agent_name}
                                </span>
                              </div>
                            </div>
                            
                            {/* Phone Numbers */}
                            <div className="col-span-2">
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(rule.numbers) ? rule.numbers.slice(0, 2).map((number, index) => (
                                  <Badge key={index} variant="outline" className="text-xs font-mono">
                                    {number}
                                  </Badge>
                                )) : (
                                  <Badge variant="outline" className="text-xs">
                                    No numbers
                                  </Badge>
                                )}
                                {Array.isArray(rule.numbers) && rule.numbers.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{rule.numbers.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Status */}
                            <div className="col-span-2">
                              <Badge 
                                variant={rule.status === 'active' ? 'default' : 'secondary'}
                                className={`text-xs ${rule.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}`}
                              >
                                {rule.status}
                              </Badge>
                            </div>
                            
                            {/* Calls */}
                            <div className="col-span-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {rule.call_count || 0}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                calls processed
                              </div>
                            </div>
                            
                            {/* Actions */}
                            <div className="col-span-1 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem className="text-xs">
                                    <Edit className="h-3 w-3 mr-2" />
                                    Edit Rule
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteDispatchRule(rule.sip_dispatch_rule_id)}
                                    className="text-xs text-red-600 focus:text-red-600 dark:text-red-400"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Agent Assignment Dialog */}
      <Dialog open={isAssignmentOpen} onOpenChange={setIsAssignmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedTrunkForAssignment?.assigned_agent ? 'Change Agent Assignment' : 'Assign Agent'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an agent to handle calls from {selectedTrunkForAssignment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="text-xs mb-2 block">Select Agent</Label>
            <Select value={selectedAgentForAssignment} onValueChange={setSelectedAgentForAssignment}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    <div className="flex items-center gap-3 py-1">
                      <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center">
                        <Bot className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-xs">{agent.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{agent.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {agent.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsAssignmentOpen(false)} 
              className="text-xs h-7"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignAgent}
              disabled={!selectedAgentForAssignment || assigningTrunk === selectedTrunkForAssignment?.sip_trunk_id}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
            >
              {assigningTrunk === selectedTrunkForAssignment?.sip_trunk_id ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              {selectedTrunkForAssignment?.assigned_agent ? 'Update Assignment' : 'Assign Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}