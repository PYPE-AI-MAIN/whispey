'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { 
  Mail, 
  Github, 
  ExternalLink,
  FileText,
  Users,
  MessageSquare
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface SupportSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function SupportSheet({ isOpen, onClose }: SupportSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80 p-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
        <SheetHeader className="p-4 border-b border-gray-200 dark:border-gray-800">
          <SheetTitle className="text-base text-gray-900 dark:text-gray-100">Support</SheetTitle>
          <SheetDescription className="text-xs text-gray-600 dark:text-gray-400">
            Get help with Whispey
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full overflow-y-auto">
          {/* Documentation Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Documentation</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              Guides, concepts, and API reference with clear examples.
            </p>
            <Button 
              variant="outline"
              className="w-full text-xs h-8 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={() => {
                window.open('/docs', '_blank')
                onClose()
              }}
            >
              View docs
            </Button>
          </div>

          {/* Email Support Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Get Help</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              Connect with our support engineers for assistance.
            </p>
            <Button 
              variant="outline"
              className="w-full text-xs h-8 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
              onClick={() => {
                const subject = encodeURIComponent('Whispey Support Request')
                const body = encodeURIComponent(`Hi team,

I need help with:

[Please describe your issue here]

Best regards,
User`)
                window.open(`mailto:deepesh@pypeai.com?subject=${subject}&body=${body}`, '_blank')
                onClose()
              }}
            >
              Email support
            </Button>
          </div>

          {/* Community Section */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Community</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              Join the conversation with the Whispey community.
            </p>
            
            <div className="space-y-2">
              <Button 
                variant="ghost"
                className="w-full justify-start text-xs h-8 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                onClick={() => {
                  window.open('https://github.com/PYPE-AI-MAIN/whispey', '_blank')
                  onClose()
                }}
              >
                <Github className="w-3.5 h-3.5 mr-2" />
                <span className="flex-1 text-left">GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </Button>

              <Button 
                variant="ghost"
                className="w-full justify-start text-xs h-8 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
                onClick={() => {
                  window.open('https://discord.gg/hrj7H82WQG', '_blank')
                  onClose()
                }}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                <span className="flex-1 text-left">Discord</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}