"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import CallDetailsDrawer from "./CallDetailsDrawer"
import CallFilter, { FilterRule } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { CostTooltip } from "../tool-tip/costToolTip"
import { CallLog } from "../../types/logs"
import Papa from 'papaparse'
import { useUser } from "@clerk/nextjs"
import { getUserProjectRole } from "@/services/getUserRole"

// Dummy data for 20 call logs for Sales Caller Pro
const DUMMY_CALLS: Omit<CallLog, 'agent_id'>[] = [
  {
    id: "1",
    call_id: "call_001_abc123def456",
    customer_number: "+91-9876543210",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T09:15:30Z",
    call_ended_at: "2025-08-26T09:18:45Z",
    duration_seconds: 195,
    recording_url: "https://example.com/recordings/call_001.mp3",
    total_llm_cost: 12.45,
    total_tts_cost: 8.32,
    total_stt_cost: 4.18,
    avg_latency: 1.2,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T09:15:30Z",
    metadata: {
      prospect_name: "Rajesh Kumar",
      lead_source: "facebook_ads",
      property_type: "3bhk_apartment",
      budget_range: "50-75L",
      location_preference: "Whitefield",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 85
    },
    transcription_metrics: {
      total_words: 312,
      agent_words: 187,
      prospect_words: 125,
      avg_confidence: 0.94,
      silence_percentage: 6.4,
      agent_talk_ratio: 0.6,
      interruptions_count: 3,
      questions_asked_agent: 12,
      questions_asked_prospect: 5,
      positive_sentiment_words: 18,
      negative_sentiment_words: 2,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 1,
      interest_level_score: 0.78,
      engagement_score: 0.82
    }
  },
  {
    id: "2",
    call_id: "call_002_xyz789ghi012",
    customer_number: "+91-8765432109",
    call_ended_reason: "dropped",
    call_started_at: "2025-08-26T08:45:15Z",
    call_ended_at: "2025-08-26T08:46:23Z",
    duration_seconds: 68,
    recording_url: "https://example.com/recordings/call_002.mp3",
    total_llm_cost: 3.15,
    total_tts_cost: 1.98,
    total_stt_cost: 1.05,
    avg_latency: 2.1,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T08:45:15Z",
    metadata: {
      prospect_name: "Priya Sharma",
      lead_source: "google_ads",
      property_type: "2bhk_apartment",
      budget_range: "30-40L",
      location_preference: "Electronic City",
      follow_up_required: true,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 25
    },
    transcription_metrics: {
      total_words: 89,
      agent_words: 65,
      prospect_words: 24,
      avg_confidence: 0.78,
      silence_percentage: 12.1,
      agent_talk_ratio: 0.73,
      interruptions_count: 2,
      questions_asked_agent: 5,
      questions_asked_prospect: 1,
      positive_sentiment_words: 2,
      negative_sentiment_words: 6,
      budget_mentioned: false,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 3,
      interest_level_score: 0.15,
      engagement_score: 0.28
    }
  },
  {
    id: "3",
    call_id: "call_003_mno345pqr678",
    customer_number: "+91-7654321098",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T10:30:00Z",
    call_ended_at: "2025-08-26T10:35:42Z",
    duration_seconds: 342,
    recording_url: "https://example.com/recordings/call_003.mp3",
    total_llm_cost: 18.78,
    total_tts_cost: 12.56,
    total_stt_cost: 6.34,
    avg_latency: 0.9,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T10:30:00Z",
    metadata: {
      prospect_name: "Amit Patel",
      lead_source: "referral",
      property_type: "4bhk_villa",
      budget_range: "1-1.5Cr",
      location_preference: "Sarjapur Road",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: true,
      deal_progressed: true,
      lead_score: 92
    },
    transcription_metrics: {
      total_words: 456,
      agent_words: 298,
      prospect_words: 158,
      avg_confidence: 0.96,
      silence_percentage: 4.2,
      agent_talk_ratio: 0.65,
      interruptions_count: 1,
      questions_asked_agent: 15,
      questions_asked_prospect: 8,
      positive_sentiment_words: 28,
      negative_sentiment_words: 1,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 0,
      interest_level_score: 0.91,
      engagement_score: 0.89
    }
  },
  {
    id: "4",
    call_id: "call_004_def456ghi789",
    customer_number: "+91-9123456780",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T11:15:20Z",
    call_ended_at: "2025-08-26T11:18:35Z",
    duration_seconds: 195,
    recording_url: "https://example.com/recordings/call_004.mp3",
    total_llm_cost: 11.25,
    total_tts_cost: 7.89,
    total_stt_cost: 3.92,
    avg_latency: 1.4,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T11:15:20Z",
    metadata: {
      prospect_name: "Sneha Reddy",
      lead_source: "website_form",
      property_type: "2bhk_apartment",
      budget_range: "40-50L",
      location_preference: "Koramangala",
      follow_up_required: true,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 68
    },
    transcription_metrics: {
      total_words: 278,
      agent_words: 165,
      prospect_words: 113,
      avg_confidence: 0.91,
      silence_percentage: 7.8,
      agent_talk_ratio: 0.59,
      interruptions_count: 4,
      questions_asked_agent: 10,
      questions_asked_prospect: 6,
      positive_sentiment_words: 14,
      negative_sentiment_words: 3,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 2,
      interest_level_score: 0.72,
      engagement_score: 0.75
    }
  },
  {
    id: "5",
    call_id: "call_005_jkl012mno345",
    customer_number: "+91-8234567891",
    call_ended_reason: "failed",
    call_started_at: "2025-08-26T12:05:10Z",
    call_ended_at: "2025-08-26T12:05:45Z",
    duration_seconds: 35,
    recording_url: "https://example.com/recordings/call_005.mp3",
    total_llm_cost: 1.85,
    total_tts_cost: 1.12,
    total_stt_cost: 0.58,
    avg_latency: 3.2,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T12:05:10Z",
    metadata: {
      prospect_name: "Unknown",
      lead_source: "cold_calling",
      property_type: "unknown",
      budget_range: "unknown",
      location_preference: "unknown",
      follow_up_required: false,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 5
    },
    transcription_metrics: {
      total_words: 42,
      agent_words: 38,
      prospect_words: 4,
      avg_confidence: 0.65,
      silence_percentage: 18.5,
      agent_talk_ratio: 0.90,
      interruptions_count: 1,
      questions_asked_agent: 2,
      questions_asked_prospect: 0,
      positive_sentiment_words: 1,
      negative_sentiment_words: 2,
      budget_mentioned: false,
      location_mentioned: false,
      timeline_mentioned: false,
      objections_raised: 1,
      interest_level_score: 0.05,
      engagement_score: 0.12
    }
  },
  {
    id: "6",
    call_id: "call_006_pqr678stu901",
    customer_number: "+91-7345678902",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T13:20:15Z",
    call_ended_at: "2025-08-26T13:26:30Z",
    duration_seconds: 375,
    recording_url: "https://example.com/recordings/call_006.mp3",
    total_llm_cost: 21.45,
    total_tts_cost: 14.78,
    total_stt_cost: 7.89,
    avg_latency: 1.1,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T13:20:15Z",
    metadata: {
      prospect_name: "Vikram Singh",
      lead_source: "linkedin",
      property_type: "3bhk_apartment",
      budget_range: "60-80L",
      location_preference: "HSR Layout",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: true,
      deal_progressed: false,
      lead_score: 78
    },
    transcription_metrics: {
      total_words: 523,
      agent_words: 312,
      prospect_words: 211,
      avg_confidence: 0.93,
      silence_percentage: 5.1,
      agent_talk_ratio: 0.60,
      interruptions_count: 2,
      questions_asked_agent: 18,
      questions_asked_prospect: 9,
      positive_sentiment_words: 22,
      negative_sentiment_words: 2,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 1,
      interest_level_score: 0.84,
      engagement_score: 0.87
    }
  },
  {
    id: "7",
    call_id: "call_007_vwx234yza567",
    customer_number: "+91-6456789013",
    call_ended_reason: "dropped",
    call_started_at: "2025-08-26T14:10:25Z",
    call_ended_at: "2025-08-26T14:12:18Z",
    duration_seconds: 113,
    recording_url: "https://example.com/recordings/call_007.mp3",
    total_llm_cost: 6.78,
    total_tts_cost: 4.23,
    total_stt_cost: 2.15,
    avg_latency: 1.8,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T14:10:25Z",
    metadata: {
      prospect_name: "Anitha Krishnan",
      lead_source: "facebook_ads",
      property_type: "1bhk_apartment",
      budget_range: "25-35L",
      location_preference: "Marathahalli",
      follow_up_required: true,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 35
    },
    transcription_metrics: {
      total_words: 134,
      agent_words: 89,
      prospect_words: 45,
      avg_confidence: 0.82,
      silence_percentage: 9.7,
      agent_talk_ratio: 0.66,
      interruptions_count: 3,
      questions_asked_agent: 6,
      questions_asked_prospect: 2,
      positive_sentiment_words: 5,
      negative_sentiment_words: 4,
      budget_mentioned: true,
      location_mentioned: false,
      timeline_mentioned: false,
      objections_raised: 2,
      interest_level_score: 0.42,
      engagement_score: 0.38
    }
  },
  {
    id: "8",
    call_id: "call_008_bcd890efg123",
    customer_number: "+91-5567890124",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T15:30:40Z",
    call_ended_at: "2025-08-26T15:34:25Z",
    duration_seconds: 225,
    recording_url: "https://example.com/recordings/call_008.mp3",
    total_llm_cost: 13.67,
    total_tts_cost: 9.34,
    total_stt_cost: 4.78,
    avg_latency: 1.3,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T15:30:40Z",
    metadata: {
      prospect_name: "Karthik Rao",
      lead_source: "referral",
      property_type: "2bhk_apartment",
      budget_range: "45-55L",
      location_preference: "Indiranagar",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 72
    },
    transcription_metrics: {
      total_words: 345,
      agent_words: 198,
      prospect_words: 147,
      avg_confidence: 0.89,
      silence_percentage: 6.8,
      agent_talk_ratio: 0.57,
      interruptions_count: 2,
      questions_asked_agent: 13,
      questions_asked_prospect: 7,
      positive_sentiment_words: 16,
      negative_sentiment_words: 2,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 1,
      interest_level_score: 0.76,
      engagement_score: 0.79
    }
  },
  {
    id: "9",
    call_id: "call_009_hij456klm789",
    customer_number: "+91-4678901235",
    call_ended_reason: "completed",
    call_started_at: "2025-08-26T16:45:50Z",
    call_ended_at: "2025-08-26T16:51:15Z",
    duration_seconds: 325,
    recording_url: "https://example.com/recordings/call_009.mp3",
    total_llm_cost: 19.23,
    total_tts_cost: 13.12,
    total_stt_cost: 6.87,
    avg_latency: 0.8,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T16:45:50Z",
    metadata: {
      prospect_name: "Deepika Menon",
      lead_source: "google_ads",
      property_type: "3bhk_villa",
      budget_range: "80L-1Cr",
      location_preference: "Bannerghatta Road",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: true,
      deal_progressed: true,
      lead_score: 88
    },
    transcription_metrics: {
      total_words: 487,
      agent_words: 289,
      prospect_words: 198,
      avg_confidence: 0.95,
      silence_percentage: 4.5,
      agent_talk_ratio: 0.59,
      interruptions_count: 1,
      questions_asked_agent: 16,
      questions_asked_prospect: 11,
      positive_sentiment_words: 25,
      negative_sentiment_words: 1,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 0,
      interest_level_score: 0.89,
      engagement_score: 0.92
    }
  },
  {
    id: "10",
    call_id: "call_010_nop012qrs345",
    customer_number: "+91-3789012346",
    call_ended_reason: "failed",
    call_started_at: "2025-08-26T17:20:05Z",
    call_ended_at: "2025-08-26T17:20:28Z",
    duration_seconds: 23,
    recording_url: "https://example.com/recordings/call_010.mp3",
    total_llm_cost: 1.23,
    total_tts_cost: 0.78,
    total_stt_cost: 0.45,
    avg_latency: 4.1,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-26T17:20:05Z",
    metadata: {
      prospect_name: "Unknown",
      lead_source: "cold_calling",
      property_type: "unknown",
      budget_range: "unknown",
      location_preference: "unknown",
      follow_up_required: false,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 2
    },
    transcription_metrics: {
      total_words: 18,
      agent_words: 16,
      prospect_words: 2,
      avg_confidence: 0.55,
      silence_percentage: 25.2,
      agent_talk_ratio: 0.89,
      interruptions_count: 1,
      questions_asked_agent: 1,
      questions_asked_prospect: 0,
      positive_sentiment_words: 0,
      negative_sentiment_words: 1,
      budget_mentioned: false,
      location_mentioned: false,
      timeline_mentioned: false,
      objections_raised: 1,
      interest_level_score: 0.02,
      engagement_score: 0.08
    }
  },
  {
    id: "11",
    call_id: "call_011_tuv678wxy901",
    customer_number: "+91-2890123457",
    call_ended_reason: "completed",
    call_started_at: "2025-08-25T09:30:15Z",
    call_ended_at: "2025-08-25T09:35:42Z",
    duration_seconds: 327,
    recording_url: "https://example.com/recordings/call_011.mp3",
    total_llm_cost: 18.92,
    total_tts_cost: 12.87,
    total_stt_cost: 6.73,
    avg_latency: 1.0,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T09:30:15Z",
    metadata: {
      prospect_name: "Ravi Gupta",
      lead_source: "website_form",
      property_type: "4bhk_apartment",
      budget_range: "70-90L",
      location_preference: "JP Nagar",
      follow_up_required: true,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 74
    },
    transcription_metrics: {
      total_words: 428,
      agent_words: 256,
      prospect_words: 172,
      avg_confidence: 0.92,
      silence_percentage: 5.8,
      agent_talk_ratio: 0.60,
      interruptions_count: 3,
      questions_asked_agent: 14,
      questions_asked_prospect: 8,
      positive_sentiment_words: 19,
      negative_sentiment_words: 3,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 2,
      interest_level_score: 0.73,
      engagement_score: 0.78
    }
  },
  {
    id: "12",
    call_id: "call_012_zab234cde567",
    customer_number: "+91-1901234568",
    call_ended_reason: "dropped",
    call_started_at: "2025-08-25T10:15:20Z",
    call_ended_at: "2025-08-25T10:16:45Z",
    duration_seconds: 85,
    recording_url: "https://example.com/recordings/call_012.mp3",
    total_llm_cost: 4.67,
    total_tts_cost: 2.98,
    total_stt_cost: 1.54,
    avg_latency: 2.3,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T10:15:20Z",
    metadata: {
      prospect_name: "Meera Joshi",
      lead_source: "facebook_ads",
      property_type: "2bhk_apartment",
      budget_range: "35-45L",
      location_preference: "Bellandur",
      follow_up_required: true,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 28
    },
    transcription_metrics: {
      total_words: 98,
      agent_words: 72,
      prospect_words: 26,
      avg_confidence: 0.79,
      silence_percentage: 11.3,
      agent_talk_ratio: 0.73,
      interruptions_count: 2,
      questions_asked_agent: 4,
      questions_asked_prospect: 1,
      positive_sentiment_words: 3,
      negative_sentiment_words: 5,
      budget_mentioned: false,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 3,
      interest_level_score: 0.32,
      engagement_score: 0.29
    }
  },
  {
    id: "13",
    call_id: "call_013_fgh890ijk123",
    customer_number: "+91-9012345679",
    call_ended_reason: "completed",
    call_started_at: "2025-08-25T11:45:30Z",
    call_ended_at: "2025-08-25T11:49:15Z",
    duration_seconds: 225,
    recording_url: "https://example.com/recordings/call_013.mp3",
    total_llm_cost: 12.78,
    total_tts_cost: 8.92,
    total_stt_cost: 4.67,
    avg_latency: 1.2,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T11:45:30Z",
    metadata: {
      prospect_name: "Suresh Nair",
      lead_source: "linkedin",
      property_type: "3bhk_apartment",
      budget_range: "55-70L",
      location_preference: "Hebbal",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 69
    },
    transcription_metrics: {
      total_words: 298,
      agent_words: 182,
      prospect_words: 116,
      avg_confidence: 0.88,
      silence_percentage: 7.2,
      agent_talk_ratio: 0.61,
      interruptions_count: 2,
      questions_asked_agent: 11,
      questions_asked_prospect: 5,
      positive_sentiment_words: 13,
      negative_sentiment_words: 2,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 1,
      interest_level_score: 0.71,
      engagement_score: 0.74
    }
  },
  {
    id: "14",
    call_id: "call_014_lmn456opq789",
    customer_number: "+91-8123456780",
    call_ended_reason: "completed",
    call_started_at: "2025-08-25T13:10:45Z",
    call_ended_at: "2025-08-25T13:17:20Z",
    duration_seconds: 395,
    recording_url: "https://example.com/recordings/call_014.mp3",
    total_llm_cost: 23.45,
    total_tts_cost: 15.89,
    total_stt_cost: 8.23,
    avg_latency: 0.7,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T13:10:45Z",
    metadata: {
      prospect_name: "Lakshmi Iyer",
      lead_source: "referral",
      property_type: "2bhk_villa",
      budget_range: "65-85L",
      location_preference: "Jayanagar",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: true,
      deal_progressed: true,
      lead_score: 89
    },
    transcription_metrics: {
      total_words: 567,
      agent_words: 342,
      prospect_words: 225,
      avg_confidence: 0.97,
      silence_percentage: 3.8,
      agent_talk_ratio: 0.60,
      interruptions_count: 1,
      questions_asked_agent: 19,
      questions_asked_prospect: 12,
      positive_sentiment_words: 31,
      negative_sentiment_words: 0,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 0,
      interest_level_score: 0.93,
      engagement_score: 0.95
    }
  },
  {
    id: "15",
    call_id: "call_015_rst012uvw345",
    customer_number: "+91-7234567891",
    call_ended_reason: "failed",
    call_started_at: "2025-08-25T14:25:10Z",
    call_ended_at: "2025-08-25T14:25:42Z",
    duration_seconds: 32,
    recording_url: "https://example.com/recordings/call_015.mp3",
    total_llm_cost: 1.67,
    total_tts_cost: 1.02,
    total_stt_cost: 0.54,
    avg_latency: 3.8,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T14:25:10Z",
    metadata: {
      prospect_name: "Unknown",
      lead_source: "cold_calling",
      property_type: "unknown",
      budget_range: "unknown",
      location_preference: "unknown",
      follow_up_required: false,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 3
    },
    transcription_metrics: {
      total_words: 25,
      agent_words: 22,
      prospect_words: 3,
      avg_confidence: 0.48,
      silence_percentage: 22.1,
      agent_talk_ratio: 0.88,
      interruptions_count: 1,
      questions_asked_agent: 1,
      questions_asked_prospect: 0,
      positive_sentiment_words: 0,
      negative_sentiment_words: 2,
      budget_mentioned: false,
      location_mentioned: false,
      timeline_mentioned: false,
      objections_raised: 1,
      interest_level_score: 0.03,
      engagement_score: 0.09
    }
  },
  {
    id: "16",
    call_id: "call_016_xyz678abc901",
    customer_number: "+91-6345678902",
    call_ended_reason: "completed",
    call_started_at: "2025-08-25T15:40:25Z",
    call_ended_at: "2025-08-25T15:44:18Z",
    duration_seconds: 233,
    recording_url: "https://example.com/recordings/call_016.mp3",
    total_llm_cost: 14.23,
    total_tts_cost: 9.78,
    total_stt_cost: 5.12,
    avg_latency: 1.1,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T15:40:25Z",
    metadata: {
      prospect_name: "Arjun Malhotra",
      lead_source: "google_ads",
      property_type: "1bhk_apartment",
      budget_range: "28-38L",
      location_preference: "Bommanahalli",
      follow_up_required: true,
      qualified_lead: true,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 58
    },
    transcription_metrics: {
      total_words: 276,
      agent_words: 168,
      prospect_words: 108,
      avg_confidence: 0.86,
      silence_percentage: 8.4,
      agent_talk_ratio: 0.61,
      interruptions_count: 3,
      questions_asked_agent: 9,
      questions_asked_prospect: 4,
      positive_sentiment_words: 11,
      negative_sentiment_words: 4,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 2,
      interest_level_score: 0.62,
      engagement_score: 0.65
    }
  },
  {
    id: "17",
    call_id: "call_017_def234ghi567",
    customer_number: "+91-5456789013",
    call_ended_reason: "dropped",
    call_started_at: "2025-08-25T16:55:35Z",
    call_ended_at: "2025-08-25T16:57:12Z",
    duration_seconds: 97,
    recording_url: "https://example.com/recordings/call_017.mp3",
    total_llm_cost: 5.43,
    total_tts_cost: 3.67,
    total_stt_cost: 1.89,
    avg_latency: 1.9,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T16:55:35Z",
    metadata: {
      prospect_name: "Kavya Shetty",
      lead_source: "website_form",
      property_type: "3bhk_apartment",
      budget_range: "52-68L",
      location_preference: "Yeshwantpur",
      follow_up_required: true,
      qualified_lead: false,
      interested_in_visit: false,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 31
    },
    transcription_metrics: {
      total_words: 112,
      agent_words: 78,
      prospect_words: 34,
      avg_confidence: 0.81,
      silence_percentage: 10.5,
      agent_talk_ratio: 0.70,
      interruptions_count: 2,
      questions_asked_agent: 5,
      questions_asked_prospect: 2,
      positive_sentiment_words: 4,
      negative_sentiment_words: 6,
      budget_mentioned: false,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 3,
      interest_level_score: 0.35,
      engagement_score: 0.33
    }
  },
  {
    id: "18",
    call_id: "call_018_jkl890mno123",
    customer_number: "+91-4567890124",
    call_ended_reason: "completed",
    call_started_at: "2025-08-25T17:30:50Z",
    call_ended_at: "2025-08-25T17:35:28Z",
    duration_seconds: 278,
    recording_url: "https://example.com/recordings/call_018.mp3",
    total_llm_cost: 16.34,
    total_tts_cost: 11.23,
    total_stt_cost: 5.89,
    avg_latency: 1.0,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-25T17:30:50Z",
    metadata: {
      prospect_name: "Manoj Kumar",
      lead_source: "referral",
      property_type: "2bhk_apartment",
      budget_range: "42-52L",
      location_preference: "BTM Layout",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 71
    },
    transcription_metrics: {
      total_words: 367,
      agent_words: 223,
      prospect_words: 144,
      avg_confidence: 0.90,
      silence_percentage: 6.1,
      agent_talk_ratio: 0.61,
      interruptions_count: 2,
      questions_asked_agent: 12,
      questions_asked_prospect: 6,
      positive_sentiment_words: 17,
      negative_sentiment_words: 2,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 1,
      interest_level_score: 0.75,
      engagement_score: 0.78
    }
  },
  {
    id: "19",
    call_id: "call_019_pqr456stu789",
    customer_number: "+91-3678901235",
    call_ended_reason: "completed",
    call_started_at: "2025-08-24T09:20:15Z",
    call_ended_at: "2025-08-24T09:27:42Z",
    duration_seconds: 447,
    recording_url: "https://example.com/recordings/call_019.mp3",
    total_llm_cost: 26.78,
    total_tts_cost: 18.34,
    total_stt_cost: 9.67,
    avg_latency: 0.6,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-24T09:20:15Z",
    metadata: {
      prospect_name: "Shreya Rao",
      lead_source: "linkedin",
      property_type: "4bhk_villa",
      budget_range: "1.2-1.8Cr",
      location_preference: "Whitefield",
      follow_up_required: false,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: true,
      visit_booked_human: true,
      deal_progressed: true,
      lead_score: 94
    },
    transcription_metrics: {
      total_words: 634,
      agent_words: 378,
      prospect_words: 256,
      avg_confidence: 0.98,
      silence_percentage: 2.9,
      agent_talk_ratio: 0.60,
      interruptions_count: 0,
      questions_asked_agent: 21,
      questions_asked_prospect: 14,
      positive_sentiment_words: 38,
      negative_sentiment_words: 0,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: true,
      objections_raised: 0,
      interest_level_score: 0.96,
      engagement_score: 0.98
    }
  },
  {
    id: "20",
    call_id: "call_020_vwx012yza345",
    customer_number: "+91-2789012346",
    call_ended_reason: "completed",
    call_started_at: "2025-08-24T10:45:30Z",
    call_ended_at: "2025-08-24T10:49:15Z",
    duration_seconds: 225,
    recording_url: "https://example.com/recordings/call_020.mp3",
    total_llm_cost: 13.21,
    total_tts_cost: 9.12,
    total_stt_cost: 4.76,
    avg_latency: 1.2,
    environment: "production",
    transcript_type: "automated",
    transcript_json: {},
    created_at: "2025-08-24T10:45:30Z",
    metadata: {
      prospect_name: "Naveen Reddy",
      lead_source: "facebook_ads",
      property_type: "3bhk_apartment",
      budget_range: "58-75L",
      location_preference: "Electronic City",
      follow_up_required: true,
      qualified_lead: true,
      interested_in_visit: true,
      visit_booked_ai: false,
      visit_booked_human: false,
      deal_progressed: false,
      lead_score: 66
    },
    transcription_metrics: {
      total_words: 289,
      agent_words: 174,
      prospect_words: 115,
      avg_confidence: 0.87,
      silence_percentage: 7.5,
      agent_talk_ratio: 0.60,
      interruptions_count: 3,
      questions_asked_agent: 10,
      questions_asked_prospect: 5,
      positive_sentiment_words: 12,
      negative_sentiment_words: 3,
      budget_mentioned: true,
      location_mentioned: true,
      timeline_mentioned: false,
      objections_raised: 2,
      interest_level_score: 0.68,
      engagement_score: 0.72
    }
  }
]

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
}

