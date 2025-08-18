import os
import json
import asyncio
import aiohttp
from urllib.parse import urlparse
from datetime import datetime
from dotenv import load_dotenv
import logging
import json


load_dotenv()
logger = logging.getLogger("send_log")

# Configuration
DEFAULT_CLOUD_API_URL = "https://mp1grlhon8.execute-api.ap-south-1.amazonaws.com/dev/send-call-log"
WHISPEY_API_KEY = os.getenv("WHISPEY_API_KEY")
WHISPEY_API_URL_ENV = os.getenv("WHISPEY_API_URL")
WHISPEY_HOST_URL_ENV = os.getenv("WHISPEY_HOST_URL")

def _looks_like_full_endpoint(url: str) -> bool:
    """Your existing function - unchanged"""
    try:
        parsed = urlparse(url)
        return bool(parsed.scheme and parsed.netloc and parsed.path)
    except Exception:
        return False

def resolve_api_url(host_url: str | None = None) -> str:
    """Your existing function - unchanged"""
    # 1) Explicit host_url argument
    if host_url:
        trimmed = host_url.rstrip('/')
        if trimmed.endswith('/send-call-log') or trimmed.endswith('/api/send-logs') or _looks_like_full_endpoint(trimmed):
            return trimmed
        return f"{trimmed}/api/send-logs"
    
    # 2) Environment base host
    if WHISPEY_HOST_URL_ENV:
        trimmed = WHISPEY_HOST_URL_ENV.rstrip('/')
        if trimmed.endswith('/send-call-log') or trimmed.endswith('/api/send-logs') or _looks_like_full_endpoint(trimmed):
            return trimmed
        return f"{trimmed}/api/send-logs"

    # 3) Full endpoint from env
    if WHISPEY_API_URL_ENV:
        return WHISPEY_API_URL_ENV

    # 4) Fallback to cloud default
    return DEFAULT_CLOUD_API_URL

def convert_timestamp(timestamp_value):
    """Your existing function - unchanged"""
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

def validate_whispey_data(data: dict) -> dict:
    """NEW: Validate and sanitize data before sending"""
    validation_result = {
        'valid': True,
        'warnings': [],
        'errors': [],
        'sanitized_data': data.copy()
    }
    
    # Required fields validation
    required_fields = ['call_id', 'agent_id', 'call_started_at', 'call_ended_at']
    for field in required_fields:
        if field not in data or data[field] is None:
            validation_result['errors'].append(f"Missing required field: {field}")
            validation_result['valid'] = False
    
    # Data type validation
    if 'transcript_with_metrics' in data and not isinstance(data['transcript_with_metrics'], list):
        validation_result['warnings'].append("transcript_with_metrics should be a list")
        validation_result['sanitized_data']['transcript_with_metrics'] = []
    
    if 'transcript_json' in data and not isinstance(data['transcript_json'], list):
        validation_result['warnings'].append("transcript_json should be a list")
        validation_result['sanitized_data']['transcript_json'] = []
    
    # NEW: Validate enhanced analytics structure
    metadata = data.get('metadata', {})
    if 'enhanced_analytics' in metadata:
        analytics = metadata['enhanced_analytics']
        
        # Validate model usage summary
        if 'model_usage_summary' in analytics:
            model_usage = analytics['model_usage_summary']
            
            # Ensure model lists are actually lists
            for model_type in ['stt_models', 'llm_models', 'tts_models']:
                if model_type in model_usage and not isinstance(model_usage[model_type], list):
                    validation_result['warnings'].append(f"{model_type} should be a list")
                    validation_result['sanitized_data']['metadata']['enhanced_analytics']['model_usage_summary'][model_type] = []
            
            # Validate numeric fields
            numeric_fields = ['total_cost', 'tool_calls_total', 'tool_success_rate']
            for field in numeric_fields:
                if field in model_usage and not isinstance(model_usage[field], (int, float)):
                    validation_result['warnings'].append(f"{field} should be numeric")
                    try:
                        validation_result['sanitized_data']['metadata']['enhanced_analytics']['model_usage_summary'][field] = float(model_usage[field])
                    except (ValueError, TypeError):
                        validation_result['sanitized_data']['metadata']['enhanced_analytics']['model_usage_summary'][field] = 0
    
    # Size validation (warn if data is very large)
    try:
        json_size = len(json.dumps(data, default=str))
        if json_size > 1024 * 1024:  # 1MB
            validation_result['warnings'].append(f"Large payload size: {json_size / 1024 / 1024:.1f}MB")
        elif json_size > 10 * 1024 * 1024:  # 10MB
            validation_result['errors'].append(f"Payload too large: {json_size / 1024 / 1024:.1f}MB")
            validation_result['valid'] = False
    except Exception as e:
        validation_result['errors'].append(f"JSON serialization test failed: {e}")
        validation_result['valid'] = False
    
    return validation_result

