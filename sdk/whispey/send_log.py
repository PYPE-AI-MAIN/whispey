# sdk/whispey/send_log.py
import os
import json
import asyncio
import aiohttp
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configuration
WHISPEY_API_URL = "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"
WHISPEY_API_KEY = os.getenv("WHISPEY_API_KEY")

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

async def send_to_whispey(data, apikey=None, api_url=None):
    """
    Send data to Whispey API
    
    Args:
        data (dict): The data to send to the API
        apikey (str, optional): Custom API key to use. If not provided, uses WHISPEY_API_KEY environment variable
    
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
    
    # Headers - ensure no None values
    headers = {
        "Content-Type": "application/json",
        "x-pype-token": api_key_to_use
    }
    
    # Validate headers
    headers = {k: v for k, v in headers.items() if k is not None and v is not None}
    
    print(f"📤 Sending data to Whispey API...")
    print(f"Data keys: {list(data.keys())}")
    print(f"Call started at: {data.get('call_started_at')}")
    print(f"Call ended at: {data.get('call_ended_at')}")
    
    try:
        # Determine target URL (overrideable)
        url_to_use = api_url if api_url else WHISPEY_API_URL
        # Test JSON serialization first
        json_str = json.dumps(data)
        print(f"✅ JSON serialization OK ({len(json_str)} chars)")
        
        # Send the request
        async with aiohttp.ClientSession() as session:
            async with session.post(url_to_use, json=data, headers=headers) as response:
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
                    print(f"✅ Success! Response: {json.dumps(result, indent=2)}")
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