import { createClient } from '@supabase/supabase-js';
import { UsageData, CostResult } from '../types/logs';

// Create server-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default fallback if DB misses data
const FALLBACK = {
  gpt: { in: 0.40, out: 1.60 },
  tts: 50 / 1_000_000,
  sttInrPerSec: 30 / 3600
};

async function getUsdToInr(onDate: string | Date): Promise<number> {
  const date = new Date(onDate).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('usd_to_inr_rate')
    .select('rate')
    .eq('as_of', date)
    .single();
  
  if (error || !data?.rate) {
    return 87.56; // Fallback rate
  }
  return parseFloat(data.rate);
}

export async function fetchRate(pricingColumn: string, table: string, filters: Record<string, any>): Promise<number | null> {
  const { data, error } = await supabase
    .from(table)
    .select(pricingColumn)
    .match(filters)
    .single();
  
  if (error || data == null || data[pricingColumn as any] == null) {
    return null;
  }
  return parseFloat(data[pricingColumn as any]);
}

interface TotalCostsParams {
  usageArr?: UsageData[];
  modelName?: string;
  callStartedAt?: string | Date;
}

export async function totalCostsINR({
  usageArr = [],
  modelName = 'gpt-4.1-mini',
  callStartedAt = new Date()
}: TotalCostsParams): Promise<CostResult> {
  const [usdToInr, gptRates, ttsUsd, sttUsdSec] = await Promise.all([
    getUsdToInr(callStartedAt),
    supabase.from('gpt_api_pricing')
      .select('input_usd_per_million,output_usd_per_million')
      .eq('model_name', modelName)
      .single(),
    supabase.from('audio_api_pricing')
      .select('cost_usd_per_unit')
      .eq('unit', 'character')
      .eq('provider', 'ElevenLabs')
      .like('model_or_plan', '%Flash')
      .single(),
    supabase.from('audio_api_pricing')
      .select('cost_inr_per_unit')
      .eq('unit', 'second')
      .eq('provider', 'Sarvam AI')
      .like('model_or_plan', '%transcription%')
      .single()
  ]);

  const gptInUsd = gptRates.error || gptRates.data == null
    ? FALLBACK.gpt.in
    : parseFloat(gptRates.data.input_usd_per_million);

  const gptOutUsd = gptRates.error || gptRates.data == null
    ? FALLBACK.gpt.out
    : parseFloat(gptRates.data.output_usd_per_million);

  const ttsUsdPerChar = ttsUsd.error || ttsUsd.data == null
    ? FALLBACK.tts
    : parseFloat(ttsUsd.data.cost_usd_per_unit);

  let sttInrPerSec = sttUsdSec.data?.cost_inr_per_unit;
  if (sttUsdSec.error || sttInrPerSec == null) {
    sttInrPerSec = FALLBACK.sttInrPerSec;
  }

  let totalLlmInr = 0;
  let totalTtsInr = 0;
  let totalSttInr = 0;

  for (const u of usageArr) {
    const promptUsd = (u.llm_prompt_tokens || 0) / 1e6 * gptInUsd;
    const outUsd = (u.llm_completion_tokens || 0) / 1e6 * gptOutUsd;
    const llmUsd = promptUsd + outUsd;
    const llmInr = llmUsd * usdToInr;

    const ttsInr = (u.tts_characters || 0) * ttsUsdPerChar * usdToInr;
    const sttInr = (u.stt_audio_duration || 0) * sttInrPerSec;

    totalLlmInr += llmInr;
    totalTtsInr += ttsInr;
    totalSttInr += sttInr;
  }

  return {
    total_llm_cost_inr: Number(totalLlmInr.toFixed(2)),
    total_tts_cost_inr: Number(totalTtsInr.toFixed(2)),
    total_stt_cost_inr: Number(totalSttInr.toFixed(2))
  };
}