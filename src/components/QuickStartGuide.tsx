import { Check, Copy, Key, Play, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from './ui/button'

// Improved Quick Start Component with Step-by-Step Integration
function QuickStartGuide({ agentId }: { agentId: string }) {
    const [copiedStep, setCopiedStep] = useState<string | null>(null)
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
    const [expandedExample, setExpandedExample] = useState(false)
  
    const copyToClipboard = (text: string, stepId: string) => {
      navigator.clipboard.writeText(text)
      setCopiedStep(stepId)
      setTimeout(() => setCopiedStep(null), 2000)
    }
  
    const toggleStepComplete = (stepId: string) => {
      const newCompleted = new Set(completedSteps)
      if (newCompleted.has(stepId)) {
        newCompleted.delete(stepId)
      } else {
        newCompleted.add(stepId)
      }
      setCompletedSteps(newCompleted)
    }

    const fullExampleCode = `from whispey import LivekitObserve
from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext
from livekit.plugins import openai, elevenlabs, silero
import os

# Initialize Whispey
whispey = LivekitObserve(
    agent_id="${agentId}",
    apikey=os.getenv("WHISPEY_API_KEY")
)

class MyAgent(Agent):
    def __init__(self):
        super().__init__(instructions="You are a helpful assistant")

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    # Create your LiveKit session
    session = AgentSession(
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=elevenlabs.TTS(),
        stt=openai.STT(),
        vad=silero.VAD.load()
    )
    
    # Start Whispey monitoring
    session_id = whispey.start_session(
        session=session,
        phone_number="+1234567890"
    )
    
    # Export data when session ends
    async def whispey_shutdown():
        await whispey.export(session_id)
    
    ctx.add_shutdown_callback(whispey_shutdown)
    
    # Start your agent
    await session.start(room=ctx.room, agent=MyAgent())

if __name__ == "__main__":
    agents.cli.run_app(entrypoint)`
  
    const steps = [
      {
        id: 'install',
        title: 'Install Whispey',
        subtitle: 'One command to get started',
        code: 'pip install whispey',
        icon: '📦'
      },
      {
        id: 'credentials',
        title: 'Your Agent Credentials',
        subtitle: 'Everything you need to get started',
        icon: '🔐',
        items: [
          { text: 'Workspace created with API key', status: 'done' },
          { text: `Your Agent ID: ${agentId}`, status: 'ready', copyable: agentId },
          { text: 'Use your Pype Project API key which you saved earlier', status: 'ready' }
        ]
      },
      {
        id: 'env',
        title: 'Environment Setup',
        subtitle: 'Put this in your .env file',
        code: `WHISPEY_API_KEY=your_whispey_api_key_here`,
        icon: '⚙️'
      },
      {
        id: 'integration',
        title: 'Integrate with LiveKit',
        subtitle: 'Add monitoring in just 3 simple steps',
        icon: '🚀',
        integrationSteps: [
          {
            title: '1. Import Whispey',
            code: `from whispey import LivekitObserve
import os`
          },
          {
            title: '2. Initialize Whispey',
            code: `whispey = LivekitObserve(
    agent_id="${agentId}",
    apikey=os.getenv("WHISPEY_API_KEY")
)`
          },
          {
            title: '3. Start Session Monitoring',
            code: `# After creating your LiveKit session
session_id = whispey.start_session(session=session)

# Add shutdown callback
async def whispey_shutdown():
    await whispey.export(session_id)
    
ctx.add_shutdown_callback(whispey_shutdown)`
          }
        ]
      }
    ]
  
    const completedCount = completedSteps.size
  
    return (
      <div className="h-full flex bg-gray-50">
        {/* Left Panel - Simple & Clean */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Get Your Agent Live
            </h1>
            <p className="text-sm text-gray-600">
              Transform your LiveKit sessions with intelligent voice monitoring in just 4 simple steps.
            </p>
          </div>
  
          {/* Progress */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Progress</span>
              <span className="text-sm font-medium text-purple-600">{completedCount}/{steps.length} completed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-700"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Complete all steps to activate your agent</p>
          </div>
  
          {/* Setup Steps */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Setup Steps</h3>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  completedSteps.has(step.id) 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    completedSteps.has(step.id)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {completedSteps.has(step.id) ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      completedSteps.has(step.id) ? 'text-green-700' : 'text-gray-900'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.subtitle}</p>
                  </div>
                  <div className="text-lg">{step.icon}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
  
        {/* Right Panel - Scrollable */}
        <div className="flex-1 w-full overflow-y-auto">
          <div className="p-8">
            <div className="space-y-8">
              {steps.map((step, index) => (
                <div key={step.id} className="bg-white rounded-xl border border-gray-200 p-6 relative">
                  {/* Completion Toggle */}
                  <button
                    onClick={() => toggleStepComplete(step.id)}
                    className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      completedSteps.has(step.id)
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    {completedSteps.has(step.id) && <Check className="w-3 h-3" />}
                  </button>
  
                  <div className="flex items-start gap-4">
                    {/* Icon & Number */}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white mb-2">
                        <span className="text-lg">{step.icon}</span>
                      </div>
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-700">
                        {index + 1}
                      </div>
                    </div>
  
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{step.title}</h3>
                      <p className="text-gray-600 text-sm mb-4">{step.subtitle}</p>
  
                      {/* Items */}
                      {step.items && (
                        <div className="space-y-2 mb-4">
                          {step.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                item.status === 'done' ? 'bg-green-500' :
                                item.status === 'ready' ? 'bg-blue-500' : 'bg-orange-500'
                              }`}>
                                {item.status === 'done' ? (
                                  <Check className="w-2 h-2 text-white" />
                                ) : item.status === 'ready' ? (
                                  <Key className="w-2 h-2 text-white" />
                                ) : (
                                  <Play className="w-2 h-2 text-white" />
                                )}
                              </div>
                              <span className="text-sm text-gray-700 flex-1">{item.text}</span>
                              {item.copyable && (
                                <button
                                  onClick={() => copyToClipboard(item.copyable, `${step.id}-${itemIndex}`)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {copiedStep === `${step.id}-${itemIndex}` ? (
                                    <Check className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Integration Steps - Broken Down */}
                      {step.integrationSteps && (
                        <div className="space-y-4 mb-6">
                          {step.integrationSteps.map((integrationStep, stepIndex) => (
                            <div key={stepIndex} className="border border-gray-100 rounded-lg p-4">
                              <h4 className="text-sm font-medium text-gray-900 mb-3">{integrationStep.title}</h4>
                              <div className="relative">
                                <div className="bg-gray-900 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex gap-1">
                                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    </div>
                                    <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                                  </div>
                                  <pre className="text-gray-100 text-xs font-mono overflow-x-auto">
                                    <code>{integrationStep.code}</code>
                                  </pre>
                                  <button
                                    onClick={() => copyToClipboard(integrationStep.code, `${step.id}-${stepIndex}`)}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                                  >
                                    {copiedStep === `${step.id}-${stepIndex}` ? (
                                      <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-gray-300" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Full Example Toggle */}
                          <div className="mt-6 border-t border-gray-100 pt-6">
                            <button
                              onClick={() => setExpandedExample(!expandedExample)}
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
                            >
                              {expandedExample ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              {expandedExample ? 'Hide' : 'Show'} Complete Example
                            </button>
                            
                            {expandedExample && (
                              <div className="relative">
                                <div className="bg-gray-900 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex gap-1">
                                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    </div>
                                    <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                                    <span className="text-xs text-gray-400 ml-2">complete_agent.py</span>
                                  </div>
                                  <pre className="text-gray-100 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                                    <code>{fullExampleCode}</code>
                                  </pre>
                                  <button
                                    onClick={() => copyToClipboard(fullExampleCode, 'full-example')}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                                  >
                                    {copiedStep === 'full-example' ? (
                                      <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-gray-300" />
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                  💡 This is a complete working example. Copy and modify for your needs.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
  
                      {/* Regular Code Block */}
                      {step.code && !step.integrationSteps && (
                        <div className="relative">
                          <div className="bg-gray-900 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              </div>
                              <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                            </div>
                            <pre className="text-gray-100 text-xs font-mono overflow-x-auto">
                              <code>{step.code}</code>
                            </pre>
                            <button
                              onClick={() => copyToClipboard(step.code!, step.id)}
                              className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                            >
                              {copiedStep === step.id ? (
                                <Check className="w-3 h-3 text-green-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-300" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  export default QuickStartGuide