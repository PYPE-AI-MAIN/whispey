"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Plus, X, AlertCircle, Maximize2, Minimize2, Copy, Check, ClipboardPaste } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [pastedAll, setPastedAll] = useState(false)
  const [pasteError, setPasteError] = useState<string | null>(null)

  const copyField = (field: FieldExtractorItem, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(field, null, 2))
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500)
  }

  const copyAllFields = () => {
    navigator.clipboard.writeText(JSON.stringify(fields, null, 2))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  /** The other half of "Copy all" — replaces the field list with a pasted JSON array of the same shape. */
  const pasteAllFields = async () => {
    setPasteError(null)
    try {
      const text = await navigator.clipboard.readText()
      const parsed: unknown = JSON.parse(text)
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Expected a JSON array of fields')
      }
      const next: FieldExtractorItem[] = parsed.map((item, i) => {
        if (typeof item !== 'object' || item === null || typeof (item as { key?: unknown }).key !== 'string') {
          throw new Error(`Item ${i + 1} is missing a "key" string`)
        }
        const { key, description } = item as { key: string; description?: unknown }
        return { key, description: typeof description === 'string' ? description : '' }
      })
      setFields(next)
      setPastedAll(true)
      setTimeout(() => setPastedAll(false), 1500)
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Clipboard did not contain a valid fields JSON array')
      setTimeout(() => setPasteError(null), 3000)
    }
  }

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
      {/* sm:max-w-3xl alongside max-w-3xl: the base DialogContent sets
          sm:max-w-lg, and tailwind-merge doesn't touch it for an unprefixed
          max-w- override — the two live in different variant buckets, so
          the sm: one silently won on every real screen without this */}
      <DialogContent className="max-w-3xl sm:max-w-3xl rounded-lg shadow-xl p-0 flex flex-col h-[85vh]">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Field Extractor Config
          </DialogTitle>
        </DialogHeader>
        <Separator className="flex-shrink-0" />

        {/* Fixed section for the enable switch */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center justify-between p-2 rounded-md bg-muted">
            <Label htmlFor="enabled" className="text-base font-medium text-foreground">
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Extraction Fields</h3>
                <div className="flex items-center gap-2">
                  {pasteError && <span className="text-xs text-red-500">{pasteError}</span>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void pasteAllFields()}
                    className="h-7 text-xs"
                    title="Replace all fields with a pasted JSON array"
                  >
                    {pastedAll ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <ClipboardPaste className="w-3.5 h-3.5 mr-1" />}
                    Paste all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyAllFields}
                    className="h-7 text-xs"
                    title="Copy all fields as a JSON array"
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    Copy all
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const expanded = expandedIndex === index
                  return (
                  <div
                    key={`field-${field.key}-${field.description}`}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label
                          htmlFor={`field-key-${index}`}
                          className="text-sm font-medium text-muted-foreground mb-1 block"
                        >
                          Label
                        </Label>
                        <Input
                          id={`field-key-${index}`}
                          placeholder="e.g. Respondent Name"
                          value={field.key}
                          onChange={(e) => updateField(index, { key: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      <div className="col-span-5">
                        <Label
                          htmlFor={`field-description-${index}`}
                          className="text-sm font-medium text-muted-foreground mb-1 block"
                        >
                          Description
                        </Label>
                        <div className="flex gap-1">
                          <Input
                            id={`field-description-${index}`}
                            placeholder="Describe what to extract"
                            value={field.description}
                            onChange={(e) => updateField(index, { description: e.target.value })}
                            className="flex-1 h-8"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedIndex(expanded ? null : index)}
                            className="h-8 w-8 p-0 flex-shrink-0"
                            title={expanded ? "Collapse" : "Expand editor"}
                          >
                            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => copyField(field, index)}
                          aria-label={`Copy field ${index + 1}`}
                          title="Copy as JSON"
                          className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
                        >
                          {copiedIndex === index ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(index)}
                          aria-label={`Remove field ${index + 1}`}
                          className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="space-y-1">
                        <Textarea
                          value={field.description}
                          onChange={(e) => updateField(index, { description: e.target.value })}
                          placeholder="Describe what to extract in detail..."
                          className="min-h-[160px] resize-y text-sm"
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {`{{variable_name}}`} for dynamic values
                        </p>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>

            {/* Variables Section */}
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Dynamic Variables</h3>
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
              <p className="text-xs text-muted-foreground">
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
                  <div key={`var-${index}`} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label
                        htmlFor={`var-name-${index}`}
                        className="text-sm font-medium text-muted-foreground mb-1 block"
                      >
                        Variable Name
                      </Label>
                      <Input
                        id={`var-name-${index}`}
                        placeholder="e.g. customer_name"
                        value={variable.variableName}
                        onChange={(e) => updateVariable(index, { variableName: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-6">
                      <Label
                        htmlFor={`var-path-${index}`}
                        className="text-sm font-medium text-muted-foreground mb-1 block"
                      >
                        Column Path
                      </Label>
                      <Input
                        id={`var-path-${index}`}
                        placeholder="e.g. metadata.name, dynamic_variables.order_id"
                        value={variable.columnPath}
                        onChange={(e) => updateVariable(index, { columnPath: e.target.value })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVariable(index)}
                        aria-label={`Remove variable ${index + 1}`}
                        className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed section for action buttons */}
        <div className="flex-shrink-0 p-6 pt-4 border-t border-border">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={addField} className="border-dashed">
                <Plus className="w-4 h-4 mr-2" /> Add Field
              </Button>
              <Button type="button" variant="outline" onClick={addVariable} className="border-dashed">
                <Plus className="w-4 h-4 mr-2" /> Add Variable
              </Button>
            </div>
            <Button onClick={handleSave} className="w-full">
              Save Field Extractor
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FieldExtractorDialog
