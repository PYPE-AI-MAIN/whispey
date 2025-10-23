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
class WhispeyConfig:
    """Configuration class for Whispey SDK"""
    
    def __init__(self, environment="production", api_key=None):
        """
        Initialize Whispey configuration
        
        Args:
            environment (str): Environment - "development" or "production" (default: "production")
            api_key (str): API key for authentication (default: from env WHISPEY_API_KEY)
        """
        self.environment = environment.lower()
        self.api_key = api_key or os.getenv("WHISPEY_API_KEY")
        self.api_url = self._get_api_url()
    
    def _get_api_url(self):
        """Get the appropriate API URL based on environment"""
        if self.environment == "development":
            return "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/dev/send-call-log"
        else:
            return "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"

# Default configuration (for backward compatibility)
DEFAULT_CONFIG = WhispeyConfig()
WHISPEY_API_URL = DEFAULT_CONFIG.api_url
WHISPEY_API_KEY = DEFAULT_CONFIG.api_key

# Compression settings
COMPRESSION_THRESHOLD = 10 * 1024  # 10KB - compress if larger than this

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

async def send_to_whispey(data, apikey=None, api_url=None, environment="production"):
    """
    Send data to Whispey API with automatic compression for large payloads
    
    Args:
        data (dict): The data to send to the API
        apikey (str, optional): Custom API key to use. If not provided, uses WHISPEY_API_KEY environment variable
        api_url (str, optional): Custom API URL to use
        environment (str): Environment - "development" or "production" (default: "production")
    
    Returns:
        dict: Response from the API or error information
    """
    
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
    
    # Check if data should be compressed
    original_size = get_payload_size(data)
    print(f"📊 Original payload size: {original_size:,} bytes ({original_size/1024/1024:.2f} MB)")
    
    if should_compress(data):
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
        # Determine target URL (overrideable)
        if api_url:
            url_to_use = api_url
        else:
            # Create config instance based on environment
            config = WhispeyConfig(environment=environment, api_key=apikey)
            url_to_use = config.api_url
        
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