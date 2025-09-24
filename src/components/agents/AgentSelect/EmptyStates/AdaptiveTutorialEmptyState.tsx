import React, { useState } from 'react'
import { Copy, Terminal, ChevronDown, ChevronUp, Eye, AlertTriangle, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMobile } from '@/hooks/use-mobile'

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
  const { isMobile } = useMobile(768)

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
      <div className={`text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 ${isMobile ? 'px-4' : ''}`}>
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Eye className="h-6 w-6 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">No Results Found</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
          No monitoring setups match your search criteria.
        </p>
        <Button 
          variant="outline" 
          onClick={onClearSearch}
          size="sm"
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        >
          Clear Search
        </Button>
      </div>
    )
  }

  if (experienceLevel === 'unknown') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className={`text-center py-6 ${isMobile ? 'px-4' : 'px-6'}`}>
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Eye className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className={`font-semibold text-gray-900 dark:text-gray-100 mb-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
            Start Monitoring Your Voice Agents
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-lg mx-auto">
            Add intelligent observability to your voice AI agents
          </p>
          
          <div className={`${isMobile ? 'space-y-3' : 'grid md:grid-cols-2 gap-4'} max-w-4xl mx-auto`}>
            <div 
              onClick={() => setExperienceLevel('beginner')}
              className="group p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-all"
            >
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">New to LiveKit?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3 text-xs leading-relaxed">
                Complete walkthrough from installation to your first monitored voice agent
              </p>
              <div className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium text-xs">
                Complete Tutorial
                <ChevronDown className="ml-1 h-3 w-3 rotate-[-90deg]" />
              </div>
            </div>
            
            <div 
              onClick={() => setExperienceLevel('experienced')}
              className="group p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-900/10 cursor-pointer transition-all"
            >
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Have Existing Agents?</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-3 text-xs leading-relaxed">
                Quick integration guide to add monitoring to your current setup
              </p>
              <div className="inline-flex items-center text-green-600 dark:text-green-400 font-medium text-xs">
                Quick Integration
                <ChevronDown className="ml-1 h-3 w-3 rotate-[-90deg]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Beginner tutorial - Mobile optimized
  if (experienceLevel === 'beginner') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className={isMobile ? 'p-4' : 'p-6'}>
          <div className={`flex items-center justify-between mb-4 ${isMobile ? 'flex-col gap-3' : ''}`}>
            <div className={isMobile ? 'text-center' : ''}>
              <h2 className={`font-semibold text-gray-900 dark:text-gray-100 mb-1 ${isMobile ? 'text-base' : 'text-lg'}`}>
                Complete LiveKit Agent Tutorial
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Build your first voice AI agent with monitoring</p>
            </div>
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-col w-full' : ''}`}>
              <a
                href="https://youtu.be/1POj8h99xnE"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-2 py-1.5 rounded-lg transition-all ${isMobile ? 'w-full justify-center' : ''}`}
              >
                <Play className="w-3 h-3" />
                Video tutorial
              </a>
              <Button 
                variant="outline" 
                onClick={() => setExperienceLevel('unknown')}
                size="sm"
                className={`text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 text-xs ${isMobile ? 'w-full' : ''}`}
              >
                ← Back
              </Button>
            </div>
          </div>

          {/* Important Notice - More compact on mobile */}
          {!dismissedNotices.has('beginner-agent-id') && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 relative">
              <button
                onClick={() => dismissNotice('beginner-agent-id')}
                className="absolute top-2 right-2 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="flex items-start gap-2 pr-6">
                <Eye className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  The <strong>agent_id</strong> will be provided after you create monitoring below.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Condensed Steps for Mobile */}
            <div className="space-y-3">
              {/* Step 1 - Prerequisites */}
              <div className={`border-l-2 border-gray-200 dark:border-gray-700 pl-3 ${isMobile ? '' : 'pl-4'}`}>
                <div className="absolute -ml-5 mt-0.5 w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">1. Prerequisites</h3>
                {isMobile ? (
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p>• Python 3.8+ installed</p>
                    <p>• OpenAI/LLM API keys</p>
                    <p>• TTS service credentials</p>
                    <p className="text-red-600 dark:text-red-400 font-medium">• Your Whispey Project API key</p>
                  </div>
                ) : (
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-1.5">
                      <div className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      Python 3.8+ installed on your system
                    </li>
                    <li className="flex items-start gap-1.5">
                      <div className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      API keys for your chosen LLM provider (OpenAI, etc.)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <div className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      Text-to-speech service credentials (ElevenLabs, etc.)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <div className="w-1 h-1 bg-red-500 dark:bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-red-700 dark:text-red-400 font-medium">Your Whispey Project API key</span>
                    </li>
                  </ul>
                )}
              </div>

              {/* Step 2 - Install LiveKit */}
              <div className={`border-l-2 border-gray-200 dark:border-gray-700 pl-3 ${isMobile ? '' : 'pl-4'} relative`}>
                <div className="absolute -ml-5 mt-0.5 w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">2. Install LiveKit</h3>
                <div className="relative">
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2.5">
                    <pre className={`text-gray-100 font-mono ${isMobile ? 'text-xs' : 'text-sm'}`}>
{isMobile ? 
`pip install livekit-agents livekit-plugins-openai
livekit-plugins-elevenlabs livekit-plugins-silero` :
`pip install livekit-agents
pip install livekit-plugins-openai
pip install livekit-plugins-elevenlabs
pip install livekit-plugins-silero`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(`pip install livekit-agents livekit-plugins-openai livekit-plugins-elevenlabs livekit-plugins-silero`, 'install-livekit')}
                      className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                    >
                      {copiedCode === 'install-livekit' ? (
                        <div className="w-3 h-3 text-green-400">✓</div>
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 - Install Whispey */}
              <div className={`border-l-2 border-gray-200 dark:border-gray-700 pl-3 ${isMobile ? '' : 'pl-4'} relative`}>
                <div className="absolute -ml-5 mt-0.5 w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">3. Install Whispey</h3>
                <div className="relative">
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2.5">
                    <pre className={`text-gray-100 font-mono ${isMobile ? 'text-xs' : 'text-sm'}`}>pip install whispey</pre>
                    <button
                      onClick={() => copyToClipboard('pip install whispey', 'install-whispey')}
                      className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                    >
                      {copiedCode === 'install-whispey' ? (
                        <div className="w-3 h-3 text-green-400">✓</div>
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-gray-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4 - Code Example (Expandable on mobile) */}
              <div className={`border-l-2 border-gray-200 dark:border-gray-700 pl-3 ${isMobile ? '' : 'pl-4'} relative`}>
                <div className="absolute -ml-5 mt-0.5 w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">4. Complete Example</h3>
                  {isMobile && (
                    <button
                      onClick={() => setExpandedExample(!expandedExample)}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
                    >
                      {expandedExample ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {expandedExample ? 'Hide' : 'Show'} Code
                    </button>
                  )}
                </div>
                
                {(!isMobile || expandedExample) && (
                  <div className="relative">
                    <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="flex gap-0.5">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                        </div>
                        <Terminal className="w-2.5 h-2.5 text-gray-400" />
                        <span className="text-xs text-gray-400">agent.py</span>
                      </div>
                      <pre className={`text-gray-100 font-mono overflow-x-auto ${isMobile ? 'text-xs max-h-48' : 'text-xs max-h-64'} overflow-y-auto`}>
                        {COMPLETE_AGENT_CODE}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(COMPLETE_AGENT_CODE, 'complete-example')}
                        className="absolute top-2 right-2 p-1 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        {copiedCode === 'complete-example' ? (
                          <div className="w-3 h-3 text-green-400">✓</div>
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-gray-300" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
                Ready to set up monitoring for your agent?
              </p>
              <Button 
                onClick={onCreateAgent}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Set Up Monitoring Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Experienced users - Mobile optimized
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className={isMobile ? 'p-4' : 'p-6'}>
        <div className={`flex items-center justify-between mb-4 ${isMobile ? 'flex-col gap-3' : ''}`}>
          <div className={isMobile ? 'text-center' : ''}>
            <h2 className={`font-semibold text-gray-900 dark:text-gray-100 mb-1 ${isMobile ? 'text-base' : 'text-lg'}`}>
              Quick Integration Guide
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Add Whispey monitoring to existing agents</p>
          </div>
          <div className={`flex items-center gap-2 ${isMobile ? 'flex-col w-full' : ''}`}>
            <a
              href="https://youtu.be/1POj8h99xnE"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-2 py-1.5 rounded-lg transition-all ${isMobile ? 'w-full justify-center' : ''}`}
            >
              <Play className="w-3 h-3" />
              Video tutorial
            </a>
            <Button 
              variant="outline" 
              onClick={() => setExperienceLevel('unknown')}
              size="sm"
              className={`text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 text-xs ${isMobile ? 'w-full' : ''}`}
            >
              ← Back
            </Button>
          </div>
        </div>

        {/* Quick steps - Stack vertically on mobile */}
        <div className={`${isMobile ? 'space-y-4' : 'grid md:grid-cols-3 gap-4'} mb-4`}>
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">1. Install Whispey</h3>
            <div className="relative">
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2">
                <pre className="text-gray-100 text-xs font-mono">pip install whispey</pre>
                <button
                  onClick={() => copyToClipboard('pip install whispey', 'quick-install')}
                  className="absolute top-1.5 right-1.5 p-0.5 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-install' ? (
                    <div className="w-2.5 h-2.5 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">2. Import & Initialize</h3>
            <div className="relative">
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2">
                <pre className="text-gray-100 text-xs font-mono">
{`from whispey import LivekitObserve

whispey = LivekitObserve(
    agent_id="YOUR_AGENT_ID",
    apikey=os.getenv("WHISPEY_API_KEY")
)`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`from whispey import LivekitObserve\n\nwhispey = LivekitObserve(\n    agent_id="YOUR_AGENT_ID",\n    apikey=os.getenv("WHISPEY_API_KEY")\n)`, 'quick-init')}
                  className="absolute top-1.5 right-1.5 p-0.5 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-init' ? (
                    <div className="w-2.5 h-2.5 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">3. Add to Session</h3>
            <div className="relative">
              <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-2">
                <pre className="text-gray-100 text-xs font-mono">
{`session_id = whispey.start_session(session)

async def shutdown():
    await whispey.export(session_id)
ctx.add_shutdown_callback(shutdown)`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`session_id = whispey.start_session(session)\n\nasync def shutdown():\n    await whispey.export(session_id)\nctx.add_shutdown_callback(shutdown)`, 'quick-session')}
                  className="absolute top-1.5 right-1.5 p-0.5 bg-gray-800 hover:bg-gray-700 rounded"
                >
                  {copiedCode === 'quick-session' ? (
                    <div className="w-2.5 h-2.5 text-green-400">✓</div>
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-gray-300" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
            Ready to configure your monitoring dashboard?
          </p>
          <Button 
            onClick={onCreateAgent}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Configure Monitoring Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdaptiveTutorialEmptyState