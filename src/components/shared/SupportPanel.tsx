'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Mail,
  FileText,
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
      <SheetContent side="right" className="w-80 p-0 bg-card border-l border-border">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-base text-foreground">Support</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Get help with Whispey
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full overflow-y-auto">
          {/* Documentation Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Documentation</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Guides, concepts, and API reference with clear examples.
            </p>
            <Button 
              variant="outline"
              className="w-full text-xs h-8 border-border bg-card hover:bg-muted/50 text-foreground"
              onClick={() => {
                window.open('/docs', '_blank', 'noopener,noreferrer')
                onClose()
              }}
            >
              View docs
            </Button>
          </div>

          {/* Email Support Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Get Help</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Connect with our support engineers for assistance.
            </p>
            <Button 
              variant="outline"
              className="w-full text-xs h-8 border-border bg-card hover:bg-muted/50 text-foreground"
              onClick={() => {
                const subject = encodeURIComponent('Whispey Support Request')
                const body = encodeURIComponent(`Hi team,

I need help with:

[Please describe your issue here]

Best regards,
User`)
                window.open(`mailto:deepesh@pypeai.com?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer')
                onClose()
              }}
            >
              Email support
            </Button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}