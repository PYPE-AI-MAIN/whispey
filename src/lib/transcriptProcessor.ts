import { OpenAI } from 'openai';
import { ProcessTranscriptParams, ProcessTranscriptResult, TranscriptItem, FieldExtractorConfig, FieldExtractorVariables } from '../types/logs';

export async function processFPOTranscript({
  log_id,
  transcript_json,
  agent_id,
  field_extractor_prompt,
  field_extractor_variables = {},
  call_log_data = {},
}: ProcessTranscriptParams): Promise<ProcessTranscriptResult> {
  try {
    console.log("🔄 Processing dynamic FPO transcript:", log_id);

    const formattedTranscript = formatPypeTranscript(transcript_json);
    const promptConfig = parseFieldExtractorPrompt(field_extractor_prompt);
    
    // Resolve variables from call log data
    const resolvedVars = resolveVariables(field_extractor_variables, call_log_data);
    
    const SYSTEM_PROMPT = buildSystemPrompt(promptConfig, resolvedVars);
    const userMessage = buildUserPrompt(promptConfig, formattedTranscript, resolvedVars);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ]
    });

    const raw = gptResponse.choices[0]?.message?.content?.trim().replace(/```json|```/g, '') || '{}';
    const extracted = JSON.parse(raw);
    const dynamicFields = convertFieldMap(extracted);

    return {
      success: true,
      status: "Processed",
      log_id,
      logData: dynamicFields
    };
  } catch (error) {
    console.error("💥 Error processing transcript:", error);
    return { success: false, error: (error as Error).message };
  }
}

function parseFieldExtractorPrompt(promptStr: string): FieldExtractorConfig[] {
  try {
    const parsed = JSON.parse(promptStr);
    if (!Array.isArray(parsed)) throw new Error("Prompt is not an array");
    return parsed.filter((p: any) => p.key && p.description);
  } catch (err) {
    console.error("❌ Invalid field_extractor_prompt JSON", err);
    return [];
  }
}

function resolveVariables(variables: FieldExtractorVariables, callLogData: any): Record<string, any> {
  const resolved: Record<string, any> = {};
  
  for (const [varName, columnPath] of Object.entries(variables)) {
    const value = getNestedValue(callLogData, columnPath);
    resolved[varName] = value !== undefined && value !== null ? value : 'N/A';
  }
  
  return resolved;
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function replaceVariablesInText(text: string, variables: Record<string, any>): string {
  let result = text;
  for (const [varName, value] of Object.entries(variables)) {
    const placeholder = `{{${varName}}}`;
    // Handle objects by converting to JSON, primitives as strings
    const stringValue = typeof value === 'object' && value !== null 
      ? JSON.stringify(value) 
      : String(value);
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
  }
  return result;
}

function buildSystemPrompt(fields: FieldExtractorConfig[], variables: Record<string, any> = {}): string {
  // Replace variables in field descriptions
  const fieldLines = fields.map(f => {
    const description = replaceVariablesInText(f.description, variables);
    return `- ${f.key}: ${description}`;
  });
  
  const prompt = `You are an expert assistant that extracts structured information from a conversation.\n\nThe fields are:\n${fieldLines.join('\n')}\n\nIf a value is missing, return "Unknown".`;
  
  return prompt;
}

function buildUserPrompt(fields: FieldExtractorConfig[], transcript: string, variables: Record<string, any> = {}): string {
  const sampleJson = Object.fromEntries(fields.map(f => [f.key, "..."]));
  
  const prompt = `Conversation:\n${transcript}\n\nNow extract the following fields in JSON:\n${JSON.stringify(sampleJson, null, 2)}`;
  
  return prompt;
}

function formatPypeTranscript(items: TranscriptItem[]): string {
  return (items || [])
    .flatMap(i => {
      if (i.role && i.content) {
        const role = i.role === 'assistant' ? 'AGENT' : 'USER';
        const text = Array.isArray(i.content) ? i.content.join(' ') : i.content;
        return [`${role}: ${text}`];
      }

      const messages: string[] = [];
      if (i.user_transcript && i.user_transcript.trim()) {
        messages.push(`USER: ${i.user_transcript}`);
      }
      if (i.agent_response && i.agent_response.trim()) {
        messages.push(`AGENT: ${i.agent_response}`);
      }
      return messages;
    })
    .join('\n');
}

function convertFieldMap(obj: Record<string, any>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      // Handle objects by converting to JSON, primitives as strings
      const stringValue = typeof v === 'object' && v !== null 
        ? JSON.stringify(v) 
        : String(v);
      return [toCamelCase(k), stringValue];
    })
  );
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^\w\s]/g, '')
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase());
}