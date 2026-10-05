import React, { useState } from 'react'
import { Check, Copy, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RAYA_LANGUAGES,
  RAYA_PROMPT_SNIPPET,
  RAYA_SAMPLE_RATES,
  RAYA_SPEED,
  RAYA_SPEED_PRESETS,
  type RayaConfig,
} from '@/lib/tts/raya'

interface RayaSettingsProps {
  config: RayaConfig
  setConfig: React.Dispatch<React.SetStateAction<RayaConfig>>
}

const Section = ({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
      {title}
    </h3>
    {children}
  </div>
)

export default function RayaSettings({ config, setConfig }: Readonly<RayaSettingsProps>) {
  const [copied, setCopied] = useState(false)
  const isEnglish = config.language === 'en-in' || config.language === 'en-us'
  const isHindi = config.language === 'hi'

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(RAYA_PROMPT_SNIPPET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard can be blocked */
    }
  }

  return (
    <>
      <Section title="Basic Settings">
        <div className="space-y-2">
          <Label htmlFor="raya-language">Language</Label>
          <Select value={config.language} onValueChange={(language) => setConfig((prev) => ({ ...prev, language }))}>
            <SelectTrigger id="raya-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RAYA_LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                  {l.native && <span className="ml-2 text-gray-400">{l.native}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Follows the voice you pick. Change it only if the agent will speak a different language than the voice
            is tuned for.
          </p>
        </div>
      </Section>

      <Section title="Audio Settings">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label>Speed: {config.speed.toFixed(2)}×</Label>
              <div className="flex gap-1">
                {RAYA_SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, speed: preset.value }))}
                    aria-pressed={config.speed === preset.value}
                    className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                      config.speed === preset.value
                        ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              value={[config.speed]}
              onValueChange={([speed]) => setConfig((prev) => ({ ...prev, speed }))}
              min={RAYA_SPEED.min}
              max={RAYA_SPEED.max}
              step={RAYA_SPEED.step}
              className="w-full"
              aria-label="Speech speed"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Slower ({RAYA_SPEED.min}×)</span>
              <span>Faster ({RAYA_SPEED.max}×)</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label id="raya-sample-rate-label">Sample rate</Label>
            <div role="radiogroup" aria-labelledby="raya-sample-rate-label" className="grid grid-cols-2 gap-2">
              {RAYA_SAMPLE_RATES.map((rate) => {
                const active = config.sample_rate === rate.value
                return (
                  <button
                    key={rate.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setConfig((prev) => ({ ...prev, sample_rate: rate.value }))}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? 'border-teal-300 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="block text-xs font-medium text-gray-900 dark:text-gray-100">{rate.label}</span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">{rate.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Pronunciation">
        <div className="rounded-lg border border-teal-200/70 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-950/20 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 mt-0.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <div className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 space-y-1.5">
              {isHindi && (
                <p>
                  <b>Hindi must be in Devanagari.</b> Romanised Hindi (&ldquo;namaste&rdquo;) isn&apos;t supported
                  and sounds poor.
                </p>
              )}
              {isEnglish && (
                <p>
                  <b>Write Indian names in Devanagari</b> even in English sentences — &ldquo;राहुल from
                  मुंबई&rdquo; is pronounced far more accurately than &ldquo;Rahul from Mumbai&rdquo;.
                </p>
              )}
              {!isHindi && !isEnglish && (
                <p>
                  Write each language in its own script. For mixed Hindi-English sentences, keep Indian names in
                  Devanagari.
                </p>
              )}
              <p>If an LLM writes your agent&apos;s lines, add this to its prompt:</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <code className="flex-1 rounded bg-white/70 dark:bg-black/20 p-2 text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
              {RAYA_PROMPT_SNIPPET}
            </code>
            <Button variant="outline" size="sm" className="h-8 flex-shrink-0" onClick={copySnippet}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
