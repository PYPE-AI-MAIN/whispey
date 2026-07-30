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
  {
    id: 'ortho-triage',
    label: 'Ortho Triage',
    description: 'Pre-visit triage call: greeting, demographics, complaint, history, allergies, deterministic routing to 8 imaging pathways, checklist, closing.',
    build: (name) =>
      parseWorkflow({
        metadata: { name, description: 'Superhealth orthopaedic pre-visit triage — collects patient info, routes to the right imaging plan, and delivers a pre-appointment checklist.' },
        agent: {
          globalPrompt: 'You are Anjali, a warm, concise voice assistant making a pre-visit triage call for Superhealth, an orthopaedic clinic. Your job is to note some details so the clinic can prepare the right tests before the visit. You speak natural, simple English.\n\nCONVERSATION FLOW: this is ONE continuous call. The opening greeting happens ONCE — never greet again. Use the patient\'s name sparingly. Acknowledge briefly ("okay", "got it", "thanks") and keep moving. One question at a time. Never use filler like "Great!"/"Absolutely!"/"Certainly!" — say "Got it."/"Noted."/"I understand." instead.\n\nTALK TO A PATIENT, NOT A DOCTOR: use simple everyday words, never clinical jargon.\n\nHARD RULES:\n- ONE CAPTURE TOOL PER TURN.\n- Never state, guess, or assume any detail the caller hasn\'t told you in THIS call.\n- Never ask for information already given, even in passing.',
          llm: { name: 'openai', model: 'gpt-4o', temperature: 0.2 },
          stt: { name: 'deepgram', model: 'nova-2', language: 'en' },
          tts: DEFAULT_TTS,
          vad: { name: 'silero', min_silence_duration: 0.4 },
        },
        transports: { web: { enabled: true } },
        variables: [
          { key: 'patient_name', type: 'string', default: 'there' },
          { key: 'doctor_name', type: 'string', default: 'your doctor' },
          { key: 'age', type: 'number' },
          { key: 'gender', type: 'string' },
          { key: 'height_cm', type: 'number' },
          { key: 'weight_kg', type: 'number' },
          { key: 'primary_site', type: 'string', description: 'knee | shoulder | spine | general' },
          { key: 'duration', type: 'string' },
          { key: 'pain_score', type: 'number' },
          { key: 'side', type: 'string', description: 'left | right | both | unknown' },
          { key: 'spine_region', type: 'string', description: 'neck | back | unknown' },
          { key: 'comorbidities', type: 'string' },
          { key: 'bone_health', type: 'string' },
          { key: 'prior_surgery', type: 'string' },
          { key: 'drug_allergies', type: 'string' },
          { key: 'contrast_latex', type: 'string', description: 'yes | no | unknown' },
          { key: 'answer_class', type: 'string' },
        ],
        start: 'greeting',
        nodes: [
          // ── intake ──
          { id: 'greeting', type: 'conversation', name: 'Greeting & consent', position: { x: 300, y: 0 },
            staticText: 'Hi {{patient_name}}, I\'m calling from Superhealth Hospital. You have an upcoming appointment with Doctor {{doctor_name}}. I\'d like to take a few minutes to note down some details so we can prepare the right tests before your visit. Is now a good time to talk?',
            prompt: 'Evaluate the patient\'s response: 1) NOT INTERESTED -> end cleanly. 2) WRONG NUMBER -> end politely. 3) BAD TIME -> note callback. 4) READY -> proceed.' },
          { id: 'demographics', type: 'extract_variable', name: 'Demographics', position: { x: 300, y: 200 },
            prompt: 'Collect in plain friendly questions: age and gender, then approximate height, then approximate weight. Accept any unit and convert silently to metric.',
            extractions: [
              { variable: 'age', type: 'number', description: 'years' },
              { variable: 'gender', type: 'string' },
              { variable: 'height_cm', type: 'number', description: 'converted to centimetres' },
              { variable: 'weight_kg', type: 'number', description: 'converted to kilograms' },
            ] },
          { id: 'complaint', type: 'extract_variable', name: 'Chief complaint', position: { x: 300, y: 400 },
            prompt: 'Find the MAIN area (knee, shoulder, spine, or general). Ask how long, then pain 0-10. For knee/shoulder ask which side. For spine ask neck or back.',
            extractions: [
              { variable: 'primary_site', type: 'string', description: 'knee | shoulder | spine | general' },
              { variable: 'duration', type: 'string', description: 'acute | subacute | chronic | unknown' },
              { variable: 'pain_score', type: 'number', description: '0-10' },
              { variable: 'side', type: 'string', description: 'left | right | both | unknown' },
              { variable: 'spine_region', type: 'string', description: 'neck | back | unknown' },
            ] },
          { id: 'history', type: 'extract_variable', name: 'Medical history', position: { x: 300, y: 600 },
            prompt: 'Ask: 1) any ongoing health problems 2) weak/thinning bones 3) any past bone/joint/spine surgery.',
            extractions: [
              { variable: 'comorbidities', type: 'string', description: 'comma list, or none' },
              { variable: 'bone_health', type: 'string' },
              { variable: 'prior_surgery', type: 'string' },
            ] },
          { id: 'allergies', type: 'extract_variable', name: 'Allergies', position: { x: 300, y: 800 },
            prompt: 'Ask: 1) allergic to any medicines, especially painkillers 2) bad reaction to scan dye, iodine, or latex.',
            extractions: [
              { variable: 'drug_allergies', type: 'string' },
              { variable: 'contrast_latex', type: 'string', description: 'yes | no | unknown' },
            ] },
          { id: 'routing', type: 'extract_variable', name: 'Classify pathway', position: { x: 300, y: 1000 },
            prompt: 'Ask the ONE classification question for {{primary_site}}: knee->sudden/gradual, shoulder->stiff/pain, spine->radiating/local, general->focal/widespread.',
            extractions: [{ variable: 'answer_class', type: 'string' }] },

          // ── deterministic router ──
          { id: 'route_split', type: 'logic_split', name: 'Pathway router', position: { x: 300, y: 1200 } },

          // ── imaging plans (spread horizontally) ──
          { id: 'plan_mri_knee', type: 'conversation', name: 'Plan: MRI knee', position: { x: -300, y: 1400 },
            staticText: 'Got it. Our team will arrange an MRI of your knee before your visit. Please rest the knee and use a brace if you have one. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_xray_knee', type: 'conversation', name: 'Plan: X-ray knee', position: { x: -100, y: 1400 },
            staticText: 'Got it. Our team will arrange an X-ray of your knees before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_xray_shoulder', type: 'conversation', name: 'Plan: X-ray shoulder', position: { x: 100, y: 1400 },
            staticText: 'Got it. Our team will arrange a shoulder X-ray before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_mri_shoulder', type: 'conversation', name: 'Plan: MRI shoulder', position: { x: 300, y: 1400 },
            staticText: 'Got it. Our team will arrange the right shoulder imaging before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_mri_spine', type: 'conversation', name: 'Plan: MRI spine', position: { x: 500, y: 1400 },
            staticText: 'Got it. Our team will arrange an MRI of your spine before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_xray_spine', type: 'conversation', name: 'Plan: X-ray spine', position: { x: 700, y: 1400 },
            staticText: 'Got it. Our team will arrange a spine X-ray before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_none', type: 'conversation', name: 'Plan: doctor assesses', position: { x: 900, y: 1400 },
            staticText: 'Got it. The doctor will assess this in detail during your visit and arrange any tests at that point. Does that sound okay?' },
          { id: 'plan_labs', type: 'conversation', name: 'Plan: routine labs', position: { x: 1100, y: 1400 },
            staticText: 'Got it. Our team will arrange some routine blood tests before your visit. Someone will call you back to confirm the booking. Does that sound okay?' },
          { id: 'plan_review', type: 'conversation', name: 'Plan: safety review', position: { x: 300, y: 1600 },
            staticText: 'Got it. Because of what you shared, our team will confirm the safest test for you and call you back to arrange it. Does that sound okay?' },

          // ── closing ──
          { id: 'checklist', type: 'conversation', name: 'Checklist + closing', position: { x: 300, y: 1800 },
            staticText: 'Before your appointment, please bring your Unique Health ID and insurance details; any old X-rays or MRI reports; a list of your current medications; and records of any previous surgeries. We\'ll also send you a short form by SMS. Thank you for your time, {{patient_name}}. We look forward to seeing you at Superhealth Hospital. Have a good day!',
            skipUserResponse: true },
          { id: 'closing', type: 'ending', name: 'End: triage complete', position: { x: 300, y: 2000 } },

          // ── escape endings ──
          { id: 'declined_end', type: 'ending', name: 'End: declined', position: { x: 0, y: 100 }, message: 'No problem at all. Have a good day!' },
          { id: 'wrong_number_end', type: 'ending', name: 'End: wrong number', position: { x: 600, y: 100 }, message: 'Apologies for the disturbance, have a good day.' },
          { id: 'callback_end', type: 'ending', name: 'End: callback', position: { x: -200, y: 100 }, message: 'No problem. Our team will call you back then. Have a good day!' },
          { id: 'emergency_end', type: 'ending', name: 'End: emergency', position: { x: 800, y: 400 }, message: 'This sounds urgent — please call 108 or go to your nearest emergency department right away.' },
          { id: 'human_end', type: 'ending', name: 'End: needs human', position: { x: -200, y: 400 }, message: 'I\'ve noted this, and the team will call you back soon. Have a good day!' },
        ],
        edges: [
          // greeting escape hatches
          { id: 'g1', source: 'greeting', target: 'declined_end', kind: 'condition', condition: 'the caller refuses or is not interested' },
          { id: 'g2', source: 'greeting', target: 'wrong_number_end', kind: 'condition', condition: 'wrong number or not the patient' },
          { id: 'g3', source: 'greeting', target: 'callback_end', kind: 'condition', condition: 'bad time or wants a callback' },
          { id: 'g4', source: 'greeting', target: 'emergency_end', kind: 'condition', condition: 'describes an active medical crisis happening right now' },
          { id: 'g5', source: 'greeting', target: 'human_end', kind: 'condition', condition: 'literally asks for a human, real person, or agent' },
          { id: 'g6', source: 'greeting', target: 'demographics', kind: 'condition', condition: 'agrees to proceed' },
          // linear intake
          { id: 'd1', source: 'demographics', target: 'complaint', kind: 'always' },
          { id: 'c1', source: 'complaint', target: 'history', kind: 'always' },
          { id: 'c2', source: 'complaint', target: 'emergency_end', kind: 'condition', condition: 'describes an active medical crisis happening right now' },
          { id: 'h1', source: 'history', target: 'allergies', kind: 'always' },
          { id: 'a1', source: 'allergies', target: 'routing', kind: 'always' },
          { id: 'r1', source: 'routing', target: 'route_split', kind: 'always' },
          // deterministic routing — 8 pathways
          { id: 's1', source: 'route_split', target: 'plan_mri_knee', kind: 'logic', expression: "primary_site == 'knee' && answer_class == 'sudden'" },
          { id: 's2', source: 'route_split', target: 'plan_xray_knee', kind: 'logic', expression: "primary_site == 'knee' && answer_class == 'gradual'" },
          { id: 's3', source: 'route_split', target: 'plan_xray_shoulder', kind: 'logic', expression: "primary_site == 'shoulder' && answer_class == 'stiff'" },
          { id: 's4', source: 'route_split', target: 'plan_mri_shoulder', kind: 'logic', expression: "primary_site == 'shoulder' && answer_class == 'pain'" },
          { id: 's5', source: 'route_split', target: 'plan_mri_spine', kind: 'logic', expression: "primary_site == 'spine' && answer_class == 'radiating'" },
          { id: 's6', source: 'route_split', target: 'plan_xray_spine', kind: 'logic', expression: "primary_site == 'spine' && answer_class == 'local'" },
          { id: 's7', source: 'route_split', target: 'plan_none', kind: 'logic', expression: "primary_site == 'general' && answer_class == 'focal'" },
          { id: 's8', source: 'route_split', target: 'plan_labs', kind: 'logic', expression: "primary_site == 'general' && answer_class == 'widespread'" },
          { id: 's9', source: 'route_split', target: 'plan_review', kind: 'fallback' },
          // all plans converge to checklist
          { id: 'p1', source: 'plan_mri_knee', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p2', source: 'plan_xray_knee', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p3', source: 'plan_xray_shoulder', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p4', source: 'plan_mri_shoulder', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p5', source: 'plan_mri_spine', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p6', source: 'plan_xray_spine', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p7', source: 'plan_none', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p8', source: 'plan_labs', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          { id: 'p9', source: 'plan_review', target: 'checklist', kind: 'condition', condition: 'the caller acknowledges the plan' },
          // closing
          { id: 'k1', source: 'checklist', target: 'closing', kind: 'always' },
        ],
      }),
  },
]
