// Bulbul v4 Flash (beta) voices. IDs are "voice_language_style" and come from
// Sarvam's live roster (Sept 2026); gender is only set where it's known.
export const BULBUL_V4_MODEL = 'bulbul:v4-flash'

export interface BulbulV4Voice {
  id: string
  name: string
  language: string
  gender?: 'Male' | 'Female'
  style: string
  accent: string
  description: string
  compatibleModels: string[]
}

// Sarvam's expert picks for English/Hindi use cases, shown first.
const RECOMMENDED_IDS = new Set([
  'aparna_hi_customer', 'shubh_hi_customer', 'simran_enhi_customer',
  'ishita_enhi_customer', 'shubh_enhi_banking', 'simran_en_sales',
  'sunny_en_social', 'rohan_en_recovery', 'shubh_hi_ecomm',
  'aparna_hi_kyc', 'sanchita_en_recovery', 'zarina_en_conversation',
  'shubh_en_recovery', 'aparna_en_companion', 'sanchita_en_companion',
  'sanchita_en_insurance', 'aparna_en_edtech', 'simran_hi_recovery',
  'aarti_hi_customer', 'ratan_hi_customer_expressive',
])

const SPEAKER_IDS = [
  'aayan_hi_conversational', 'amit_hi_conversational', 'ashutosh_hi_conversational',
  'kabir_hi_conversational', 'kavya_hi_conversational', 'manan_hi_conversational',
  'rahul_hi_conversational', 'sumit_hi_conversational', 'bappa_bn_conversation',
  'roopa_bn_conversational', 'aditi_en_stories', 'aparna_en_companion',
  'aparna_en_edtech', 'ashwin_en_sports', 'ashwin_en_sports_energetic',
  'chandrika_en_stories', 'dev_en_recovery', 'dev_en_conversational',
  'deven_en_conversation', 'ishita_en_customer', 'ishita_en_medical',
  'ishita_en_numbers', 'ishita_en_social', 'ishita_en_stories',
  'kalpit_en_edtech', 'nachiket_en_ads', 'neha_en_customer',
  'neha_en_latenight', 'nupur_en_kids', 'ojas_en_social',
  'ritu_en_edtech', 'ritu_en_latenight', 'ritu_en_medical',
  'ritu_en_reels', 'rohan_en_recovery', 'roopa_en_conversational',
  'rustom_en_suspense', 'sanchita_en_companion', 'sanchita_en_insurance',
  'sanchita_en_recovery', 'sanchita_en_market', 'sanchita_en_social',
  'shabana_en_edtech', 'shalini_en_companion', 'shalini_en_customer',
  'shubh_en_narration', 'shubh_en_numbers', 'shubh_en_ads',
  'shubh_en_recovery', 'shubh_en_audiobook', 'shubh_en_narration_gentle',
  'shubh_en_sports', 'simran_en_narration', 'simran_en_automobile',
  'simran_en_conversation', 'simran_en_customer', 'simran_en_edtech',
  'simran_en_edtech_bot', 'simran_en_sales', 'simran_en_recovery',
  'simran_en_ads', 'simran_en_therapist', 'sunny_en_social',
  'varun_en_ads', 'varun_en_suspense', 'zarina_en_conversation',
  'ishita_enhi_companion', 'ishita_enhi_customer', 'ishita_enhi_customer_expressive',
  'sanchita_enhi_companion', 'shalini_enhi_companion', 'shalini_enhi_customer',
  'shubh_enhi_companion', 'shubh_enhi_ads', 'shubh_enhi_banking',
  'simran_enhi_companion', 'simran_enhi_customer', 'simran_enhi_banking_expressive',
  'sunny_enhi_customer', 'bhavik_gu_conversation', 'pooja_gu_conversational',
  'pooja_gu_customer', 'aditya_hi_conversational', 'aditya_hi_sales',
  'anand_hi_documentary', 'anand_hi_news', 'aparna_hi_customer',
  'aparna_hi_kyc', 'ashok_hi_character', 'ashok_hi_news',
  'chhavi_hi_kids', 'ishita_hi_ads', 'ishita_hi_edtech',
  'ishita_hi_banking', 'ishita_hi_ads_informal', 'ishita_hi_devotional',
  'ishita_hi_numbers', 'ishita_hi_social', 'kunal_hi_kids',
  'mahesh_hi_documentary', 'mani_hi_devotional', 'mani_hi_conversational',
  'mohit_hi_conversational', 'nachiket_hi_devotional', 'priya_hi_recovery',
  'ratan_hi_latenight', 'ratan_hi_customer_expressive', 'ratan_hi_documentary',
  'ratan_hi_devotional', 'ratan_hi_recovery', 'ratan_hi_social',
  'ratan_hi_sports', 'ratan_hi_latenight_warm', 'rehan_hi_social',
  'ritu_hi_customer_utility', 'ritu_hi_kids', 'ritu_hi_conversation',
  'ritu_hi_customer', 'ritu_hi_edtech', 'ritu_hi_ads_formal',
  'ritu_hi_banking', 'ritu_hi_ads_informal', 'ritu_hi_insurance',
  'ritu_hi_edtech_bot', 'ritu_hi_medical', 'ritu_hi_sales',
  'ritu_hi_reels', 'ritu_hi_social', 'ritu_hi_customer_warm',
  'ritu_hi_social_lively', 'roopa_hi_companion', 'roopa_hi_narration',
  'roopa_hi_recovery', 'roopa_hi_market', 'roopa_hi_conversational',
  'sanchita_hi_assistant', 'sanchita_hi_edtech', 'sanchita_hi_banking',
  'sanchita_hi_feedback', 'sanchita_hi_ads_formal', 'sanchita_hi_ads_informal',
  'sanchita_hi_interview', 'sanchita_hi_romantic', 'sanchita_hi_market',
  'sanchita_hi_social', 'sanchita_hi_kyc', 'sarika_hi_conversation',
  'shalini_hi_companion', 'shalini_hi_social', 'shreya_hi_conversational',
  'shreya_hi_news', 'shruti_hi_edtech', 'shubh_hi_customer',
  'shubh_hi_ecomm', 'shubh_hi_stories_mixed', 'shubh_hi_devotional',
  'shubh_hi_ads', 'shubh_hi_recovery', 'shubh_hi_stories_dramatic',
  'simran_hi_assistant', 'simran_hi_narration', 'simran_hi_automobile',
  'simran_hi_conversation', 'simran_hi_news_breaking', 'simran_hi_social_energetic',
  'simran_hi_social_excited', 'simran_hi_latenight', 'simran_hi_news',
  'simran_hi_recovery', 'simran_hi_sales', 'suchitra_hi_ecomm',
  'suhani_hi_social', 'sunny_hi_ads', 'sunny_hi_reels',
  'tarun_hi_conversational', 'tarun_hi_sales', 'chaitra_hi_customer',
  'shilpa_hi_narration', 'tanya_hi_narration', 'chaitra_kn_conversation',
  'chaitra_kn_narration', 'chetan_kn_conversation', 'suchitra_kn_narration',
  'ishita_mr_conversational', 'mrunal_mr_narration', 'neha_mr_narration',
  'nilesh_mr_conversation', 'ritu_mr_insurance', 'ritu_mr_narration',
  'rupali_mr_stories', 'soham_mr_narration', 'anand_pa_conversation',
  'anand_pa_customer', 'harpreet_pa_narration', 'jaspal_pa_banking',
  'gokul_ta_narration', 'vetri_ta_ads', 'vetri_ta_suspense',
  'vijay_ta_narration', 'kavitha_te_conversation', 'kavitha_te_narration',
  'pooja_te_conversation', 'tarun_te_narration', 'amelia_en_conversational',
  'sophia_en_conversational', 'bimal_bn_suspense', 'girish_en_documentary',
  'girish_en_devotional', 'payal_en_edtech', 'sarang_en_narration',
  'aarti_hi_customer', 'advait_hi_character', 'aryaman_hi_ads',
  'chirag_hi_social', 'girish_hi_devotional', 'mukul_hi_ads',
  'mukul_hi_suspense', 'suman_hi_companion', 'vaibhav_hi_social',
  'vandana_hi_ecomm', 'vipul_hi_social', 'mukul_mr_stories',
]