async def send_to_whispey(data, apikey=None, host_url: str | None = None):
    """ENHANCED: Send data to Whispey API with validation and better error handling"""
    
    
    # NEW: Validate data before sending
    validation = validate_whispey_data(data)

    from datetime import datetime
    filename = f'code_snippet_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(filename, 'w') as f: json.dump({"code": data}, f)
    
    if validation['warnings']:
        for warning in validation['warnings']:
            logger.warning(f"⚠️ Data validation warning: {warning}")
    
    if not validation['valid']:
        for error in validation['errors']:
            logger.error(f"❌ Data validation error: {error}")
        return {
            "success": False,
            "error": "Data validation failed",
            "validation_errors": validation['errors']
        }
    
    # Use sanitized data
    data = validation['sanitized_data']
    
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
        "x-pype-token": api_key_to_use,
        "User-Agent": "Whispey-Enhanced-SDK/1.0.0"  # NEW: Add user agent
    }
    
    # Validate headers
    headers = {k: v for k, v in headers.items() if k is not None and v is not None}
    
    final_api_url = resolve_api_url(host_url)
    
    # NEW: Enhanced debug output
    print(f"📤 Sending enhanced data to Whispey API... -> {final_api_url}")
    print(f"Data keys: {list(data.keys())}")
    print(f"Call started at: {data.get('call_started_at')}")
    print(f"Call ended at: {data.get('call_ended_at')}")
    
    # NEW: Show enhanced analytics summary
    metadata = data.get('metadata', {})
    if 'session_insights' in metadata:
        insights = metadata['session_insights']
        print(f"📊 Analytics: {insights.get('conversation_turns', 0)} turns, ${insights.get('total_session_cost', 0):.4f} cost")
        
        models_used = insights.get('models_used', {})
        if any(models_used.values()):
            print(f"🤖 Models: STT:{models_used.get('stt', [])}, LLM:{models_used.get('llm', [])}, TTS:{models_used.get('tts', [])}")
        
        tools_perf = insights.get('tools_performance', {})
        if tools_perf.get('total_calls', 0) > 0:
            print(f"🔧 Tools: {tools_perf['total_calls']} calls, {tools_perf.get('success_rate', 0):.1%} success rate")
    
    try:
        # Test JSON serialization first
        json_str = json.dumps(data, default=str)
        print(f"✅ JSON serialization OK ({len(json_str)} chars)")
        
        # NEW: Add retry logic for better reliability
        max_retries = 3
        retry_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                # Send the request
                timeout = aiohttp.ClientTimeout(total=30)  # NEW: Add timeout
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(final_api_url, json=data, headers=headers) as response:
                        print(f"📡 Response status: {response.status} (Attempt {attempt + 1})")
                        
                        if response.status >= 400:
                            error_text = await response.text()
                            print(f"❌ Error response: {error_text}")
                            
                            # NEW: Retry on certain errors
                            if response.status >= 500 and attempt < max_retries - 1:
                                print(f"🔄 Retrying in {retry_delay}s... (Server error)")
                                await asyncio.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                                continue
                            
                            return {
                                "success": False,
                                "status": response.status,
                                "error": error_text,
                                "attempts": attempt + 1
                            }
                        else:
                            result = await response.json()
                            print(f"✅ Success! Response: {json.dumps(result, indent=2)}")
                            
                            # NEW: Log successful transmission details
                            logger.info(f"📤 Successfully sent to Whispey:")
                            logger.info(f"   - Call ID: {data.get('call_id')}")
                            logger.info(f"   - Duration: {metadata.get('duration_formatted', 'unknown')}")
                            logger.info(f"   - Turns: {metadata.get('session_insights', {}).get('conversation_turns', 0)}")
                            logger.info(f"   - Cost: ${metadata.get('session_insights', {}).get('total_session_cost', 0):.4f}")
                            
                            return {
                                "success": True,
                                "status": response.status,
                                "data": result,
                                "attempts": attempt + 1
                            }
                            
            except asyncio.TimeoutError:
                print(f"⏰ Request timeout (Attempt {attempt + 1})")
                if attempt < max_retries - 1:
                    print(f"🔄 Retrying in {retry_delay}s... (Timeout)")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    return {
                        "success": False,
                        "error": "Request timeout after multiple attempts",
                        "attempts": attempt + 1
                    }
            
            except aiohttp.ClientError as e:
                print(f"🌐 Network error (Attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    print(f"🔄 Retrying in {retry_delay}s... (Network error)")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    return {
                        "success": False,
                        "error": f"Network error after multiple attempts: {e}",
                        "attempts": attempt + 1
                    }
        
        # Should never reach here, but just in case
        return {
            "success": False,
            "error": "Maximum retries exceeded",
            "attempts": max_retries
        }
                    
    except (TypeError, ValueError) as e:
        # These are the actual exceptions json.dumps() raises
        error_msg = f"JSON serialization failed: {e}"
        print(f"❌ {error_msg}")
        logger.error(f"JSON serialization error: {e}")
        
        # NEW: Try to identify problematic data
        try:
            # Attempt to find non-serializable objects
            problematic_keys = []
            for key, value in data.items():
                try:
                    json.dumps({key: value}, default=str)
                except:
                    problematic_keys.append(key)
            
            if problematic_keys:
                logger.error(f"Problematic data keys: {problematic_keys}")
                
        except Exception:
            pass
        
        return {
            "success": False,
            "error": error_msg
        }
    except Exception as e:
        error_msg = f"Request failed: {e}"
        print(f"❌ {error_msg}")
        logger.error(f"Unexpected error: {e}")
        return {
            "success": False,
            "error": error_msg
        }

