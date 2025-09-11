import React, { useState } from 'react'
import { Copy, Terminal, ChevronDown, ChevronUp, Eye, AlertTriangle, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AdaptiveTutorialEmptyStateProps {
  searchQuery: string
  totalAgents: number
  onClearSearch: () => void
  onCreateAgent: () => void
}

// Complete agent code example - update this constant to change the code throughout the component
const COMPLETE_AGENT_CODE = `
import os
import logging
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.plugins import openai, elevenlabs, silero
from whispey import LivekitObserve

load_dotenv()

logger = logging.getLogger("simple-agent")

# Initialize Whispey
whispey = LivekitObserve(
    agent_id="agent_id_here",  # Replace with your actual agent ID
    apikey=os.getenv("WHISPEY_API_KEY") # Put this in .env file
)

class MyVoiceAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="You are a helpful voice assistant. Keep responses concise and friendly."
        )

    async def on_enter(self):
        # Generate initial reply when agent joins
        self.session.say("Hello! I'm here. How can I help you today?")

def prewarm(proc: JobProcess):
    # Preload VAD model for better performance
    proc.userdata["vad"] = silero.VAD.load()

async def entrypoint(ctx: JobContext):
    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        llm=openai.LLM(model="gpt-4o-mini"),
        stt=openai.STT(),  # Using OpenAI STT
        tts=elevenlabs.TTS(
            voice_id="eleven_labs_voice_id",  # Replace with your ElevenLabs voice ID
            model="eleven_flash_v2_5"
        ),
    )
    
    # Start Whispey monitoring
    session_id = whispey.start_session(
        session=session,
        phone_number="+1234567890"  # Optional data
    )
    
    # Export monitoring data when session ends
    async def whispey_shutdown():
        await whispey.export(session_id)
    
    ctx.add_shutdown_callback(whispey_shutdown)
    
    # Start the session
    await session.start(
        agent=MyVoiceAgent(),
        room=ctx.room
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
`;

const AdaptiveTutorialEmptyState: React.FC<AdaptiveTutorialEmptyStateProps> = ({
  searchQuery,
  totalAgents,
  onClearSearch,
  onCreateAgent
}) => {
  const [experienceLevel, setExperienceLevel] = useState<'unknown' | 'beginner' | 'experienced'>('unknown')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [expandedExample, setExpandedExample] = useState(false)
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set())

  const copyToClipboard = (text: string, codeId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(codeId)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const dismissNotice = (noticeId: string) => {
    setDismissedNotices(prev => new Set([...prev, noticeId]))
  }

  // No search results - same as before
  if (searchQuery && totalAgents > 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Eye className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
          No monitoring setups match your search criteria. Try adjusting your search terms.
        </p>
        <Button 
          variant="outline" 
          onClick={onClearSearch}
          className="border-gray-300 text-gray-700"
        >
          Clear Search
        </Button>
      </div>
    )
  }

  if (experienceLevel === 'unknown') {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="text-center py-8 px-8">
          <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Eye className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Start Monitoring Your Voice Agents
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-lg mx-auto">
            Add intelligent observability to your voice AI agents
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div 
              onClick={() => setExperienceLevel('beginner')}
              className="group p-8 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all transform hover:scale-105"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                <Terminal className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">New to LiveKit?</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                Complete walkthrough from installation to your first monitored voice agent
              </p>
              <div className="inline-flex items-center text-blue-600 font-medium text-sm group-hover:text-blue-700">
                Complete Tutorial
                <ChevronDown className="ml-2 h-4 w-4 rotate-[-90deg]" />
              </div>
            </div>
            
            <div 
              onClick={() => setExperienceLevel('experienced')}
              className="group p-8 border-2 border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50/50 cursor-pointer transition-all transform hover:scale-105"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Have Existing Agents?</h3>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                Quick integration guide to add monitoring to your current setup
              </p>
              <div className="inline-flex items-center text-green-600 font-medium text-sm group-hover:text-green-700">
                Quick Integration
                <ChevronDown className="ml-2 h-4 w-4 rotate-[-90deg]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Beginner tutorial
  if (experienceLevel === 'beginner') {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Complete LiveKit Agent Tutorial</h2>
              <p className="text-gray-600">Build your first voice AI agent with intelligent monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://youtu.be/1POj8h99xnE"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                Video tutorial
              </a>
              <Button 
                variant="outline" 
                onClick={() => setExperienceLevel('unknown')}
                className="text-gray-600"
              >
                ← Back
              </Button>
            </div>
          </div>

          {/* Important Notice about Agent ID - Dismissible */}
          {!dismissedNotices.has('beginner-agent-id') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 relative">
              <button
                onClick={() => dismissNotice('beginner-agent-id')}
                className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-700">
                    The <strong>agent_id</strong> should be replaced with your actual agent ID after you create 
                    a new agent. You'll get this ID when creating your monitoring configuration.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {/* Prerequisites */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">1. Prerequisites</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">Before we begin, make sure you have:</p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      Python 3.8+ installed on your system
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      API keys for your chosen LLM provider (OpenAI, etc.)
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      Text-to-speech service credentials (ElevenLabs, etc.)
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-red-700 font-medium">Your Whispey Project API key (saved when creating workspace)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Install LiveKit */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">2. Install LiveKit Agents Framework</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">First, install the LiveKit Agents framework and required plugins:</p>
                  <div className="relative">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                      </div>
                      <pre className="text-gray-100 text-sm font-mono">
{`pip install livekit-agents
pip install livekit-plugins-openai
pip install livekit-plugins-elevenlabs
pip install livekit-plugins-silero`}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(`pip install livekit-agents
pip install livekit-plugins-openai
pip install livekit-plugins-elevenlabs
pip install livekit-plugins-silero`, 'install-livekit')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'install-livekit' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Install Whispey */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">3. Install Whispey for Monitoring</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">Install Whispey to add observability to your agents:</p>
                  <div className="relative">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                      </div>
                      <pre className="text-gray-100 text-sm font-mono">pip install whispey</pre>
                      <button
                        onClick={() => copyToClipboard('pip install whispey', 'install-whispey')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'install-whispey' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Example */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">4. Complete Monitored Agent Example</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">Here's a complete working example of a LiveKit agent with Whispey monitoring:</p>
                  <div className="relative">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                        <span className="text-xs text-gray-400 ml-2">agent.py</span>
                      </div>
                      <pre className="text-gray-100 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                        {COMPLETE_AGENT_CODE}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(COMPLETE_AGENT_CODE, 'complete-example')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'complete-example' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Environment Setup */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">5. Environment Setup</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">Create a .env file with your API keys:</p>
                  
                  {/* Important notice about API key - Dismissible */}
                  {!dismissedNotices.has('beginner-api-key') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 relative">
                      <button
                        onClick={() => dismissNotice('beginner-api-key')}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-start gap-3 pr-8">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-red-800 mb-1">
                            Important: Use Your Saved API Key
                          </h4>
                          <p className="text-sm text-red-700">
                            For <strong>WHISPEY_API_KEY</strong>, use the Whispey Project API key you saved when creating your workspace. 
                            You'll need this to connect your agent monitoring to this dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                        <span className="text-xs text-gray-400 ml-2">.env</span>
                      </div>
                      <pre className="text-gray-100 text-sm font-mono">
{`# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API Key
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Whispey Project API Key (use the one you saved when creating workspace)
WHISPEY_API_KEY=your_whispey_project_api_key_here

# LiveKit credentials (if using LiveKit Cloud)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret`}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(`# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API Key
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Whispey Project API Key (use the one you saved when creating workspace)
WHISPEY_API_KEY=your_whispey_project_api_key_here

# LiveKit credentials (if using LiveKit Cloud)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret`, 'environment')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'environment' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Run Agent */}
            <div className="border-l-2 border-gray-100 pl-6 relative">
              <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">6. Run Your Monitored Agent</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">Start your agent with monitoring:</p>
                  <div className="relative">
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                      </div>
                      <pre className="text-gray-100 text-sm font-mono">python agent.py dev</pre>
                      <button
                        onClick={() => copyToClipboard('python agent.py dev', 'run-agent')}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'run-agent' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Your agent will start and Whispey will automatically monitor all conversations and interactions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Once your agent is running, click below to set up monitoring in this dashboard:
              </p>
              <Button 
                onClick={onCreateAgent}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Set Up Monitoring Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Experienced users - quick integration
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Quick Integration Guide</h2>
            <p className="text-gray-600">Add Whispey monitoring to your existing LiveKit agents</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://youtu.be/1POj8h99xnE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Video tutorial
            </a>
            <Button 
              variant="outline" 
              onClick={() => setExperienceLevel('unknown')}
              className="text-gray-600"
            >
              ← Back
            </Button>
          </div>
        </div>

        {/* Agent ID Notice - Dismissible */}
        {!dismissedNotices.has('experienced-agent-id') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 relative">
            <button
              onClick={() => dismissNotice('experienced-agent-id')}
              className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-700">
                  You'll get your unique agent ID after completing the "Configure Monitoring Dashboard" step below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Key Notice - Dismissible */}
        {!dismissedNotices.has('experienced-api-key') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 relative">
            <button
              onClick={() => dismissNotice('experienced-api-key')}
              className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  Important: Use Your Saved API Key
                </h4>
                <p className="text-sm text-red-700">
                  Use the Whispey Project API key you saved when creating your workspace for the <strong>WHISPEY_API_KEY</strong> environment variable.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">1. Install Whispey</h3>
            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-3">
                <pre className="text-gray-100 text-sm font-mono">pip install whispey</pre>
                <button
                  onClick={() => copyToClipboard('pip install whispey', 'quick-install')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-install' ? (
                    <div className="w-3 h-3 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-3 h-3 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">2. Import & Initialize</h3>
            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-3">
                <pre className="text-gray-100 text-xs font-mono">
{`from whispey import LivekitObserve

whispey = LivekitObserve(
    agent_id="YOUR_AGENT_ID_HERE",
    apikey=os.getenv("WHISPEY_API_KEY")
)`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`from whispey import LivekitObserve

whispey = LivekitObserve(
    agent_id="YOUR_AGENT_ID_HERE",
    apikey=os.getenv("WHISPEY_API_KEY")
)`, 'quick-init')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-init' ? (
                    <div className="w-3 h-3 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-3 h-3 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">3. Add to Session</h3>
            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-3">
                <pre className="text-gray-100 text-xs font-mono">
{`# After session creation
session_id = whispey.start_session(session)

# Add shutdown callback
async def shutdown():
    await whispey.export(session_id)
ctx.add_shutdown_callback(shutdown)`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`# After session creation
session_id = whispey.start_session(session)

# Add shutdown callback  
async def shutdown():
    await whispey.export(session_id)
ctx.add_shutdown_callback(shutdown)`, 'quick-session')}
                  className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-session' ? (
                    <div className="w-3 h-3 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-3 h-3 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Complete Integration Example</h4>
            <button
              onClick={() => setExpandedExample(!expandedExample)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
            >
              {expandedExample ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expandedExample ? 'Hide' : 'Show'} Full Code
            </button>
          </div>
          
          {expandedExample && (
            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  </div>
                  <Terminal className="w-3 h-3 text-gray-400 ml-1" />
                  <span className="text-xs text-gray-400 ml-2">your_agent.py</span>
                </div>
                <pre className="text-gray-100 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto">
                    {COMPLETE_AGENT_CODE}
                </pre>
                <button
                  onClick={() => copyToClipboard(`${COMPLETE_AGENT_CODE}`, 'full-integration')}
                  className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'full-integration' ? (
                    <div className="w-3 h-3 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-3 h-3 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Once you've added monitoring to your agent, set up the dashboard:
          </p>
          <Button 
            onClick={onCreateAgent}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Eye className="w-4 h-4 mr-2" />
            Configure Monitoring Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdaptiveTutorialEmptyState