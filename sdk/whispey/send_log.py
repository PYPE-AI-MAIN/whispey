# sdk/whispey/send_log.py
import os
import json
import asyncio
import aiohttp
import gzip
import base64
import uuid
from datetime import datetime
from dotenv import load_dotenv


load_dotenv()

# Configuration
WHISPEY_API_URL = "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"
WHISPEY_API_KEY = os.getenv("WHISPEY_API_KEY")
# WHISPEY_API_URL = "http://localhost:3000/dev/send-call-log"  # Direct to your self-hosted instance

# Compression settings
COMPRESSION_THRESHOLD = 10 * 1024  # 10KB - compress if larger than this

# Two-phase send threshold
# If payload > 4MB after compression, split into core + detailed
TWO_PHASE_THRESHOLD = 4 * 1024 * 1024  # 4MB

def convert_timestamp(timestamp_value):
    """
    Convert various timestamp formats to ISO format string
    
    Args:
        timestamp_value: Can be number (Unix timestamp), string (ISO), or datetime object
        
    Returns:
        str: ISO format timestamp string
    """
    
    if timestamp_value is None:
        return None
    
    # If it's already a string, assume it's ISO format
    if isinstance(timestamp_value, str):
        return timestamp_value
    
    # If it's a datetime object, convert to ISO format
    if isinstance(timestamp_value, datetime):
        return timestamp_value.isoformat()
    
    # If it's a number, assume it's Unix timestamp
    if isinstance(timestamp_value, (int, float)):
        try:
            dt = datetime.fromtimestamp(timestamp_value)
            return dt.isoformat()
        except (ValueError, OSError):
            return str(timestamp_value)
    
    # Default: convert to string
    return str(timestamp_value)

def compress_data(data):
    """
    Compress data using gzip and encode as base64
    
    Args:
        data (dict): Data to compress
        
    Returns:
        str: Compressed and base64 encoded data
    """
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')

def get_payload_size(data):
    """
    Get the size of JSON serialized data in bytes
    
    Args:
        data (dict): Data to measure
        
    Returns:
        int: Size in bytes
    """
    return len(json.dumps(data).encode('utf-8'))

def should_compress(data):
    """
    Determine if data should be compressed based on size
    
    Args:
        data (dict): Data to check
        
    Returns:
        bool: True if data should be compressed
    """
    return get_payload_size(data) > COMPRESSION_THRESHOLD

def split_data_for_two_phase(data):
    """
    Split data into core (essential) and detailed (large) payloads
    
    Args:
        data (dict): Full data payload
        
    Returns:
        tuple: (core_data, detailed_data)
    """
    # Core data - essential fields only (should be <500KB)
    # Ensure duration_seconds is an integer or None
    duration_seconds = data.get("duration_seconds")
    if duration_seconds is not None:
        try:
            duration_seconds = int(duration_seconds)
        except (ValueError, TypeError):
            duration_seconds = None
    
    billing_duration_seconds = data.get("billing_duration_seconds")
    if billing_duration_seconds is not None:
        try:
            billing_duration_seconds = int(billing_duration_seconds)
        except (ValueError, TypeError):
            billing_duration_seconds = None
    
    # Debug logging
    print(f"📊 Duration validation - duration_seconds: {duration_seconds} (type: {type(duration_seconds)}), billing: {billing_duration_seconds} (type: {type(billing_duration_seconds)})")
    
    core_data = {
        "call_id": data.get("call_id"),
        "agent_id": data.get("agent_id"),
        "customer_number": data.get("customer_number"),
        "call_ended_reason": data.get("call_ended_reason"),
        "call_started_at": data.get("call_started_at"),
        "call_ended_at": data.get("call_ended_at"),
        "duration_seconds": duration_seconds,
        "billing_duration_seconds": billing_duration_seconds,
        "recording_url": data.get("recording_url"),
        "voice_recording_url": data.get("voice_recording_url"),
        "transcript_type": data.get("transcript_type"),
        "environment": data.get("environment", "dev"),
        
        # Simplified transcript - just text, no detailed metrics
        "transcript_json": data.get("transcript_json", []),
        
        # Summary metrics only - aggregated from transcript_with_metrics
        "summary_metrics": _create_summary_metrics(data),
        
        # Telemetry summary only - NOT full spans
        "telemetry_summary": _create_telemetry_summary(data.get("telemetry_data")),
        
        # Essential metadata only
        "metadata": {
            "usage": data.get("metadata", {}).get("usage", {}),
            "duration_formatted": data.get("metadata", {}).get("duration_formatted", ""),
            # Don't include complete_configuration here - it's large
        },
        
        # Dynamic variables
        "dynamic_variables": data.get("dynamic_variables"),
    }
    
    # Detailed data - large fields that can be sent later
    detailed_data = {
        "call_id": data.get("call_id"),
        "update_type": "detailed_telemetry",  # Flag for Lambda to know this is phase 2
        
        # Full transcript with all metrics
        "transcript_with_metrics": data.get("transcript_with_metrics", []),
        
        # Full telemetry data with all spans
        "telemetry_data": data.get("telemetry_data", {}),
        
        # Complete metadata
        "metadata": data.get("metadata", {}),
    }
    
    return core_data, detailed_data

def _create_summary_metrics(data):
    """Create aggregated summary from transcript_with_metrics"""
    transcript_with_metrics = data.get("transcript_with_metrics", [])
    
    if not transcript_with_metrics:
        return {
            "total_turns": 0,
            "avg_latency": None,
            "total_llm_tokens": 0,
            "total_tts_characters": 0,
            "total_stt_duration": 0
        }
    
    # Aggregate metrics
    total_turns = len(transcript_with_metrics)
    latencies = []
    llm_tokens = 0
    tts_chars = 0
    stt_duration = 0
    
    for turn in transcript_with_metrics:
        # Skip None or invalid turns
        if not turn or not isinstance(turn, dict):
            continue
        
        # Calculate latency for this turn
        llm_ttft = turn.get("llm_metrics", {}).get("ttft", 0) or 0
        tts_ttfb = turn.get("tts_metrics", {}).get("ttfb", 0) or 0
        eou_delay = turn.get("eou_metrics", {}).get("end_of_utterance_delay", 0) or 0
        
        total_latency = eou_delay + llm_ttft + tts_ttfb
        if total_latency > 0:
            latencies.append(total_latency)
        
        # Aggregate usage
        llm_tokens += turn.get("llm_metrics", {}).get("prompt_tokens", 0) or 0
        llm_tokens += turn.get("llm_metrics", {}).get("completion_tokens", 0) or 0
        tts_chars += turn.get("tts_metrics", {}).get("characters_count", 0) or 0
        stt_duration += turn.get("stt_metrics", {}).get("audio_duration", 0) or 0
    
    return {
        "total_turns": total_turns,
        "avg_latency": sum(latencies) / len(latencies) if latencies else None,
        "total_llm_tokens": llm_tokens,
        "total_tts_characters": tts_chars,
        "total_stt_duration": stt_duration
    }

def _create_telemetry_summary(telemetry_data):
    """Create summary from full telemetry data (don't send all spans)"""
    if not telemetry_data:
        return {
            "total_spans": 0,
            "performance_metrics": {}
        }
    
    return {
        "total_spans": len(telemetry_data.get("session_traces", [])),
        "performance_metrics": telemetry_data.get("performance_metrics", {}),
        "operation_breakdown": telemetry_data.get("span_summary", {}).get("by_operation", {}),
        # Don't include session_traces here - too large
    }