# NEW: Helper functions for data analysis and debugging
def analyze_whispey_payload(data: dict) -> dict:
    """Analyze the Whispey payload for insights"""
    analysis = {
        'payload_size_bytes': 0,
        'transcript_turns': 0,
        'models_detected': set(),
        'tools_detected': set(),
        'total_estimated_cost': 0.0,
        'data_quality_score': 1.0
    }
    
    try:
        # Calculate payload size
        analysis['payload_size_bytes'] = len(json.dumps(data, default=str))
        
        # Analyze transcript data
        transcript_data = data.get('transcript_with_metrics', [])
        analysis['transcript_turns'] = len(transcript_data)
        
        # Extract model and tool usage
        for turn in transcript_data:
            # Model detection
            if turn.get('stt_metrics', {}).get('model_name'):
                analysis['models_detected'].add(f"STT:{turn['stt_metrics']['model_name']}")
            if turn.get('llm_metrics', {}).get('model_name'):
                analysis['models_detected'].add(f"LLM:{turn['llm_metrics']['model_name']}")
            if turn.get('tts_metrics', {}).get('model_name'):
                analysis['models_detected'].add(f"TTS:{turn['tts_metrics']['model_name']}")
            
            # Tool detection
            for tool_call in turn.get('tool_calls', []):
                analysis['tools_detected'].add(tool_call.get('tool_name', 'unknown'))
            
            # Cost accumulation
            if turn.get('cost_breakdown', {}).get('total_turn_cost'):
                analysis['total_estimated_cost'] += turn['cost_breakdown']['total_turn_cost']
        
        # Convert sets to lists for JSON serialization
        analysis['models_detected'] = list(analysis['models_detected'])
        analysis['tools_detected'] = list(analysis['tools_detected'])
        
        # Calculate data quality score
        quality_factors = []
        
        # Has transcript data
        if analysis['transcript_turns'] > 0:
            quality_factors.append(0.3)
        
        # Has model information
        if analysis['models_detected']:
            quality_factors.append(0.3)
        
        # Has cost information
        if analysis['total_estimated_cost'] > 0:
            quality_factors.append(0.2)
        
        # Has tool information
        if analysis['tools_detected']:
            quality_factors.append(0.2)
        
        analysis['data_quality_score'] = sum(quality_factors)
        
    except Exception as e:
        logger.error(f"Error analyzing payload: {e}")
        analysis['analysis_error'] = str(e)
    
    return analysis

def get_payload_summary(data: dict) -> str:
    """NEW: Get a human-readable summary of the payload"""
    analysis = analyze_whispey_payload(data)
    
    summary_lines = [
        f"📊 Payload Summary:",
        f"   Size: {analysis['payload_size_bytes'] / 1024:.1f} KB",
        f"   Turns: {analysis['transcript_turns']}",
        f"   Models: {', '.join(analysis['models_detected']) if analysis['models_detected'] else 'None detected'}",
        f"   Tools: {', '.join(analysis['tools_detected']) if analysis['tools_detected'] else 'None used'}",
        f"   Cost: ${analysis['total_estimated_cost']:.4f}",
        f"   Quality: {analysis['data_quality_score']:.1f}/1.0"
    ]
    
    return "\n".join(summary_lines)

