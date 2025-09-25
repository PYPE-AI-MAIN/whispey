// src/components/agents/AgentConfig/MobileAgentHeader.tsx
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Play,
  Square,
  PhoneIcon,
  SlidersHorizontal, 
  Loader2,
  MoreVertical,
  Save,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

// Your existing interfaces and types
interface AgentStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  error?: string
  message?: string
  raw?: any
}

interface MobileHeaderProps {
  agentName: string | undefined
  agentStatus: AgentStatus
  isAgentLoading: boolean
  startAgent: () => void
  stopAgent: () => void
  handleSaveAndDeploy: () => void
  handleCancel: () => void
  formik: any
  hasExternalChanges: boolean
  saveAndDeploy: any
  isTalkToAssistantOpen: boolean
  setIsTalkToAssistantOpen: (open: boolean) => void
  isAdvancedSettingsOpen: boolean
  setIsAdvancedSettingsOpen: (open: boolean) => void
  TalkToAssistant: any
  AgentAdvancedSettings: any
}

const MobileAgentHeader: React.FC<MobileHeaderProps> = ({
  agentName,
  agentStatus,
  isAgentLoading,
  startAgent,
  stopAgent,
  handleSaveAndDeploy,
  handleCancel,
  formik,
  hasExternalChanges,
  saveAndDeploy,
  isTalkToAssistantOpen,
  setIsTalkToAssistantOpen,
  isAdvancedSettingsOpen,
  setIsAdvancedSettingsOpen,
  TalkToAssistant,
  AgentAdvancedSettings
}) => {
  const getAgentStatusColor = () => {
    switch (agentStatus.status) {
      case 'running': return 'bg-green-500'
      case 'starting': return 'bg-yellow-500'
      case 'stopping': return 'bg-orange-500'
      case 'stopped': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAgentStatusText = () => {
    switch (agentStatus.status) {
      case 'running': return 'Running'
      case 'starting': return 'Starting...'
      case 'stopping': return 'Stopping...'
      case 'stopped': return 'Stopped'
      case 'error': return 'Error'
      default: return 'Unknown'
    }
  }

  const isFormDirty = formik.dirty || hasExternalChanges

  return (
    <>
      {/* Mobile Header (< lg) */}
      <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Agent Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getAgentStatusColor()}`}></div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {agentName || 'Loading...'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getAgentStatusText()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Agent Control - Always visible */}
            {agentStatus.status === 'stopped' || agentStatus.status === 'error' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={startAgent}
                disabled={isAgentLoading || !agentName}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            ) : agentStatus.status === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={stopAgent}
                disabled={isAgentLoading}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            )}

            {/* Save & Deploy - Show when dirty */}
            {isFormDirty && (
              <Button 
                size="sm" 
                className="h-8 px-3" 
                onClick={handleSaveAndDeploy}
                disabled={saveAndDeploy.isPending}
              >
                {saveAndDeploy.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* Three Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  {/* Talk to Assistant */}
                  <DropdownMenuItem 
                    onSelect={() => setIsTalkToAssistantOpen(true)}
                    disabled={!agentName}
                  >
                    <PhoneIcon className="w-4 h-4 mr-2" />
                    Talk to Assistant
                  </DropdownMenuItem>

                  {/* Advanced Settings */}
                  <DropdownMenuItem onSelect={() => setIsAdvancedSettingsOpen(true)}>
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                {isFormDirty && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      {/* Save & Deploy - Alternative location */}
                      <DropdownMenuItem 
                        onSelect={handleSaveAndDeploy}
                        disabled={saveAndDeploy.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveAndDeploy.isPending ? 'Deploying...' : 'Save & Deploy'}
                      </DropdownMenuItem>

                      {/* Cancel */}
                      <DropdownMenuItem onSelect={handleCancel}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel Changes
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Desktop Header (>= lg) - Your existing header */}
      <div className="hidden lg:block bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor()}`}></div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {agentName || 'Loading...'}
              </span>
              <span className="text-xs text-gray-500">
                {getAgentStatusText()}
                {agentStatus.pid && ` (PID: ${agentStatus.pid})`}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Agent Controls */}
            {agentStatus.status === 'stopped' || agentStatus.status === 'error' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={startAgent}
                disabled={isAgentLoading || !agentName}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 mr-1" />
                )}
                Start Agent
              </Button>
            ) : agentStatus.status === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={stopAgent}
                disabled={isAgentLoading}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Square className="w-3 h-3 mr-1" />
                )}
                Stop Agent
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                {agentStatus.status === 'starting' ? 'Starting...' : 'Stopping...'}
              </Button>
            )}

            {/* Talk to Assistant Button */}
            <Sheet open={isTalkToAssistantOpen} onOpenChange={setIsTalkToAssistantOpen}>
              <SheetHeader className="sr-only">
                <SheetTitle>Talk to Assistant</SheetTitle>
              </SheetHeader>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!agentName}
                >
                  <PhoneIcon className="w-3 h-3 mr-1" />
                  Talk to Assistant
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-96 p-0">
                <TalkToAssistant
                  agentName={agentName || ''}
                  isOpen={isTalkToAssistantOpen}
                  onClose={() => setIsTalkToAssistantOpen(false)}
                  agentStatus={agentStatus}
                />
              </SheetContent>
            </Sheet>

            {/* Cancel Button */}
            {isFormDirty && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            
            {/* Save & Deploy Button */}
            <Button 
              size="sm" 
              className="h-8 text-xs" 
              onClick={handleSaveAndDeploy}
              disabled={saveAndDeploy.isPending || !isFormDirty}
            >
              {saveAndDeploy.isPending ? 'Deploying...' : 'Save & Deploy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sheets */}
      <Sheet open={isTalkToAssistantOpen} onOpenChange={setIsTalkToAssistantOpen}>
        <SheetHeader className="sr-only">
          <SheetTitle>Talk to Assistant</SheetTitle>
        </SheetHeader>
        <SheetContent side="right" className="w-full sm:w-96 p-0">
          <TalkToAssistant
            agentName={agentName || ''}
            isOpen={isTalkToAssistantOpen}
            onClose={() => setIsTalkToAssistantOpen(false)}
            agentStatus={agentStatus}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
        <SheetHeader className="sr-only">
          <SheetTitle>Advanced Settings</SheetTitle>
        </SheetHeader>
        <SheetContent side="right" className="w-full sm:w-96 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">Advanced Settings</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <AgentAdvancedSettings 
              advancedSettings={formik.values.advancedSettings}
              onFieldChange={formik.setFieldValue}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default MobileAgentHeader