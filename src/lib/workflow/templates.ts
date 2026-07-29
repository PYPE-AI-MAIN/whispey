import { parseWorkflow, type Workflow } from './schema'

// Every workflow agent needs a working voice out of the box — the ElevenLabs
// plugin's built-in default voice isn't available on every account.
const DEFAULT_TTS = { name: 'elevenlabs', voice_id: 'EXAVITQu4vr4xnSDxMaL' }

export interface WorkflowTemplate {
  id: string
  label: string
  description: string
  build: (agentName: string) => Workflow
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Just a greeting and an end call — build the rest yourself.',
    build: (name) =>
      parseWorkflow({
        metadata: { name },
        agent: { tts: DEFAULT_TTS },
        transports: { web: { enabled: true } },
        start: 'greeting',
        nodes: [
          { id: 'greeting', type: 'conversation', name: 'Greeting', position: { x: 120, y: 100 }, prompt: 'Greet the caller and ask how you can help.' },
          { id: 'end', type: 'ending', name: 'End call', position: { x: 120, y: 340 }, message: 'Thanks for calling — goodbye!' },
        ],
        edges: [{ id: 'e1', source: 'greeting', target: 'end' }],
      }),
  },
  {
    id: 'appointment-booking',
    label: 'Appointment Booking',
    description: 'Greets the caller, collects their name and a date/time, then confirms.',
    build: (name) =>
      parseWorkflow({
        metadata: { name },
        agent: { tts: DEFAULT_TTS },
        transports: { web: { enabled: true } },
        start: 'greeting',
        nodes: [
          { id: 'greeting', type: 'conversation', name: 'Greeting', position: { x: 100, y: 60 }, prompt: 'Greet the caller warmly and ask if they would like to book an appointment.' },
          { id: 'get_name', type: 'extract_variable', name: 'Get name', position: { x: 100, y: 220 }, prompt: "Ask for the caller's full name.", extractions: [{ variable: 'caller_name', type: 'string', description: "the caller's full name" }] },
          { id: 'get_datetime', type: 'extract_variable', name: 'Get date & time', position: { x: 100, y: 380 }, prompt: 'Ask what date and time they would like to come in.', extractions: [{ variable: 'appointment_date', type: 'string', description: 'the requested date' }, { variable: 'appointment_time', type: 'string', description: 'the requested time' }] },
          { id: 'confirm', type: 'conversation', name: 'Confirm', position: { x: 100, y: 540 }, prompt: 'Confirm the appointment for {{caller_name}} on {{appointment_date}} at {{appointment_time}}, then thank them.' },
          { id: 'end', type: 'ending', name: 'End call', position: { x: 100, y: 700 }, message: 'Thanks for booking with us — goodbye!' },
        ],
        edges: [
          { id: 'e1', source: 'greeting', target: 'get_name' },
          { id: 'e2', source: 'get_name', target: 'get_datetime' },
          { id: 'e3', source: 'get_datetime', target: 'confirm' },
          { id: 'e4', source: 'confirm', target: 'end' },
        ],
      }),
  },
  {
    id: 'faq-bot',
    label: 'FAQ / Support',
    description: 'Looks up an answer in your knowledge base and escalates when it can\'t help.',
    build: (name) =>
      parseWorkflow({
        metadata: { name },
        agent: { tts: DEFAULT_TTS },
        transports: { web: { enabled: true } },
        start: 'greeting',
        nodes: [
          { id: 'greeting', type: 'conversation', name: 'Greeting', position: { x: 100, y: 60 }, prompt: 'Greet the caller and ask what they need help with.' },
          { id: 'lookup', type: 'knowledge', name: 'Look up answer', position: { x: 100, y: 220 }, topK: 4, saveAs: 'kb_context' },
          { id: 'answer', type: 'conversation', name: 'Answer', position: { x: 100, y: 380 }, prompt: 'Using {{kb_context}}, answer the caller\'s question. If you are not sure, let them know you\'ll have someone follow up.' },
          // A real phone transfer needs the telephony transport enabled and a
          // real destination — neither makes sense to pre-fill in a template,
          // so escalation here is a soft hand-off. Swap this node for a
          // call_transfer node once you've enabled telephony and have a number.
          { id: 'escalate', type: 'conversation', name: 'Escalate', position: { x: 400, y: 540 }, prompt: 'Let them know a team member will follow up with them directly, then say goodbye.', skipUserResponse: true },
          { id: 'end', type: 'ending', name: 'End call', position: { x: 100, y: 540 }, message: 'Glad I could help — goodbye!' },
        ],
        edges: [
          { id: 'e1', source: 'greeting', target: 'lookup' },
          { id: 'e2', source: 'lookup', target: 'answer' },
          { id: 'e3', source: 'answer', target: 'lookup', kind: 'condition', condition: 'the caller has another question' },
          { id: 'e4', source: 'answer', target: 'escalate', kind: 'condition', condition: 'the caller wants to talk to a human, or you cannot answer' },
          { id: 'e5', source: 'answer', target: 'end', kind: 'fallback' },
          { id: 'e6', source: 'escalate', target: 'end' },
        ],
      }),
  },
  {
    id: 'lead-qualification',
    label: 'Lead Qualification',
    description: 'Collects budget/timeline, then routes $5k+ budgets to a specialist, everyone else to self-serve.',
    build: (name) =>
      parseWorkflow({
        metadata: { name },
        agent: { tts: DEFAULT_TTS },
        transports: { web: { enabled: true } },
        start: 'greeting',
        nodes: [
          { id: 'greeting', type: 'conversation', name: 'Greeting', position: { x: 140, y: 60 }, prompt: 'Greet the caller and ask what they are looking for.' },
          { id: 'qualify', type: 'extract_variable', name: 'Qualify', position: { x: 140, y: 220 }, prompt: 'Find out their budget in dollars and timeline.', extractions: [{ variable: 'budget', type: 'number', description: 'their budget in dollars, as a plain number' }, { variable: 'timeline', type: 'string', description: 'when they want to get started' }] },
          { id: 'route', type: 'logic_split', name: 'Route', position: { x: 140, y: 380 } },
          { id: 'high_value', type: 'conversation', name: 'Hand off', position: { x: 0, y: 540 }, prompt: 'Let them know a specialist will follow up with them shortly.', skipUserResponse: true },
          { id: 'self_serve', type: 'conversation', name: 'Self-serve', position: { x: 300, y: 540 }, prompt: 'Point them to the self-serve signup link and explain next steps.', skipUserResponse: true },
          { id: 'end', type: 'ending', name: 'End call', position: { x: 140, y: 700 }, message: 'Thanks for calling — goodbye!' },
        ],
        edges: [
          { id: 'e1', source: 'greeting', target: 'qualify' },
          { id: 'e2', source: 'qualify', target: 'route' },
          { id: 'e3', source: 'route', target: 'high_value', kind: 'logic', expression: 'budget >= 5000' },
          { id: 'e4', source: 'route', target: 'self_serve', kind: 'fallback' },
          { id: 'e5', source: 'high_value', target: 'end' },
          { id: 'e6', source: 'self_serve', target: 'end' },
        ],
      }),
  },
]