async def send_to_whispey_with_analytics(data, apikey=None, host_url: str | None = None, include_payload_analysis=True):
    """NEW: Enhanced send function with built-in analytics"""
    
    # Show payload analysis
    if include_payload_analysis:
        analysis = analyze_whispey_payload(data)
        print(get_payload_summary(data))
        
        # Log analytics to file for debugging
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            analysis_filename = f"whispey_payload_analysis_{timestamp}.json"
            
            with open(analysis_filename, 'w') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'call_id': data.get('call_id'),
                    'analysis': analysis,
                    'payload_sample': {
                        'metadata_keys': list(data.get('metadata', {}).keys()),
                        'transcript_turns': len(data.get('transcript_with_metrics', [])),
                        'has_enhanced_analytics': 'enhanced_analytics' in data.get('metadata', {})
                    }
                }, f, indent=2, default=str)
            
            logger.info(f"📊 Payload analysis saved to: {analysis_filename}")
            
        except Exception as e:
            logger.debug(f"Could not save payload analysis: {e}")
    
    # Send using the enhanced send function
    return await send_to_whispey(data, apikey, host_url)

# NEW: Data export helpers
def export_session_analytics(session_data: dict, filename: str = None) -> str:
    """Export session analytics to JSON file"""
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        call_id = session_data.get('call_id', 'unknown')
        filename = f"session_analytics_{call_id}_{timestamp}.json"
    
    try:
        analytics_export = {
            'export_timestamp': datetime.now().isoformat(),
            'call_metadata': {
                'call_id': session_data.get('call_id'),
                'agent_id': session_data.get('agent_id'),
                'duration': session_data.get('metadata', {}).get('duration_formatted'),
                'call_success': session_data.get('metadata', {}).get('call_success'),
            },
            
            # Enhanced analytics
            'model_analytics': session_data.get('metadata', {}).get('enhanced_analytics', {}),
            'session_insights': session_data.get('metadata', {}).get('session_insights', {}),
            
            # Usage statistics
            'usage_statistics': session_data.get('metadata', {}).get('usage', {}),
            
            # Conversation analysis
            'conversation_analysis': {
                'total_turns': len(session_data.get('transcript_with_metrics', [])),
                'turn_details': []
            }
        }
        
        # Add turn-by-turn analysis
        for turn in session_data.get('transcript_with_metrics', []):
            turn_analysis = {
                'turn_id': turn.get('turn_id'),
                'has_user_input': bool(turn.get('user_transcript')),
                'has_agent_response': bool(turn.get('agent_response')),
                'models_used': {
                    'stt': turn.get('stt_metrics', {}).get('model_name'),
                    'llm': turn.get('llm_metrics', {}).get('model_name'),
                    'tts': turn.get('tts_metrics', {}).get('model_name')
                },
                'tool_calls': len(turn.get('tool_calls', [])),
                'turn_cost': turn.get('cost_breakdown', {}).get('total_turn_cost', 0)
            }
            analytics_export['conversation_analysis']['turn_details'].append(turn_analysis)
        
        with open(filename, 'w') as f:
            json.dump(analytics_export, f, indent=2, default=str)
        
        logger.info(f"📊 Session analytics exported to: {filename}")
        return filename
        
    except Exception as e:
        logger.error(f"❌ Failed to export session analytics: {e}")
        return None

def get_data_quality_report(data: dict) -> dict:
    """NEW: Generate data quality report"""
    validation = validate_whispey_data(data)
    analysis = analyze_whispey_payload(data)
    
    quality_report = {
        'overall_quality': 'excellent' if analysis['data_quality_score'] >= 0.8 else 'good' if analysis['data_quality_score'] >= 0.6 else 'poor',
        'validation_status': 'passed' if validation['valid'] else 'failed',
        'completeness': {
            'has_transcript': analysis['transcript_turns'] > 0,
            'has_models': len(analysis['models_detected']) > 0,
            'has_costs': analysis['total_estimated_cost'] > 0,
            'has_tools': len(analysis['tools_detected']) > 0
        },
        'recommendations': []
    }
    
    # Generate recommendations
    if analysis['transcript_turns'] == 0:
        quality_report['recommendations'].append("No conversation turns detected - check transcript collection")
    
    if not analysis['models_detected']:
        quality_report['recommendations'].append("No model information detected - verify model tracking is enabled")
    
    if analysis['total_estimated_cost'] == 0:
        quality_report['recommendations'].append("No cost information available - check cost calculation logic")
    
    if validation['warnings']:
        quality_report['recommendations'].extend([f"Data warning: {w}" for w in validation['warnings']])
    
    if validation['errors']:
        quality_report['validation_errors'] = validation['errors']
    
    return quality_report