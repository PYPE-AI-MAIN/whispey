'use client'
// TEMPORARY scratch route for visual verification of the LiveKit Inference provider.
// Lives under /playground(.*) so it bypasses Clerk. Delete before merging.
import { useState } from 'react'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'

export default function ModelCheck() {
  const [provider, setProvider] = useState('livekit')
  const [model, setModel] = useState('google/gemma-4-31b-it')
  const [temperature, setTemperature] = useState(0.3)
  return (
    <div className="p-10 space-y-6">
      <h1 className="text-lg font-semibold">ModelSelector — LiveKit Inference check</h1>
      <ModelSelector
        selectedProvider={provider}
        selectedModel={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />
      <pre data-testid="state" className="text-xs bg-gray-100 p-3 rounded">
        {JSON.stringify({ provider, model, temperature }, null, 2)}
      </pre>
    </div>
  )
}
