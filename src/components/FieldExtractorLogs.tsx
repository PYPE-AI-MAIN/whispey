"use client"

import type React from "react"
import { useState, useMemo, useRef } from "react"
import { Plus, X, AlertCircle, Maximize2, Minimize2, Copy, Check, ClipboardPaste, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import MagicButton from "@/components/buttons/MagicButton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEFAULT_FIELD_EXTRACTOR_MODEL, FIELD_EXTRACTOR_MODELS, isFieldExtractorModel } from "@/config/fieldExtractorModels"
import { DEFAULT_DNC_FIELD_DESCRIPTION, DNC_FIELD_DESCRIPTION_MAX, DNC_FIELD_KEY, splitDncField, withDncField } from "@/config/dncChecker"
import { cn } from "@/lib/utils"

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
  /** `model` is the Azure deployment picked in the dialog (see config/fieldExtractorModels). */
  /** `data` includes the DNC field while `dncEnabled` is on (see config/dncChecker). */
  onSave: (data: FieldExtractorItem[], enabled: boolean, variables: Record<string, string>, model: string, dncEnabled: boolean) => void
  /** The agent's saved dnc_checker_enabled. */
  initialDncEnabled?: boolean
  isEnabled?: boolean
  /** The agent's saved field_extractor_model; empty means the default. */
  initialModel?: string | null
  /** What to call these in the UI. Studio says "Dispositions"; the config page keeps "Field Extractor". */
  terminology?: 'field_extractor' | 'dispositions'
}

/** Has both a label and a description (saved configs can be partial JSON). */
const isCompleteField = (f: Partial<FieldExtractorItem>) => !!(f.key?.trim() && f.description?.trim())