function flattenAndPickColumns(
  row: CallLog,
  basic: string[],
  metadata: string[],
  transcription: string[]
): Record<string, any> {
  const flat: Record<string, any> = {};

  // Basic columns (skip "total_cost")
  for (const key of basic) {
    if (key in row) {
      flat[key] = row[key as keyof CallLog];
    }
  }

  // Metadata columns
  if (row.metadata && typeof row.metadata === "object") {
    for (const key of metadata) flat[key] = row.metadata[key];
  }

  // Transcription metrics columns
  if (row.transcription_metrics && typeof row.transcription_metrics === "object") {
    for (const key of transcription) flat[key] = row.transcription_metrics[key];
  }

  return flat;
}

const TruncatedText: React.FC<{ 
  text: string; 
  maxLength?: number;
  className?: string;
}> = ({ text, maxLength = 30, className = "" }) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  
  return (
    <span 
      className={cn("break-words", className)}
      title={text.length > maxLength ? text : undefined}
    >
      {truncated}
    </span>
  )
}

// Dynamic JSON Cell Component - Fixed version with better text handling
const DynamicJsonCell: React.FC<{ 
  data: any; 
  fieldKey: string;
  maxWidth?: string;
}> = ({ data, fieldKey, maxWidth = "180px" }) => {
  if (!data || typeof data !== 'object') {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const value = data[fieldKey]
  
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  // Handle different data types
  if (typeof value === 'object') {
    const jsonString = JSON.stringify(value, null, 2)
    const truncatedJson = jsonString.length > 80 ? jsonString.substring(0, 80) + '...' : jsonString
    
    return (
      <div 
        className="w-full max-w-full overflow-hidden border rounded-md bg-muted/20"
        style={{ maxWidth }}
      >
        <div className="p-1.5 w-full overflow-hidden">
          <pre 
            className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden w-full"
            style={{ 
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
              maxWidth: '100%'
            }}
            title={jsonString}
          >
            {truncatedJson}
          </pre>
        </div>
      </div>
    )
  }

  // Handle primitive values - truncate long strings
  const stringValue = String(value)
  const shouldTruncate = stringValue.length > 25
  const displayValue = shouldTruncate ? stringValue.substring(0, 25) + '...' : stringValue

  return (
    <div 
      className="text-xs w-full overflow-hidden" 
      style={{ maxWidth }}
    >
      <span 
        className="text-foreground font-medium block w-full overflow-hidden"
        style={{ 
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={shouldTruncate ? stringValue : undefined}
      >
        {displayValue}
      </span>
    </div>
  )
}

const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {

  const basicColumns = useMemo(
    () => [
      { key: "customer_number", label: "Customer Number" },
      { key: "call_id", label: "Call ID" },
      { key: "call_ended_reason", label: "Call Status" },
      { key: "duration_seconds", label: "Duration" },
      {
        key: "total_cost",
        label: "Total Cost (₹)",
      },
      { key: "call_started_at", label: "Start Time" },
      { key: "avg_latency", label: "Avg Latency (ms)" },
      { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
      { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
      { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
    ],
    [],
  )

  const ROLE_RESTRICTIONS = {
    user: [
      'total_cost',
      'total_llm_cost', 
      'total_tts_cost',
      'total_stt_cost',
      'avg_latency'
    ],
    // Add other role restrictions as needed
    // viewer: ['total_cost'],
    // editor: [], // No restrictions
    // admin: []  // No restrictions
  }

  const isColumnVisibleForRole = (columnKey: string, role: string | null): boolean => {
    if (!role) return false
    
    const restrictedColumns = ROLE_RESTRICTIONS[role as keyof typeof ROLE_RESTRICTIONS]
    if (!restrictedColumns) return true // If role not in restrictions, show all
    
    return !restrictedColumns.includes(columnKey)
  }

  const [roleLoading, setRoleLoading] = useState(true) // Add loading state for role
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: basicColumns.filter(col => !col.hidden).map(col => col.key), // initially show all
    metadata: [],
    transcription_metrics: []
  })

  const getFilteredBasicColumns = useMemo(() => {
    return basicColumns.filter(col => 
      !col.hidden && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  // Convert FilterRule[] to Supabase filter format
  const convertToSupabaseFilters = (filters: FilterRule[]) => {
    const supabaseFilters = [{ column: "agent_id", operator: "eq", value: agent.id }]
    
    filters.forEach(filter => {
      // Determine the column name (with JSONB path if applicable)
      // Use ->> for text operations, -> for existence checks and numeric comparisons
      const getColumnName = (forTextOperation = false) => {
        if (!filter.jsonField) return filter.column
        
        if (forTextOperation) {
          return `${filter.column}->>${filter.jsonField}` // Double arrow for text extraction
        } else {
          return `${filter.column}->${filter.jsonField}` // Single arrow for JSONB data
        }
      }
      
      switch (filter.operation) {
        // Regular operations
        case 'equals':
          if (filter.column === 'call_started_at') {
            const startOfDay = `${filter.value} 00:00:00`
            const endOfDay = `${filter.value} 23:59:59.999`
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'gte', 
              value: startOfDay
            })
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lte', 
              value: endOfDay
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'eq', 
              value: filter.value 
            })
          }
          break
          
        case 'contains':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'starts_with':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `${filter.value}%` 
          })
          break
          
        case 'greater_than':
          if (filter.column === 'call_started_at') {
            const nextDay = new Date(filter.value)
            nextDay.setDate(nextDay.getDate() + 1)
            const nextDayStr = nextDay.toISOString().split('T')[0]
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'gte', 
              value: `${nextDayStr} 00:00:00`
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'gt', 
              value: filter.value 
            })
          }
          break
          
        case 'less_than':
          if (filter.column === 'call_started_at') {
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lt', 
              value: `${filter.value} 00:00:00`
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'lt', 
              value: filter.value 
            })
          }
          break
  
        // JSONB-specific operations
        case 'json_equals':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text comparison
            operator: 'eq', 
            value: filter.value 
          })
          break
          
        case 'json_contains':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'json_greater_than':
          // For numeric JSONB fields, use -> and cast to numeric
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'gt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_less_than':
          // For numeric JSONB fields, use -> and cast to numeric
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'lt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_exists':
          // Check if the JSONB field exists (is not null)
          supabaseFilters.push({ 
            column: getColumnName(false), // Use -> for existence check
            operator: 'not.is', 
            value: null 
          })
          break
          
        default:
          console.warn(`Unknown filter operation: ${filter.operation}`)
          break
      }
    })
    
    return supabaseFilters
  }

  const handleColumnChange = (type: 'basic' | 'metadata' | 'transcription_metrics', column: string, visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible 
        ? [...prev[type], column]
        : prev[type].filter(col => col !== column)
    }))
    }
    
    const handleSelectAll = (type: 'basic' | 'metadata' | 'transcription_metrics', visible: boolean) => {
      setVisibleColumns(prev => ({
        ...prev,
        [type]: visible
          ? (type === "basic" ? basicColumns.map(col => col.key) : dynamicColumns[type])
          : []
      }))
    }

  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress

  // Load user role first
  useEffect(() => {
    if (userEmail) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail, project.id)
          setRole(userRole)
        } catch (error) {
          console.error('Failed to load user role:', error)
          setRole('user') // Default to most restrictive role on error
        } finally {
          setRoleLoading(false)
        }
      }
      getUserRole()
    } else {
      setRoleLoading(false)
      setRole('user') // Default when no user email
    }
  }, [userEmail, project.id])

  // Update visible columns when role changes
  useEffect(() => {
    if (role !== null) {
      const allowedBasicColumns = getFilteredBasicColumns.map(col => col.key)
      setVisibleColumns(prev => ({
        ...prev,
        basic: allowedBasicColumns
      }))
    }
  }, [role, getFilteredBasicColumns])

  const queryOptions = useMemo(() => {
    // Build select clause based on role permissions
    let selectColumns = [
      'id',
      'call_id',
      'customer_number',
      'call_ended_reason',
      'call_started_at',
      'call_ended_at',
      'duration_seconds',
      'recording_url',
      'metadata',
      'environment',
      'transcript_type',
      'transcript_json',
      'created_at',
      'transcription_metrics',
      'total_llm_cost',
      'total_tts_cost',
      'total_stt_cost',
      'avg_latency'
    ]

    // Add role-restricted columns only if user has permission
    if (isColumnVisibleForRole('avg_latency', role)) {
      selectColumns.push('avg_latency')
    }
    
    if (isColumnVisibleForRole('total_llm_cost', role)) {
      selectColumns.push('total_llm_cost', 'total_tts_cost', 'total_stt_cost')
    }

    return {
      select: selectColumns.join(','),
      filters: convertToSupabaseFilters(activeFilters),
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }
  }, [agent.id, activeFilters, role])

  // Mock implementation to replace useInfiniteScroll with dummy data
  const [calls, setCalls] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simulate loading and filtering dummy data
  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      let filteredCalls = DUMMY_CALLS
      
      // Apply basic filtering (simplified)
      if (activeFilters.length > 0) {
        filteredCalls = DUMMY_CALLS.filter(call => {
          return activeFilters.every(filter => {
            if (filter.column === 'call_ended_reason') {
              return call.call_ended_reason === filter.value
            }
            if (filter.column === 'customer_number') {
              return call.customer_number.includes(filter.value)
            }
            // Add more filter logic as needed
            return true
          })
        })
      }
      
      const withAgent = filteredCalls.map((call) => ({ ...call, agent_id: agent.id }))
      setCalls(withAgent as CallLog[])
      setHasMore(false)
      setLoading(false)
    }, 500) // Simulate network delay
  }, [activeFilters])

  const loadMore = () => {
    // Mock implementation - no more data to load
  }

  const refresh = () => {
    setLoading(true)
    setTimeout(() => {
      const withAgent = DUMMY_CALLS.map((call) => ({ ...call, agent_id: agent.id }))
      setCalls(withAgent as CallLog[])
      setLoading(false)
    }, 300)
  }

  console.log(calls)
  // Extract all unique keys from metadata and transcription_metrics across all calls
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()

    // Defensive check - ensure calls is an array before iterating
    if (Array.isArray(calls)) {
      calls.forEach((call: CallLog) => {
        // Extract metadata keys
        if (call.metadata && typeof call.metadata === 'object') {
          Object.keys(call.metadata).forEach(key => metadataKeys.add(key))
        }

        // Extract transcription_metrics keys
        if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
          Object.keys(call.transcription_metrics).forEach(key => transcriptionKeys.add(key))
        }
      })
    }

    return {
      metadata: Array.from(metadataKeys).sort(),
      transcription_metrics: Array.from(transcriptionKeys).sort()
    }
  }, [calls])

  // Initialize visible columns when dynamic columns change
  useEffect(() => {
    setVisibleColumns((prev) => ({
      basic: prev.basic ?? basicColumns.map((col) => col.key),
      metadata: Array.from(
        new Set(
          (prev.metadata.length === 0 ? dynamicColumns.metadata : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col)))
        )
      ),
      transcription_metrics: Array.from(
        new Set(
          (prev.transcription_metrics.length === 0 ? dynamicColumns.transcription_metrics : prev.transcription_metrics.filter((col) => dynamicColumns.transcription_metrics.includes(col)))
        )
      ),
    }))
  }, [dynamicColumns, basicColumns])
  
  // Fixed handleDownloadCSV function (no supabase dependency)
  const handleDownloadCSV = async () => {
    try {
      const { basic, metadata, transcription_metrics } = visibleColumns

      // Use currently loaded calls for export (keeps export consistent with visible data)
      if (!calls || calls.length === 0) {
        alert('No data available to export')
        return
      }

      const csvData = (calls as CallLog[]).map((row, index) =>
        flattenAndPickColumnsFixed(row, basic, metadata, transcription_metrics)
      )

      if (csvData.length === 0) {
        alert('No data available to export')
        return
      }

      const csv = Papa.unparse(csvData)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `call_logs_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download CSV: ' + (error as Error).message)
    }
  }

  // Fixed flatten function with better debugging
  function flattenAndPickColumnsFixed(
    row: CallLog,
    basic: string[],
    metadata: string[],
    transcription: string[]
  ): Record<string, any> {
    const flat: Record<string, any> = {};

    console.log('Flattening row:', {
      id: row.id,
      hasMetadata: !!row.metadata,
      hasTranscription: !!row.transcription_metrics,
      metadataType: typeof row.metadata,
      transcriptionType: typeof row.transcription_metrics
    });

    // Basic columns (exclude "total_cost" as it's calculated)
    for (const key of basic) {
      if (key in row && key !== 'total_cost') {
        flat[key] = row[key as keyof CallLog];
      }
    }

    // Add calculated total_cost if requested
    if (basic.includes('total_cost')) {
      const totalCost = (row.total_llm_cost || 0) + (row.total_tts_cost || 0) + (row.total_stt_cost || 0);
      flat['total_cost'] = totalCost;
    }

    // Metadata columns - FIXED
    if (row.metadata && typeof row.metadata === "object" && metadata.length > 0) {
      console.log('Processing metadata fields:', metadata);
      console.log('Available metadata keys:', Object.keys(row.metadata));
      
      for (const key of metadata) {
        const value = row.metadata[key];
        // Prefix with 'metadata_' to avoid column name conflicts
        flat[`metadata_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (metadata.length > 0) {
      // Add empty values for missing metadata
      for (const key of metadata) {
        flat[`metadata_${key}`] = '';
      }
    }

    // Transcription metrics columns - FIXED
    if (row.transcription_metrics && typeof row.transcription_metrics === "object" && transcription.length > 0) {
      console.log('Processing transcription fields:', transcription);
      console.log('Available transcription keys:', Object.keys(row.transcription_metrics));
      
      for (const key of transcription) {
        const value = row.transcription_metrics[key];
        // Prefix with 'transcription_' to avoid column name conflicts
        flat[`transcription_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (transcription.length > 0) {
      // Add empty values for missing transcription_metrics
      for (const key of transcription) {
        flat[`transcription_${key}`] = '';
      }
    }

    console.log('Final flattened keys:', Object.keys(flat));
    return flat;
  }

  // Calculate total dynamic columns for table width
  const totalVisibleColumns = visibleColumns.metadata.length + visibleColumns.transcription_metrics.length
  const baseWidth = 1020 // Fixed columns width
  const dynamicWidth = totalVisibleColumns * 200 // 200px per dynamic column
  const minTableWidth = baseWidth + dynamicWidth

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refresh()
  }, [activeFilters])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  const handleFiltersChange = (filters: FilterRule[]) => {
    setActiveFilters(filters)
    setTimeout(() => refresh(), 100)
  }

  const handleClearFilters = () => {
    setActiveFilters([])
    setTimeout(() => refresh(), 100)
  }

  const handleRefresh = () => {
    refresh()
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatToIndianDateTime = (timestamp: any) => {
    const date = new Date(timestamp)
    const indianTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
    
    return indianTime.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Unable to load calls</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header with Filters and Column Selector */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
            availableMetadataFields={dynamicColumns.metadata}
            availableTranscriptionFields={dynamicColumns.transcription_metrics}
          />
          
          <div className="flex items-center gap-2">
          <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={loading}
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={basicColumns.map((col) => col.key)}
              basicColumnLabels={Object.fromEntries(basicColumns.filter(col => !col.hidden).map((col) => [col.key, col.label]))}
              metadataColumns={dynamicColumns.metadata}
              transcriptionColumns={dynamicColumns.transcription_metrics}
              visibleColumns={visibleColumns}
              onColumnChange={handleColumnChange}
              onSelectAll={handleSelectAll}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2 h-8 w-8 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
          </div>
        </div>
      </div>

      {/* Horizontally Scrollable Table Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
      {loading && (!calls || calls.length === 0) ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading calls...</p>
            </div>
          </div>
        ) : (!calls || calls.length === 0) && !loading ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {activeFilters.length > 0 ? "No calls match your filters" : "No calls found"}
            </h3>
            <p className="text-muted-foreground">
              {activeFilters.length > 0
                ? "Try adjusting your filters to find what you're looking for."
                : "Calls will appear here once your agent starts handling conversations."}
            </p>
          </div>
          ) : (
      <div className="h-full overflow-x-auto overflow-y-hidden"> {/* Horizontal scroll container */}
        <div className="h-full overflow-y-auto" style={{ minWidth: `${minTableWidth}px` }}> {/* Vertical scroll with min-width */}
          <Table className="w-full ">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                  <TableRow className="bg-muted/80 hover:bg-muted/80">
                    {/* Fixed Columns */}
                    {visibleColumns.basic.map((key) => {
                      const col = basicColumns.find((c) => c.key === key)
                      return (
                        <TableHead key={`basic-${key}`} className="font-semibold text-foreground min-w-[120px]">
                          {col?.label ?? key}
                        </TableHead>
                      )
                    })}

                    {/* Dynamic Metadata Columns */}
                    {visibleColumns.metadata.map((key) => (
                      <TableHead 
                        key={`metadata-${key}`} 
                        className="w-[200px] font-semibold text-foreground bg-blue-50/50 dark:bg-blue-950/20 border-r border-blue-200/50"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                    
                    {/* Dynamic Transcription Metrics Columns */}
                    {visibleColumns.transcription_metrics.map((key, index) => (
                      <TableHead 
                        key={`transcription-${key}`} 
                        className={cn(
                          "w-[200px] font-semibold text-foreground bg-blue-50/50 dark:bg-blue-950/20",
                          index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30",
                          index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-auto">
                  {calls?.map((call: CallLog) => (
                    <TableRow
                      key={call.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/30 transition-all duration-200 border-b border-border/50",
                        selectedCall?.id === call.id && "bg-muted/50",
                      )}
                      onClick={() => setSelectedCall(call)}
                    >
              {visibleColumns.basic.map((key) => {
                let value: React.ReactNode = "-"

                switch (key) {
                  case "customer_number":
                    value = (
                      <div className="flex w-full items-center gap-3">
                        <div className="w-10 h-8 rounded-full  flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{call.customer_number}</span>
                      </div>
                    )
                    break
                  case "call_id":
                    value = (
                      <code className="text-xs bg-muted/60 px-3 py-1.5 rounded-md font-mono">
                        {call.call_id?.slice(-8) || 'N/A'}
                      </code>
                    )
                    break
                  case "call_ended_reason":
                    value = (
                      <Badge
                        variant={call.call_ended_reason === "completed" ? "default" : "destructive"}
                        className="text-xs font-medium px-2.5 py-1"
                      >
                        {call.call_ended_reason === "completed" ? (
                          <CheckCircle className="w-3 h-3 mr-1.5" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1.5" />
                        )}
                        {call.call_ended_reason}
                      </Badge>
                    )
                    break
                  case "duration_seconds":
                    value = (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    )
                    break
                  case "call_started_at":
                    value = formatToIndianDateTime(call.call_started_at)
                    break
                  case "avg_latency":
                    value = call?.avg_latency ? (
                      <span className="font-mono">{call.avg_latency.toFixed(2)}s</span>
                    ) : "-"
                    break
                  case "total_cost":
                    value = call?.total_llm_cost || call?.total_tts_cost || call?.total_stt_cost ? (
                      <CostTooltip call={call}/>
                    ) : "-"
                    break
                }

                return (
                  <TableCell key={`basic-${call.id}-${key}`} className="py-4">
                    {value}
                  </TableCell>
                )
              })}
              {/* Dynamic Metadata Columns */}
              {visibleColumns.metadata.map((key) => (
                <TableCell 
                  key={`metadata-${call.id}-${key}`} 
                  className="py-4 bg-blue-50/30 dark:bg-blue-950/10 border-r border-blue-200/50"
                >
                  <DynamicJsonCell 
                    data={call.metadata} 
                    fieldKey={key}
                    maxWidth="180px"
                  />
                </TableCell>
              ))}

              {/* Dynamic Transcription Metrics Columns */}
              {visibleColumns.transcription_metrics.map((key, index) => (
                <TableCell 
                  key={`transcription-${call.id}-${key}`} 
                  className={cn(
                    "py-4 bg-blue-50/30 dark:bg-blue-950/10",
                    index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30",
                    index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50"
                  )}
                >
                  <DynamicJsonCell 
                    data={call.transcription_metrics} 
                    fieldKey={key}
                    maxWidth="180px"
                  />
                </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
                {/* Load More Trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="py-6 border-t">
                    {loading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                  </div>
                )}

                {/* End of List */}
                {!hasMore && calls && calls.length > 0 && (
                  <div className="py-4 text-muted-foreground text-sm border-t">
                    All calls loaded ({calls?.length || 0} total)
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
      <CallDetailsDrawer 
        isOpen={!!selectedCall} 
        callData={selectedCall} 
        onClose={() => setSelectedCall(null)} 
      />
    </div>
  )
}

export default CallLogs