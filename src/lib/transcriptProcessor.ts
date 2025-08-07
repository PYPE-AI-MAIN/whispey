import { OpenAI } from 'openai';
import { ProcessTranscriptParams, ProcessTranscriptResult, TranscriptItem, FieldExtractorConfig } from '../types/logs';

export async function processFPOTranscript({
  log_id,
  transcript_json,
  agent_id,
  field_extractor_prompt,
}: ProcessTranscriptParams): Promise<ProcessTranscriptResult> {
  try {
    console.log("🔄 Processing dynamic FPO transcript:", log_id);

    const formattedTranscript = formatPypeTranscript(transcript_json);
    const promptConfig = parseFieldExtractorPrompt(field_extractor_prompt);
    const SYSTEM_PROMPT = buildSystemPrompt(promptConfig);
    const userMessage = buildUserPrompt(promptConfig, formattedTranscript);

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

function buildSystemPrompt(fields: FieldExtractorConfig[]): string {
  const lines = fields.map(f => `- ${f.key}: ${f.description}`);
  return `You are an expert assistant that extracts structured information from a conversation.\n\nThe fields are:\n${lines.join('\n')}\n\nIf a value is missing, return "Unknown".`;
}

function buildUserPrompt(fields: FieldExtractorConfig[], transcript: string): string {
  const sampleJson = Object.fromEntries(fields.map(f => [f.key, "..."]));
  return `Conversation:\n${transcript}\n\nNow extract the following fields in JSON:\n${JSON.stringify(sampleJson, null, 2)}`;
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
    Object.entries(obj).map(([k, v]) => [toCamelCase(k), String(v)])
  );
}

function toCamelCase(str: string): string {
  return str
    .replace(/[^\w\s]/g, '')
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase());
}