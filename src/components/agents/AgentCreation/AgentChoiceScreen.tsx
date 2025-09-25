"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Sparkles, Eye } from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'

interface AgentChoiceScreenProps {
  onCreateAgent: () => void
  onConnectAgent: () => void
  onClose: () => void
}

const AgentChoiceScreen: React.FC<AgentChoiceScreenProps> = ({
  onCreateAgent,
  onConnectAgent,
  onClose
}) => {
  const { isMobile } = useMobile(768)

  return (
    <>
      {/* Header */}
      <DialogHeader className={`${isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'} flex-shrink-0`}>
        <div className="text-center">
          <div className={`${isMobile ? 'w-10 h-10 mb-2' : 'w-12 h-12 mb-3'} mx-auto bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-800`}>
            <Sparkles className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-gray-700 dark:text-gray-300`} />
          </div>
          <DialogTitle className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 mb-1`}>
            Setup Voice Agent
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose how you'd like to get started
          </p>
        </div>
      </DialogHeader>

      {/* Content */}
      <div className={`flex-1 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
        <div className="space-y-3">
          {/* Create Agent Option - Disabled */}
          <div className={`group relative ${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 transition-all duration-200 cursor-not-allowed opacity-75`}>
            <div className="flex items-start gap-3">
              <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Plus className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-gray-400 dark:text-gray-500`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`flex items-center gap-2 ${isMobile ? 'mb-1' : 'mb-2'}`}>
                  <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-500 dark:text-gray-400`}>
                    {isMobile ? 'Create New Agent' : 'Create New Agent with Pype'}
                  </h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full flex-shrink-0">
                    coming soon
                  </span>
                </div>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-400 dark:text-gray-500 leading-relaxed`}>
                  {isMobile 
                    ? 'Build a new voice agent from scratch with automatic monitoring setup.'
                    : 'Build a new voice agent from scratch. We\'ll create the assistant and set up monitoring automatically.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Connect Agent Option */}
          <div
            className={`group relative ${isMobile ? 'p-4' : 'p-6'} rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all duration-200 cursor-pointer`}
            onClick={onConnectAgent}
          >
            <div className="flex items-start gap-3">
              <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-teal-100 dark:bg-teal-900/30 group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors`}>
                <Eye className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-teal-600 dark:text-teal-400`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`${isMobile ? 'text-base mb-1' : 'text-lg mb-2'} font-semibold text-gray-900 dark:text-gray-100`}>
                  Connect Existing Agent
                </h3>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 leading-relaxed`}>
                  {isMobile
                    ? 'Add monitoring to your existing LiveKit or Vapi voice agent.'
                    : 'Add monitoring to your existing LiveKit or Vapi voice agent. Connect and start observing immediately.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`flex-shrink-0 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'} bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800`}>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={onClose}
            size={isMobile ? "sm" : "default"}
            className={`flex-1 ${isMobile ? 'h-9 text-sm' : 'h-10'} text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
}

export default AgentChoiceScreen