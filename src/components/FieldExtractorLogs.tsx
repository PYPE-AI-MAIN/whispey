"use client"

import type React from "react"
import { useState } from "react"
import { Plus, X, WandSparkles } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator" // Added Separator for visual breaks
import MagicButton from "@/components/buttons/MagicButton" // Assuming this is a custom button component

interface FieldExtractorItem {
  key: string
  description: string
}

interface FieldExtractorDialogProps {
  initialData?: FieldExtractorItem[]
  onSave: (data: FieldExtractorItem[], enabled: boolean) => void
  isEnabled?: boolean
}

const FieldExtractorDialog: React.FC<FieldExtractorDialogProps> = ({ initialData = [], onSave, isEnabled = false }) => {
  const [fields, setFields] = useState<FieldExtractorItem[]>(
    initialData.length > 0 ? initialData : [{ key: "", description: "" }]
  )
  const [enabled, setEnabled] = useState(isEnabled)
  const [isOpen, setIsOpen] = useState(false) // State to control dialog open/close

  const addField = () => {
    setFields([...fields, { key: "", description: "" }])
  }

  const removeField = (index: number) => {
    const updated = [...fields]
    updated.splice(index, 1)
    setFields(updated)
  }

  const updateField = (index: number, field: Partial<FieldExtractorItem>) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], ...field }
    setFields(updated)
  }

  const handleSave = () => {
    const validFields = fields.filter((f) => f.key.trim() !== "" || f.description.trim() !== "")
    onSave(validFields, enabled)
    setIsOpen(false) // Close dialog on save
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {" "}
      {/* Control dialog state */}
      <DialogTrigger asChild>
        {/* The single, refined "sparkle" button */}
        <MagicButton />
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-lg shadow-xl flex flex-col h-[80vh] max-h-[600px] p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Field Extractor Config
          </DialogTitle>
        </DialogHeader>
        <Separator className="flex-shrink-0" />

        {/* Fixed section for the enable switch */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800">
            <Label htmlFor="enabled" className="text-base font-medium text-gray-700 dark:text-gray-300">
              Enable Field Extraction
            </Label>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        {/* Scrollable section for the fields list */}
        <div className="flex-grow overflow-y-auto px-6 space-y-4">
          {fields.map((field, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-5">
                <Label
                  htmlFor={`field-key-${index}`}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block"
                >
                  Label
                </Label>
                <Input
                  id={`field-key-${index}`}
                  placeholder="e.g. Respondent Name"
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  className="rounded-md border border-gray-300 dark:border-gray-700 focus:ring-gray-950 focus:border-gray-950 dark:focus:ring-gray-300 dark:focus:border-gray-300"
                />
              </div>
              <div className="col-span-6">
                <Label
                  htmlFor={`field-description-${index}`}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block"
                >
                  Description
                </Label>
                <Input
                  id={`field-description-${index}`}
                  placeholder="Describe what to extract"
                  value={field.description}
                  onChange={(e) => updateField(index, { description: e.target.value })}
                  className="rounded-md border border-gray-300 dark:border-gray-700 focus:ring-gray-950 focus:border-gray-950 dark:focus:ring-gray-300 dark:focus:border-gray-300"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeField(index)}
                aria-label={`Remove field ${index + 1}`}
                className="rounded-full w-8 h-8 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Fixed section for action buttons */}
        <div className="flex-shrink-0 p-6 pt-4 space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={addField}
            className="w-full rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Field
          </Button>
          <Button
            onClick={handleSave}
            className="w-full rounded-md bg-gray-900 text-white shadow-sm hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus-visible:ring-gray-300"
          >
            Save Field Extractor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FieldExtractorDialog