const FieldExtractorDialog: React.FC<FieldExtractorDialogProps> = ({ 
  initialData = [], 
  initialVariables = {},
  onSave, 
  isEnabled = false,
  initialModel = null,
  initialDncEnabled = false,
  terminology = 'field_extractor',
}) => {
  const isDisp = terminology === 'dispositions'
  const noun = isDisp ? 'Dispositions' : 'Field Extractor'
  // The DNC field is edited on its own tab, so the fields list never shows it.
  const { dncField: initialDncField, otherFields: initialFields } = splitDncField(initialData)
  const [fields, setFields] = useState<FieldExtractorItem[]>(
    initialFields.length > 0 ? initialFields : [{ key: "", description: "" }]
  )
  const [tab, setTab] = useState<'fields' | 'dnc'>('fields')
  const [dncEnabled, setDncEnabled] = useState(initialDncEnabled)
  const [dncDescription, setDncDescription] = useState(initialDncField?.description ?? DEFAULT_DNC_FIELD_DESCRIPTION)
  const [variables, setVariables] = useState<FieldExtractorVariable[]>(
    Object.entries(initialVariables).map(([variableName, columnPath]) => ({
      variableName,
      columnPath
    }))
  )
  const [enabled, setEnabled] = useState(isEnabled)
  // Set once the switch is flipped by hand — from then on it's left exactly as chosen.
  const [enabledTouched, setEnabledTouched] = useState(false)
  const [model, setModel] = useState(isFieldExtractorModel(initialModel) ? initialModel : DEFAULT_FIELD_EXTRACTOR_MODEL)
  const [isOpen, setIsOpen] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  // Stable per-row keys: keying on the field's text remounted the row on every
  // keystroke, so the autofocused textarea jumped its cursor back to the start.
  const rowIds = useRef<string[]>([])
  const nextRowId = useRef(0)
  const rowId = (index: number) => {
    while (rowIds.current.length <= index) rowIds.current.push(`field-row-${nextRowId.current++}`)
    return rowIds.current[index]
  }
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

  // Setting up an extractor for the first time turns it on once a field is
  // filled in. One that already has fields keeps whatever it was (off stays
  // off), and flipping the switch yourself always wins.
  const isNewSetup = !initialFields.some(isCompleteField)
  const hasCompleteField = fields.some(isCompleteField)
  const effectiveEnabled = enabledTouched ? enabled : enabled || (isNewSetup && hasCompleteField)
  const changeEnabled = (on: boolean) => {
    setEnabledTouched(true)
    setEnabled(on)
  }

  const addField = () => {
    setFields([...fields, { key: "", description: "" }])
  }

  const removeField = (index: number) => {
    const updated = [...fields]
    updated.splice(index, 1)
    rowIds.current.splice(index, 1)
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
    // Only complete entries are kept — a key without a description (or the
    // reverse) is silently dropped by the extractor anyway, so saving it just
    // looks like it worked.
    const validFields = fields
      .map((f) => ({ ...f, key: f.key.trim(), description: f.description.trim() }))
      .filter((f) => f.key !== "" && f.description !== "")
    const validVariables = variables.filter(
      (v) => v.variableName.trim() !== "" && v.columnPath.trim() !== ""
    )
    const variablesObject = Object.fromEntries(
      validVariables.map((v) => [v.variableName, v.columnPath])
    )
    // Turning it on with nothing to extract would run the extractor for no
    // result on every call, so an empty list saves as off.
    // A field of your own named dnc_requested would clash with the checker's.
    const ownFields = validFields.filter((f) => f.key !== DNC_FIELD_KEY)
    onSave(
      withDncField(ownFields, { enabled: dncEnabled, description: dncDescription }),
      effectiveEnabled && ownFields.length > 0,
      variablesObject,
      model,
      dncEnabled,
    )
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
        <MagicButton label={noun} />
      </DialogTrigger>
      {/* sm:max-w-3xl alongside max-w-3xl: the base DialogContent sets
          sm:max-w-lg, and tailwind-merge doesn't touch it for an unprefixed
          max-w- override — the two live in different variant buckets, so
          the sm: one silently won on every real screen without this */}
      <DialogContent className="max-w-3xl sm:max-w-3xl rounded-lg shadow-xl p-0 flex flex-col h-[85vh]">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold text-foreground">
            {noun} Config
          </DialogTitle>
        </DialogHeader>

        <div role="tablist" aria-label={`${noun} sections`} className="flex flex-shrink-0 gap-6 border-b border-border px-6">
          <TabButton active={tab === 'fields'} onClick={() => setTab('fields')}>
            {isDisp ? 'Dispositions' : 'Fields'}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{fields.filter(isCompleteField).length}</span>
          </TabButton>
          <TabButton active={tab === 'dnc'} onClick={() => setTab('dnc')}>
            Do Not Call{' '}
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] font-medium",
                dncEnabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {dncEnabled ? 'On' : 'Off'}
            </span>
          </TabButton>
        </div>

        {tab === 'dnc' && (
          <DncTab
            enabled={dncEnabled}
            onEnabledChange={setDncEnabled}
            description={dncDescription}
            onDescriptionChange={setDncDescription}
          />
        )}

        {tab === 'fields' && (<>
        {/* Fixed section for the enable switch */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="rounded-md bg-muted divide-y divide-border">
            <div className="flex items-center justify-between p-2">
              <Label htmlFor="enabled" className="text-base font-medium text-foreground">
                {isDisp ? 'Enable Dispositions' : 'Enable Field Extraction'}
              </Label>
              <Switch id="enabled" checked={effectiveEnabled} onCheckedChange={changeEnabled} />
            </div>
            <div className="flex items-center justify-between gap-3 p-2">
              <Label htmlFor="field-extractor-model" className="text-base font-medium text-foreground">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="field-extractor-model" size="sm" className="h-8 w-56 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {FIELD_EXTRACTOR_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                      {m.value === DEFAULT_FIELD_EXTRACTOR_MODEL && <span className="ml-1.5 text-xs text-muted-foreground">default</span>}
                      {m.beta && <span className="ml-1.5 rounded border border-warning/40 px-1 text-[10px] font-medium uppercase text-warning">beta</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  {pasteError && <span className="text-xs text-destructive">{pasteError}</span>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void pasteAllFields()}
                    className="h-7 text-xs"
                    title="Replace all fields with a pasted JSON array"
                  >
                    {pastedAll ? <Check className="w-3.5 h-3.5 mr-1 text-success" /> : <ClipboardPaste className="w-3.5 h-3.5 mr-1" />}
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
                    {copiedAll ? <Check className="w-3.5 h-3.5 mr-1 text-success" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    Copy all
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const expanded = expandedIndex === index
                  return (
                  <div
                    key={rowId(index)}
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
                          {copiedIndex === index ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeField(index)}
                          aria-label={`Remove field ${index + 1}`}
                          className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
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
                <div className="flex items-center gap-2 p-2 rounded-md bg-warning/10 border border-warning/30">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <p className="text-xs text-warning">
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
                        className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
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

        </>)}

        {/* Fixed section for action buttons */}
        <div className="flex-shrink-0 p-6 pt-4 border-t border-border">
          <div className="space-y-2">
            {tab === 'fields' && <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={addField} className="border-dashed">
                <Plus className="w-4 h-4 mr-2" /> Add Field
              </Button>
              <Button type="button" variant="outline" onClick={addVariable} className="border-dashed">
                <Plus className="w-4 h-4 mr-2" /> Add Variable
              </Button>
            </div>}
            <Button onClick={handleSave} className="w-full">
              Save {noun}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, children }: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/** The Do Not Call tab: one switch and the editable rule. */
function DncTab({ enabled, onEnabledChange, description, onDescriptionChange }: Readonly<{
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  description: string
  onDescriptionChange: (text: string) => void
}>) {
  const isDefault = description.trim() === DEFAULT_DNC_FIELD_DESCRIPTION.trim()
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="dnc-enabled" className="text-base font-semibold text-foreground">Do Not Call checker</Label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Callers who ask not to be called again go on this agent&apos;s Do Not Call list.
          </p>
        </div>
        <Switch id="dnc-enabled" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      <div className={cn("space-y-2 transition-opacity", !enabled && "pointer-events-none opacity-40")}>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="dnc-description" className="text-sm font-medium text-foreground">Rule</Label>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onDescriptionChange(DEFAULT_DNC_FIELD_DESCRIPTION)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        <Textarea
          id="dnc-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={DNC_FIELD_DESCRIPTION_MAX}
          rows={10}
          disabled={!enabled}
          className="resize-y text-sm leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          Answered as <code className="font-mono">{DNC_FIELD_KEY}</code> after each call.
        </p>
      </div>
    </div>
  )
}

export default FieldExtractorDialog