async def send_to_whispey(data, apikey=None, api_url=None):
    """
    Send data to Whispey API with automatic two-phase send for large payloads
    
    Strategy:
    - Small payloads (<4MB after compression): Send directly
    - Large payloads (>=4MB after compression): 
        1. Send core data first (fast acknowledgment)
        2. Send detailed data async (doesn't block)
    
    Args:
        data (dict): The data to send to the API
        apikey (str, optional): Custom API key to use. If not provided, uses WHISPEY_API_KEY environment variable
        api_url (str, optional): Custom API URL to use
    
    Returns:
        dict: Response from the API or error information
    """
    
    # Handle call_ended_reason - set default to "completed" if not provided
    if "call_ended_reason" not in data:
        data["call_ended_reason"] = "completed"
    
    # Convert timestamp fields to proper ISO format
    if "call_started_at" in data:
        data["call_started_at"] = convert_timestamp(data["call_started_at"])
    if "call_ended_at" in data:
        data["call_ended_at"] = convert_timestamp(data["call_ended_at"])
    
    # Use custom API key if provided, otherwise fall back to environment variable
    api_key_to_use = apikey if apikey is not None else WHISPEY_API_KEY
    
    # Validate API key
    if not api_key_to_use:
        error_msg = "API key not provided and WHISPEY_API_KEY environment variable not set"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
    
    # Determine target URL (overrideable)
    url_to_use = api_url if api_url else WHISPEY_API_URL
    
    # Check payload size
    original_size = get_payload_size(data)
    print(f"📊 Original payload size: {original_size:,} bytes ({original_size/1024/1024:.2f} MB)")
    
    # Try compression first
    compressed_data = None
    compressed_size = original_size
    
    if should_compress(data):
        print(f"🗜️  Compressing data (threshold: {COMPRESSION_THRESHOLD/1024:.1f}KB)...")
        try:
            compressed_data = compress_data(data)
            compressed_size = len(compressed_data.encode('utf-8'))
            compression_ratio = (1 - compressed_size / original_size) * 100
            
            print(f"✅ Compression successful: {compressed_size:,} bytes ({compressed_size/1024/1024:.2f} MB)")
            print(f"📈 Compression ratio: {compression_ratio:.1f}% reduction")
            
        except Exception as e:
            print(f"⚠️  Compression failed: {e}, will send uncompressed")
            compressed_data = None
    
    # Decision point: Single send or two-phase send?
    if compressed_size >= TWO_PHASE_THRESHOLD:
        print(f"📦 Payload large ({compressed_size/1024/1024:.2f} MB >= {TWO_PHASE_THRESHOLD/1024/1024:.0f} MB)")
        print(f"🔄 Using two-phase send strategy...")
        
        # Split data
        core_data, detailed_data = split_data_for_two_phase(data)
        
        # Phase 1: Send core data (IMMEDIATE - blocks until done)
        print(f"📤 Phase 1: Sending core data...")
        core_result = await _send_payload(core_data, api_key_to_use, url_to_use)
        
        if not core_result.get("success"):
            print(f"❌ Phase 1 failed: {core_result.get('error')}")
            return core_result
        
        print(f"✅ Phase 1 complete - Call logged successfully")
        
        # Phase 2: Send detailed data (ASYNC - doesn't block)
        print(f"📤 Phase 2: Sending detailed data in background...")
        asyncio.create_task(
            _send_detailed_data_async(detailed_data, api_key_to_use, url_to_use)
        )
        
        return {
            "success": True,
            "status": 200,
            "data": core_result.get("data"),
            "upload_method": "two_phase",
            "phase_1_complete": True,
            "phase_2_started": True
        }
    
    # Small payload - single send (existing logic)
    print(f"📤 Payload size OK ({compressed_size/1024/1024:.2f} MB < {TWO_PHASE_THRESHOLD/1024/1024:.0f} MB)")
    print(f"📤 Sending in single request...")
    
    result = await _send_payload(data, api_key_to_use, url_to_use, compressed_data)
    
    if result.get("success"):
        result["upload_method"] = "single"
    
    return result

async def _send_payload(data, api_key, url, compressed_data=None):
    """
    Internal function to send a payload to the API
    
    Args:
        data (dict): Data to send
        api_key (str): API key
        url (str): Target URL
        compressed_data (str, optional): Pre-compressed data
        
    Returns:
        dict: Response from API
    """
    # Prepare payload
    if compressed_data:
        payload = {
            "compressed": True,
            "data": compressed_data,
            "original_size": get_payload_size(data),
            "compressed_size": len(compressed_data.encode('utf-8')),
            "compression_ratio": (1 - len(compressed_data.encode('utf-8')) / get_payload_size(data)) * 100
        }
    else:
        # Try to compress this specific payload
        if should_compress(data):
            try:
                compressed = compress_data(data)
                payload = {
                    "compressed": True,
                    "data": compressed,
                    "original_size": get_payload_size(data),
                    "compressed_size": len(compressed.encode('utf-8')),
                }
            except Exception:
                payload = data
        else:
            payload = data
    
    # Headers
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": api_key
    }
    
    headers = {k: v for k, v in headers.items() if k is not None and v is not None}
    
    try:
        # Test JSON serialization first
        json_str = json.dumps(payload)
        print(f"✅ JSON serialization OK ({len(json_str):,} chars)")
        
        # Send the request
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as response:
                print(f"📡 Response status: {response.status}")
                
                if response.status >= 400:
                    error_text = await response.text()
                    print(f"❌ Error response: {error_text}")
                    return {
                        "success": False,
                        "status": response.status,
                        "error": error_text
                    }
                else:
                    result = await response.json()
                    print(f"✅ Successfully sent data")
                    return {
                        "success": True,
                        "status": response.status,
                        "data": result
                    }
                    
    except (TypeError, ValueError) as e:
        error_msg = f"JSON serialization failed: {e}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
    except Exception as e:
        error_msg = f"Request failed: {e}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }

async def _send_detailed_data_async(detailed_data, api_key, url):
    """
    Background task to send detailed data (Phase 2)
    
    Args:
        detailed_data (dict): Detailed telemetry data
        api_key (str): API key
        url (str): Target URL
    """
    try:
        print(f"🔄 Background: Starting Phase 2 send...")
        result = await _send_payload(detailed_data, api_key, url)
        
        if result.get("success"):
            print(f"✅ Background: Phase 2 complete - Detailed data sent")
        else:
            print(f"⚠️ Background: Phase 2 failed - {result.get('error')}")
            print(f"   This is non-critical - core data was already saved")
            
    except Exception as e:
        print(f"⚠️ Background: Phase 2 exception - {e}")
        print(f"   This is non-critical - core data was already saved")
