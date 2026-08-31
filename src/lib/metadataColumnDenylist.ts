// Single source of truth for which pype_voice_call_logs.metadata keys are never shown/
// selectable — used by both the Call Logs "Columns" picker (useCallLogsColumns.ts) and
// flag-rules validation (flagRulesValidation.ts). Kept as its own file, with zero
// dependencies, so server-side code (API routes) can import it without pulling in
// React/zustand from the hooks layer.
export const EXCLUDED_METADATA_COLUMNS = [
  'complete_configuration',
  'usage',
  'sip_trunk_id',
  'campaignId',
  'contactId',
  'agent_name',
  'metadata',
  'retry_config',
  'apikey',
  'api_url',
]