const LANGUAGES: Record<string, { label: string; code: string }> = {
  hi: { label: 'Hindi', code: 'hi-IN' },
  en: { label: 'English', code: 'en-IN' },
  enhi: { label: 'English + Hindi', code: 'hi-IN' },
  mr: { label: 'Marathi', code: 'mr-IN' },
  bn: { label: 'Bengali', code: 'bn-IN' },
  gu: { label: 'Gujarati', code: 'gu-IN' },
  kn: { label: 'Kannada', code: 'kn-IN' },
  pa: { label: 'Punjabi', code: 'pa-IN' },
  ta: { label: 'Tamil', code: 'ta-IN' },
  te: { label: 'Telugu', code: 'te-IN' },
}

const GENDERS: Record<string, 'Male' | 'Female'> = {
  aarti: 'Female',
  aayan: 'Male',
  aditya: 'Male',
  advait: 'Male',
  amelia: 'Female',
  amit: 'Male',
  anand: 'Male',
  aparna: 'Female',
  ashutosh: 'Male',
  dev: 'Male',
  gokul: 'Male',
  ishita: 'Female',
  kabir: 'Male',
  kavitha: 'Female',
  kavya: 'Female',
  manan: 'Male',
  mani: 'Male',
  mohit: 'Male',
  neha: 'Female',
  pooja: 'Female',
  priya: 'Female',
  rahul: 'Male',
  ratan: 'Male',
  rehan: 'Male',
  ritu: 'Female',
  rohan: 'Male',
  roopa: 'Female',
  rupali: 'Female',
  sanchita: 'Female',
  shreya: 'Female',
  shruti: 'Female',
  shubh: 'Male',
  simran: 'Female',
  soham: 'Male',
  sophia: 'Female',
  suhani: 'Female',
  sumit: 'Male',
  sunny: 'Male',
  tanya: 'Female',
  tarun: 'Male',
  varun: 'Male',
  vijay: 'Male',
  zarina: 'Female',
}

