# sdk/whispey/send_log.py
import os
import json
import asyncio
import aiohttp
import gzip
import base64
from datetime import datetime
from dotenv import load_dotenv


load_dotenv()

# Configuration
WHISPEY_API_URL = "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"
WHISPEY_API_KEY = os.getenv("WHISPEY_API_KEY")
# WHISPEY_API_URL = "http://localhost:3000/dev/send-call-log"  # Direct to your self-hosted instance

# Compression settings
COMPRESSION_THRESHOLD = 10 * 1024  # 10KB - compress if larger than this

# S3 upload settings (for very large payloads)
S3_UPLOAD_THRESHOLD = 5 * 1024 * 1024  # 5MB - use S3 if larger than this
USE_S3_FOR_LARGE = os.getenv("WHISPEY_USE_S3", "true").lower() == "true"
S3_AUTO_TRIGGER = os.getenv("WHISPEY_S3_AUTO_TRIGGER", "true").lower() == "true"  # If true, Lambda auto-triggers from S3

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

async def get_s3_upload_url(call_id, apikey, api_url):
    """
    Request a pre-signed S3 upload URL from Lambda
    No AWS credentials needed!
    
    Args:
        call_id (str): Call ID for tracking
        apikey (str): API key for authentication
        api_url (str): Base API URL
        
    Returns:
        tuple: (upload_url, s3_key, s3_bucket)
    """
    url = api_url.replace('/send-call-log', '/get-upload-url')
    
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": apikey
    }
    
    payload = {
        "call_id": call_id,
        "content_type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as response:
            if response.status == 200:
                result = await response.json()
                return result['upload_url'], result['s3_key'], result.get('s3_bucket', 'pype-voice-call-logs')
            else:
                error_text = await response.text()
                raise Exception(f"Failed to get upload URL ({response.status}): {error_text}")

async def upload_to_s3_presigned(data, upload_url):
    """
    Upload data directly to S3 using pre-signed URL
    No AWS credentials needed!
    
    Args:
        data (dict): Data to upload
        upload_url (str): Pre-signed S3 URL
        
    Returns:
        bool: True if successful
    """
    json_data = json.dumps(data)
    
    async with aiohttp.ClientSession() as session:
        async with session.put(
            upload_url,
            data=json_data.encode('utf-8'),
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status not in [200, 204]:
                error_text = await response.text()
                raise Exception(f"S3 upload failed ({response.status}): {error_text}")
            return True

async def send_to_whispey(data, apikey=None, api_url=None):
    """
    Send data to Whispey API with automatic compression for large payloads
    
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
    
    # Determine target URL (needs to be defined before S3 upload)
    url_to_use = api_url if api_url else WHISPEY_API_URL
    
    # Validate API key
    if not api_key_to_use:
        error_msg = "API key not provided and WHISPEY_API_KEY environment variable not set"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }
    
    # Check payload size and route accordingly
    original_size = get_payload_size(data)
    print(f"📊 Original payload size: {original_size:,} bytes ({original_size/1024/1024:.2f} MB)")
    
    # NEW: Use S3 for very large payloads (> 5MB)
    if USE_S3_FOR_LARGE and original_size > S3_UPLOAD_THRESHOLD:
        print(f"📦 Large payload detected ({original_size/1024/1024:.2f}MB), using S3 upload...")
        try:
            # Step 1: Get pre-signed upload URL from Lambda
            upload_url, s3_key, s3_bucket = await get_s3_upload_url(
                call_id=data.get("call_id", "unknown"),
                apikey=api_key_to_use,
                api_url=url_to_use
            )
            print(f"✅ Got upload URL: {s3_key}")
            
            # Step 2: Upload directly to S3 (no AWS credentials needed!)
            await upload_to_s3_presigned(data, upload_url)
            print(f"✅ Uploaded to S3 successfully")
            
            # Step 3: If auto-trigger enabled, Lambda will process automatically
            if S3_AUTO_TRIGGER:
                print(f"✅ S3 auto-trigger enabled - Lambda will process automatically")
                return {
                    "success": True,
                    "message": "Uploaded to S3, Lambda will process automatically",
                    "s3_key": s3_key,
                    "s3_bucket": s3_bucket,
                    "auto_triggered": True
                }
            
            # Step 3 (Manual trigger): Create reference payload for Lambda
            payload = {
                "s3_reference": True,
                "s3_bucket": s3_bucket,
                "s3_key": s3_key,
                "call_id": data.get("call_id"),
                "agent_id": data.get("agent_id"),
                "environment": data.get("environment", "dev")
            }
            print(f"📤 Sending S3 reference to Lambda (manual trigger)")
            
        except Exception as e:
            print(f"⚠️  S3 upload failed: {e}")
            print(f"⚠️  Falling back to compression...")
            # Fall back to compression if S3 fails
            if should_compress(data):
                try:
                    compressed_data = compress_data(data)
                    compressed_size = len(compressed_data.encode('utf-8'))
                    compression_ratio = (1 - compressed_size / original_size) * 100
                    
                    print(f"✅ Compression successful: {compressed_size:,} bytes")
                    print(f"📈 Compression ratio: {compression_ratio:.1f}% reduction")
                    
                    payload = {
                        "compressed": True,
                        "data": compressed_data,
                        "original_size": original_size,
                        "compressed_size": compressed_size,
                        "compression_ratio": compression_ratio
                    }
                except Exception as comp_error:
                    print(f"⚠️  Compression also failed: {comp_error}, sending uncompressed")
                    payload = data
            else:
                payload = data
    
    # EXISTING: Compress medium-sized payloads (10KB - 5MB)
    elif should_compress(data):
        print(f"🗜️  Compressing data (threshold: {COMPRESSION_THRESHOLD/1024:.1f}KB)...")
        try:
            compressed_data = compress_data(data)
            compressed_size = len(compressed_data.encode('utf-8'))
            compression_ratio = (1 - compressed_size / original_size) * 100
            
            print(f"✅ Compression successful: {compressed_size:,} bytes ({compressed_size/1024/1024:.2f} MB)")
            print(f"📈 Compression ratio: {compression_ratio:.1f}% reduction")
            
            # Create compressed payload
            payload = {
                "compressed": True,
                "data": compressed_data,
                "original_size": original_size,
                "compressed_size": compressed_size,
                "compression_ratio": compression_ratio
            }
            
        except Exception as e:
            print(f"⚠️  Compression failed: {e}, sending uncompressed data")
            payload = data
    
    # EXISTING: Send small payloads directly (< 10KB)
    else:
        print(f"📤 Data size under threshold, sending uncompressed")
        payload = data
    
    # Headers - ensure no None values
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": api_key_to_use
    }
    
    # Validate headers
    headers = {k: v for k, v in headers.items() if k is not None and v is not None}
    
    
    try:
        # Test JSON serialization first
        json_str = json.dumps(payload)
        print(f"✅ JSON serialization OK ({len(json_str):,} chars)")
        
        # Send the request
        async with aiohttp.ClientSession() as session:
            async with session.post(url_to_use, json=payload, headers=headers) as response:
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
        # These are the actual exceptions json.dumps() raises
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