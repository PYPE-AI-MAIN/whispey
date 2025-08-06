import time
import uuid
import logging
from datetime import datetime
from typing import Dict, Any
from whispey.event_handlers import setup_session_event_handlers, safe_extract_transcript_data
from whispey.metrics_service import setup_usage_collector, create_session_data
from whispey.send_log import send_to_whispey

logger = logging.getLogger("observe_session")

# Global session storage - store data, not class instances
_session_data_store = {}

def observe_session(session, agent_id,**kwargs):
    session_id = str(uuid.uuid4())
    
    logger.info(f"🔗 Setting up Whispey-compatible metrics collection for session {session_id}")
    logger.info(f"📋 Dynamic parameters: {list(kwargs.keys())}")
    
    try:        
        # Setup session data and usage collector using your existing functions
        usage_collector = setup_usage_collector()
        session_data = create_session_data(
            type('MockContext', (), {'room': type('MockRoom', (), {'name': session_id})})(), 
            time.time()
        )
        
        # Update session data with all dynamic parameters
        session_data.update(kwargs)
        
        # Store session info in global storage (data only, not class instances)
        _session_data_store[session_id] = {
            'start_time': time.time(),
            'session_data': session_data,
            'usage_collector': usage_collector,
            'dynamic_params': kwargs,
            'agent_id': agent_id,
            'call_active': True,
            'whispey_data': None
        }
        
        # Setup event handlers with session
        setup_session_event_handlers(session, session_data, usage_collector, None)
        
        # Add custom handlers for Whispey integration
        @session.on("disconnected")
        def on_disconnected(event):
            end_session_manually(session_id, "disconnected")
        
        @session.on("close")
        def on_session_close(event):
            error_msg = str(event.error) if hasattr(event, 'error') and event.error else None
            end_session_manually(session_id, "completed", error_msg)
        
        logger.info(f"✅ Whispey-compatible metrics collection active for session {session_id}")
        return session_id
        
    except Exception as e:
        logger.error(f"⚠️ Failed to set up metrics collection: {e}")
        # Still return session_id so caller can handle gracefully
        return session_id

def generate_whispey_data(session_id: str, status: str = "in_progress", error: str = None) -> Dict[str, Any]:
    """Generate Whispey data for a session"""
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found in data store")
        return {}
    
    session_info = _session_data_store[session_id]
    current_time = time.time()
    start_time = session_info['start_time']
    
    # Extract transcript data using your existing function
    session_data = session_info['session_data']
    if session_data:
        try:
            safe_extract_transcript_data(session_data)
        except Exception as e:
            logger.error(f"Error extracting transcript data: {e}")
    
    # Get usage summary
    usage_summary = {}
    usage_collector = session_info['usage_collector']
    if usage_collector:
        try:
            summary = usage_collector.get_summary()
            usage_summary = {
                "llm_prompt_tokens": getattr(summary, 'llm_prompt_tokens', 0),
                "llm_completion_tokens": getattr(summary, 'llm_completion_tokens', 0),
                "llm_cached_tokens": getattr(summary, 'llm_prompt_cached_tokens', 0),
                "tts_characters": getattr(summary, 'tts_characters_count', 0),
                "stt_audio_duration": getattr(summary, 'stt_audio_duration', 0.0)
            }
        except Exception as e:
            logger.error(f"Error getting usage summary: {e}")
    
    # Calculate duration
    duration = int(current_time - start_time)
    
    # Prepare Whispey format data
    whispey_data = {
        "call_id": f"{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "agent_id": session_info['agent_id'],
        "customer_number": session_info['dynamic_params'].get('phone_number', 'unknown'),
        "call_ended_reason": status,
        "call_started_at": start_time,
        "call_ended_at": current_time,
        "transcript_type": "agent",
        "recording_url": "",  # Will be filled by caller
        "transcript_json": [],
        "transcript_with_metrics": [],
        "metadata": {
            "usage": usage_summary,
            "duration_formatted": f"{duration // 60}m {duration % 60}s",
            "call_success": status == "completed",
            "error": error,
            **session_info['dynamic_params']  # Include all dynamic parameters
        }
    }
    
    # Add transcript data if available
    if session_data:
        whispey_data["transcript_with_metrics"] = session_data.get("transcript_with_metrics", [])
        
        # Extract transcript_json from session history if available
        if hasattr(session_data, 'history'):
            try:
                whispey_data["transcript_json"] = session_data.history.to_dict().get("items", [])
            except Exception as e:
                logger.debug(f"Could not extract transcript_json from history: {e}")
        
        # Try other possible transcript locations
        if not whispey_data["transcript_json"]:
            for attr in ['transcript_data', 'conversation_history', 'messages']:
                if hasattr(session_data, attr):
                    try:
                        data = getattr(session_data, attr)
                        if isinstance(data, list):
                            whispey_data["transcript_json"] = data
                            break
                        elif hasattr(data, 'to_dict'):
                            whispey_data["transcript_json"] = data.to_dict().get("items", [])
                            break
                    except Exception as e:
                        logger.debug(f"Could not extract transcript from {attr}: {e}")
    
    return whispey_data