/** Language codes that have at least one v4 voice (no Malayalam or Odia yet). */
export const BULBUL_V4_LANGUAGE_CODES = [...new Set(Object.values(LANGUAGES).map((l) => l.code))]

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

export function isBulbulV4Model(model: string | undefined): boolean {
  return model === BULBUL_V4_MODEL
}

/** Language code a v4 speaker expects, from the language segment of its ID. */
export function bulbulV4LanguageCode(speakerId: string): string {
  return LANGUAGES[speakerId.split('_')[1]]?.code ?? 'en-IN'
}

function toVoice(id: string): BulbulV4Voice {
  const [voice, lang, ...styleParts] = id.split('_')
  const style = styleParts.map(capitalize).join(' ')
  const language = LANGUAGES[lang]?.label ?? lang
  const recommended = RECOMMENDED_IDS.has(id)
  return {
    id,
    name: capitalize(voice),
    language,
    gender: GENDERS[voice],
    style,
    accent: 'Indian',
    description: recommended ? `Recommended by Sarvam · ${style}` : style,
    compatibleModels: [BULBUL_V4_MODEL],
  }
}

export const bulbulV4Voices: BulbulV4Voice[] = [
  ...RECOMMENDED_IDS,
  ...SPEAKER_IDS.filter((id) => !RECOMMENDED_IDS.has(id)),
].map(toVoice)
