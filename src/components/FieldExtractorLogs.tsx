"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Plus, X, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import MagicButton from "@/components/buttons/MagicButton"

interface FieldExtractorItem {
  key: string
  description: string
}

interface FieldExtractorVariable {
  variableName: string
  columnPath: string
}

interface FieldExtractorDialogProps {
  initialData?: FieldExtractorItem[]
  initialVariables?: Record<string, string>
  onSave: (data: FieldExtractorItem[], enabled: boolean, variables: Record<string, string>) => void
  isEnabled?: boolean
}

const FieldExtractorDialog: React.FC<FieldExtractorDialogProps> = ({ 
  initialData = [], 
  initialVariables = {},
  onSave, 
  isEnabled = false 
}) => {
  const [fields, setFields] = useState<FieldExtractorItem[]>(
    initialData.length > 0 ? initialData : [{ key: "", description: "" }]
  )
  const [variables, setVariables] = useState<FieldExtractorVariable[]>(
    Object.entries(initialVariables).map(([variableName, columnPath]) => ({
      variableName,
      columnPath
    }))
  )
  const [enabled, setEnabled] = useState(isEnabled)
  const [isOpen, setIsOpen] = useState(false)
  
  // Extract variable names from all field descriptions
  const detectedVariables = useMemo(() => {
    const varPattern = /\{\{(\w+)\}\}/g
    const detected = new Set<string>()
    
    fields.forEach(field => {
      const matches = field.description.matchAll(varPattern)
      for (const match of matches) {
        detected.add(match[1])
      }
    })
    
    return Array.from(detected)
  }, [fields])
  
  // Check for unmapped variables
  const unmappedVariables = useMemo(() => {
    const mappedNames = new Set(variables.map(v => v.variableName))
    return detectedVariables.filter(v => !mappedNames.has(v))
  }, [detectedVariables, variables])

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

  const addVariable = () => {
    setVariables([...variables, { variableName: "", columnPath: "" }])
  }

  const removeVariable = (index: number) => {
    const updated = [...variables]
    updated.splice(index, 1)
    setVariables(updated)
  }

  const updateVariable = (index: number, variable: Partial<FieldExtractorVariable>) => {
    const updated = [...variables]
    updated[index] = { ...updated[index], ...variable }
    setVariables(updated)
  }

  const handleSave = () => {
    const validFields = fields.filter((f) => f.key.trim() !== "" || f.description.trim() !== "")
    const validVariables = variables.filter(
      (v) => v.variableName.trim() !== "" && v.columnPath.trim() !== ""
    )
    const variablesObject = Object.fromEntries(
      validVariables.map((v) => [v.variableName, v.columnPath])
    )
    onSave(validFields, enabled, variablesObject)
    setIsOpen(false)
  }
  
  const addUnmappedVariables = () => {
    const newVariables = unmappedVariables.map(varName => ({
      variableName: varName,
      columnPath: ""
    }))
    setVariables([...variables, ...newVariables])
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <MagicButton />
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-lg shadow-xl p-0 flex flex-col h-[85vh]">
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
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="space-y-6 pr-2">
            {/* Fields Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Extraction Fields</h3>
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={`field-${index}`} className="grid grid-cols-12 gap-4 items-end">
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
            </div>

            {/* Variables Section */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Dynamic Variables</h3>
                {unmappedVariables.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addUnmappedVariables}
                    className="text-xs h-7"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Map {unmappedVariables.length} detected
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Variables used in descriptions: {detectedVariables.length > 0 ? detectedVariables.map(v => `{{${v}}}`).join(', ') : 'None detected'}
              </p>
              {unmappedVariables.length > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {unmappedVariables.map(v => `{{${v}}}`).join(', ')} need mapping
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {variables.map((variable, index) => (
                  <div key={`var-${index}`} className="grid grid-cols-12 gap-4 items-end">
                    <div className="col-span-5">
                      <Label
                        htmlFor={`var-name-${index}`}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block"
                      >
                        Variable Name
                      </Label>
                      <Input
                        id={`var-name-${index}`}
                        placeholder="e.g. customer_name"
                        value={variable.variableName}
                        onChange={(e) => updateVariable(index, { variableName: e.target.value })}
                        className="rounded-md border border-gray-300 dark:border-gray-700 focus:ring-gray-950 focus:border-gray-950 dark:focus:ring-gray-300 dark:focus:border-gray-300"
                      />
                    </div>
                    <div className="col-span-6">
                      <Label
                        htmlFor={`var-path-${index}`}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block"
                      >
                        Column Path
                      </Label>
                      <Input
                        id={`var-path-${index}`}
                        placeholder="e.g. metadata.name, dynamic_variables.order_id"
                        value={variable.columnPath}
                        onChange={(e) => updateVariable(index, { columnPath: e.target.value })}
                        className="rounded-md border border-gray-300 dark:border-gray-700 focus:ring-gray-950 focus:border-gray-950 dark:focus:ring-gray-300 dark:focus:border-gray-300"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariable(index)}
                      aria-label={`Remove variable ${index + 1}`}
                      className="rounded-full w-8 h-8 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed section for action buttons */}
        <div className="flex-shrink-0 p-6 pt-4 border-t dark:border-gray-700">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addField}
                className="rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Field
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={addVariable}
                className="rounded-md border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 bg-transparent"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Variable
              </Button>
            </div>
            <Button
              onClick={handleSave}
              className="w-full rounded-md bg-gray-900 text-white shadow-sm hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200 dark:focus-visible:ring-gray-300"
            >
              Save Field Extractor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FieldExtractorDialog