def get_session_whispey_data(session_id: str) -> Dict[str, Any]:
    """Get Whispey-formatted data for a session"""
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found")
        return {}
    
    session_info = _session_data_store[session_id]
    
    # Return cached data if session has ended
    if not session_info['call_active'] and session_info['whispey_data']:
        return session_info['whispey_data']
    
    # Generate fresh data
    return generate_whispey_data(session_id)

def end_session_manually(session_id: str, status: str = "completed", error: str = None):
    """Manually end a session"""
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found for manual end")
        return
    
    logger.info(f"🔚 Manually ending session {session_id} with status: {status}")
    
    # Mark as inactive
    _session_data_store[session_id]['call_active'] = False
    
    # Generate and cache final whispey data
    final_data = generate_whispey_data(session_id, status, error)
    _session_data_store[session_id]['whispey_data'] = final_data
    
    logger.info(f"📊 Session {session_id} ended - Whispey data prepared")

def cleanup_session(session_id: str):
    """Clean up session data"""
    if session_id in _session_data_store:
        del _session_data_store[session_id]
        logger.info(f"🗑️ Cleaned up session {session_id}")

async def send_session_to_whispey(session_id: str, recording_url: str = "", additional_transcript: list = None, force_end: bool = True) -> dict:
    """
    Send session data to Whispey API
    
    Args:
        session_id: Session ID to send
        recording_url: URL of the call recording
        additional_transcript: Additional transcript data if needed
        force_end: Whether to force end the session before sending (default: True)
    
    Returns:
        dict: Response from Whispey API
    """
    logger.info(f"🚀 Starting send_session_to_whispey for {session_id}")
    
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found in data store")
        logger.info(f"Available sessions: {list(_session_data_store.keys())}")
        return {"success": False, "error": "Session not found"}
    
    session_info = _session_data_store[session_id]
    logger.info(f"📊 Session {session_id} found - active: {session_info['call_active']}")
    
    # Force end session if requested and still active
    if force_end and session_info['call_active']:
        logger.info(f"🔚 Force ending session {session_id}")
        end_session_manually(session_id, "completed")
    
    # Get whispey data
    whispey_data = get_session_whispey_data(session_id)
    
    logger.info(f"📊 Generated whispey data with keys: {list(whispey_data.keys()) if whispey_data else 'Empty'}")
    
    if not whispey_data:
        logger.error(f"No whispey data generated for session {session_id}")
        return {"success": False, "error": "No data available"}
    
    # Update with additional data
    if recording_url:
        whispey_data["recording_url"] = recording_url
        logger.info(f"📎 Added recording URL: {recording_url}")
    
    if additional_transcript:
        whispey_data["transcript_json"] = additional_transcript
        logger.info(f"📄 Added additional transcript with {len(additional_transcript)} items")
    
    # Debug print
    print("=== WHISPEY DATA FOR SENDING ===")
    print(f"Call ID: {whispey_data.get('call_id', 'N/A')}")
    print(f"Agent ID: {whispey_data.get('agent_id', 'N/A')}")
    print(f"Duration: {whispey_data.get('metadata', {}).get('duration_formatted', 'N/A')}")
    print(f"Usage: {whispey_data.get('metadata', {}).get('usage', {})}")
    print("============================")
    
    # Send to Whispey
    try:
        logger.info(f"📤 Sending to Whispey API...")
        result = await send_to_whispey(whispey_data)
        
        if result.get("success"):
            logger.info(f"✅ Successfully sent session {session_id} to Whispey")
            cleanup_session(session_id)
        else:
            logger.error(f"❌ Whispey API returned failure: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Exception sending to Whispey: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

# Utility functions
def get_latest_session():
    """Get the most recent session data"""
    if _session_data_store:
        latest_id = max(_session_data_store.keys(), key=lambda x: _session_data_store[x]['start_time'])
        return latest_id, _session_data_store[latest_id]
    return None, None

def get_all_active_sessions():
    """Get all active session IDs"""
    return [sid for sid, data in _session_data_store.items() if data['call_active']]

def cleanup_all_sessions():
    """Clean up all sessions"""
    session_ids = list(_session_data_store.keys())
    for session_id in session_ids:
        end_session_manually(session_id, "cleanup")
        cleanup_session(session_id)
    logger.info(f"🗑️ Cleaned up {len(session_ids)} sessions")

def debug_session_state(session_id: str = None):
    """Debug helper to check session state"""
    if session_id:
        if session_id in _session_data_store:
            data = _session_data_store[session_id]
            print(f"Session {session_id}:")
            print(f"  - Active: {data['call_active']}")
            print(f"  - Start time: {datetime.fromtimestamp(data['start_time'])}")
            print(f"  - Has session_data: {data['session_data'] is not None}")
            print(f"  - Has usage_collector: {data['usage_collector'] is not None}")
            print(f"  - Dynamic params: {data['dynamic_params']}")
            print(f"  - Has cached whispey_data: {data['whispey_data'] is not None}")
        else:
            print(f"Session {session_id} not found")
    else:
        print(f"Total sessions: {len(_session_data_store)}")
        for sid, data in _session_data_store.items():
            print(f"  {sid}: active={data['call_active']}, agent={data['agent_id']}")