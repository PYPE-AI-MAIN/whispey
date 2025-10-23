# sdk/whispey/whispey.py
import time
import uuid
import logging
from datetime import datetime
from typing import Dict, Any
from whispey.event_handlers import setup_session_event_handlers, safe_extract_transcript_data
from whispey.metrics_service import setup_usage_collector, create_session_data
from whispey.send_log import send_to_whispey

logger = logging.getLogger("observe_session")

# Import HealthBench evaluation functionality
def _import_healthbench_eval():
    """Lazy import of HealthBench evaluation to avoid dependency issues"""
    try:
        import sys
        import os
        eval_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'eval')
        if eval_path not in sys.path:
            sys.path.append(eval_path)
        
        # Use fast evaluation with fewer examples for best performance
        from fast_healthbench_eval import fast_healthbench_evaluation
        from simple_healthbench_eval import check_openai_api_key
        return fast_healthbench_evaluation, check_openai_api_key
    except ImportError as e:
        logger.warning(f"HealthBench evaluation not available: {e}")
        return None, None

# Global session storage - store data, not class instances
_session_data_store = {}


def _run_healthbench_evaluation(transcript_data: list, eval_config: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Run HealthBench evaluation on transcript data
    
    Args:
        transcript_data: List of transcript turns with user/assistant messages
        eval_config: Configuration for evaluation (grader_model, num_examples, etc.)
    
    Returns:
        Dict containing evaluation results or error information
    """
    try:
        # Import HealthBench evaluation functions
        evaluate_transcription_healthbench, check_openai_api_key = _import_healthbench_eval()
        
        if not evaluate_transcription_healthbench:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "HealthBench evaluation not available - missing dependencies"
            }
        
        # Check if OpenAI API key is available
        if not check_openai_api_key():
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "OpenAI API key not found - required for HealthBench evaluation"
            }
        
        # Quick API connectivity test
        try:
            import openai
            client = openai.OpenAI()
            # Test with a minimal request
            test_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "Test"}],
                max_tokens=1,
                timeout=10
            )
            logger.info("✅ OpenAI API connectivity confirmed")
        except Exception as api_error:
            logger.error(f"❌ OpenAI API connectivity test failed: {api_error}")
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": f"OpenAI API connectivity issue: {str(api_error)}",
                "evaluated_at": datetime.now().isoformat()
            }
        
        # Convert transcript data to the expected format
        messages = []
        for turn in transcript_data:
            # Handle different transcript formats
            if isinstance(turn, dict):
                # Try to extract role and content from different possible formats
                role = turn.get('role') or turn.get('speaker') or 'unknown'
                content = turn.get('content') or turn.get('text') or turn.get('message', '')
                
                if role and content:
                    # Normalize role names
                    if role.lower() in ['user', 'human', 'customer']:
                        role = 'user'
                    elif role.lower() in ['assistant', 'agent', 'ai']:
                        role = 'assistant'
                    
                    messages.append({
                        "role": role,
                        "content": str(content)
                    })
        
        if len(messages) < 2:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "Insufficient transcript data - need at least user and assistant messages"
            }
        
        # Prepare transcription format for evaluation
        transcription = {"messages": messages}
        
        # Get evaluation configuration
        eval_config = eval_config or {}
        grader_model = eval_config.get('grader_model', 'gpt-4o-mini')
        num_examples = eval_config.get('num_examples', None)
        subset_name = eval_config.get('subset_name', None)
        
        logger.info(f"🧪 Running HealthBench evaluation with {len(messages)} messages using {grader_model}")
        
        # Run the evaluation (now using fast evaluation with built-in timeout)
        try:
            # Use the fast evaluation function with fewer examples
            result = evaluate_transcription_healthbench(
                transcription=transcription,
                grader_model=grader_model,
                num_examples=num_examples,  # Use the configured number of examples
                subset_name=subset_name,
                timeout_seconds=15  # 15 second timeout should be enough for 1 example
            )
            
        except Exception as eval_error:
            logger.error(f"💥 HealthBench evaluation failed: {eval_error}")
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": f"Evaluation failed: {str(eval_error)}",
                "evaluated_at": datetime.now().isoformat()
            }
        
        # Add metadata about the evaluation
        result["evaluation_type"] = "healthbench"
        result["transcript_turns"] = len(messages)
        result["grader_model"] = grader_model
        result["evaluated_at"] = datetime.now().isoformat()
        
        if result.get("evaluation_successful"):
            logger.info(f"✅ HealthBench evaluation completed - Score: {result.get('score')}")
        else:
            logger.warning(f"⚠️ HealthBench evaluation failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error running HealthBench evaluation: {e}")
        return {
            "evaluation_type": "healthbench",
            "success": False,
            "error": str(e),
            "evaluated_at": datetime.now().isoformat()
        }


def observe_session(session, agent_id, host_url, room=None, bug_detector=None, enable_otel=False, otel_endpoint=None, telemetry_instance=None, **kwargs):  # CHANGE 1: room=None (optional)
    session_id = str(uuid.uuid4())
    
    try:        
        # Setup session data and usage collector using your existing functions
        usage_collector = setup_usage_collector()
        session_data = create_session_data(
            type('MockContext', (), {'room': type('MockRoom', (), {'name': session_id})})(), 
            time.time()
        )
        
        if telemetry_instance:
            session_data['telemetry_instance'] = telemetry_instance
        
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
            'whispey_data': None,
            'bug_detector': bug_detector,
            'telemetry_instance': telemetry_instance,
            'participant_join_time': None,
            'participant_leave_time': None,
            'user_connected': False,
            'room_billing_enabled': room is not None  # CHANGE 2: Add this flag
        }
        
        # Setup telemetry if enabled
        if enable_otel and telemetry_instance:
            telemetry_instance._setup_telemetry(session_id)
        
        # Setup event handlers with session
        setup_session_event_handlers(session, session_data, usage_collector, None, bug_detector)

        # CHANGE 3: Only setup room tracking if room is provided
        if room:
            
            # CHANGE 4: Check for existing participants
            for participant_identity, participant in room.remote_participants.items():
                if not participant_identity.lower().startswith("agent"):
                    session_info = _session_data_store[session_id]
                    if not session_info['user_connected']:
                        session_info['participant_join_time'] = time.time()
                        session_info['user_connected'] = True
                        logger.info(f"BSTART: User '{participant_identity}' was already in room")
            
            # Track participant join/leave for billing
            @room.on("participant_connected")
            def on_participant_connected(participant):
                if participant.identity and not participant.identity.lower().startswith("agent"):
                    if session_id in _session_data_store:
                        session_info = _session_data_store[session_id]
                        if not session_info['user_connected']:
                            session_info['participant_join_time'] = time.time()
                            session_info['user_connected'] = True
                            logger.info(f"BSTART: User '{participant.identity}' joined at {time.time()}")

            @room.on("participant_disconnected")
            def on_participant_disconnected(participant):
                if participant.identity and not participant.identity.lower().startswith("agent"):
                    if session_id in _session_data_store:
                        session_info = _session_data_store[session_id]
                        if session_info['user_connected'] and not session_info['participant_leave_time']:
                            session_info['participant_leave_time'] = time.time()
                            duration = int(time.time() - session_info['participant_join_time'])
                            logger.info(f"BEND: User '{participant.identity}' left. Duration: {duration}s")
        else:
            logger.info(f"⚠️ Room not provided - using transcript-based billing fallback")  # CHANGE 5: Log fallback
        
        # Add custom handlers for Whispey integration
        @session.on("disconnected")
        def on_disconnected(event):
            end_session_manually(session_id, "disconnected")
        
        @session.on("close")
        def on_session_close(event):
            error_msg = str(event.error) if hasattr(event, 'error') and event.error else None
            end_session_manually(session_id, "completed", error_msg)
        
        return session_id
        
    except Exception as e:
        logger.error(f"⚠️ Failed to set up metrics collection: {e}")
        return session_id

def calculate_bill_duration(transcript_data: list = None, usage_summary: dict = None, session_id: str = None) -> int:
    """
    Calculate bill duration with smart fallback:
    1. Try room-based billing (if room was passed): participant_leave_time - participant_join_time
    2. Fall back to transcript-based billing: STT/TTS timestamps
    
    Args:
        transcript_data: List of conversation turns with timestamps (for fallback)
        usage_summary: Usage summary with audio durations (for fallback)
        session_id: Session ID to get billing data
        
    Returns:
        Bill duration in seconds (integer)
    """
    
    if not session_id or session_id not in _session_data_store:
        logger.error(f"❌ Session {session_id} not found")
        return 0
    
    session_info = _session_data_store[session_id]
    
    # METHOD 1: Try room-based billing (if room was passed to start_session)
    if session_info.get('room_billing_enabled'):
        join_time = session_info.get('participant_join_time')
        leave_time = session_info.get('participant_leave_time')
        
        if join_time:
            # User joined - calculate room-based duration
            if not leave_time:
                leave_time = time.time()
            
            duration = int(leave_time - join_time)
            return duration
        else:
            return 0
    
    # METHOD 2: Fall back to transcript-based billing
    
    if not transcript_data or len(transcript_data) == 0:
        # Fallback: Use usage summary audio durations
        if usage_summary:
            stt_duration = usage_summary.get('stt_audio_duration', 0)
            tts_duration = usage_summary.get('tts_audio_duration', 0)
            total_duration = stt_duration + tts_duration
            if total_duration > 0:
                return int(total_duration)
        return 0
    
    # Extract speech events with start and end times
    speech_events = []
    
    for turn in transcript_data:
        if turn is None:
            continue
        
        # Process STT (user speech)
        stt_metrics = turn.get('stt_metrics', {})
        if stt_metrics and stt_metrics.get('timestamp'):
            start_time = stt_metrics['timestamp']
            duration = stt_metrics.get('audio_duration', 0)
            end_time = start_time + duration
            speech_events.append({'start': start_time, 'end': end_time})
        
        # Process TTS (agent speech)
        tts_metrics = turn.get('tts_metrics', {})
        if tts_metrics and tts_metrics.get('timestamp'):
            start_time = tts_metrics['timestamp']
            duration = tts_metrics.get('audio_duration', 0)
            end_time = start_time + duration
            speech_events.append({'start': start_time, 'end': end_time})
    
    # Calculate duration from speech events
    if len(speech_events) > 0:
        earliest_start = min(event['start'] for event in speech_events)
        latest_end = max(event['end'] for event in speech_events)
        
        billing_duration = int(latest_end - earliest_start)
        # logger.info(f"📊 Billing (Transcript): {billing_duration}s ({billing_duration//60}m {billing_duration%60}s)")
        return billing_duration
    
    # Last resort: usage summary
    if usage_summary:
        stt_duration = usage_summary.get('stt_audio_duration', 0)
        tts_duration = usage_summary.get('tts_audio_duration', 0)
        total_duration = stt_duration + tts_duration
        if total_duration > 0:
            return int(total_duration)
    
    return 0

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
    # Exclude phone identifiers from metadata
    dynamic_params: Dict[str, Any] = session_info['dynamic_params'] or {}
    sanitized_dynamic_params = {
        k: v for k, v in dynamic_params.items()
        if k not in {"phone_number", "customer_number", "phone"}
    }

    # FIXED: Define whispey_data at function level, not inside if block
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
            "complete_configuration": session_data.get('complete_configuration') if session_data else None,
            **sanitized_dynamic_params  # Include dynamic parameters without phone identifiers
        }
    }
    
    # Add transcript data if available
    if session_data:
        transcript_data = session_data.get("transcript_with_metrics", [])
        
        # Calculate bill duration based on STT/TTS timestamps with fallback
        bill_duration_seconds = calculate_bill_duration(transcript_data,usage_summary,session_id=session_id)
        
        # Determine which method was used for logging
        if len(transcript_data) == 0 and usage_summary:
            method_used = "usage summary audio durations"
        else:
            audio_timestamps_count = 0
            for turn in transcript_data:
                if turn is None:
                    continue
                stt_metrics = turn.get('stt_metrics')
                if stt_metrics and stt_metrics.get('timestamp'):
                    audio_timestamps_count += 1
                tts_metrics = turn.get('tts_metrics')
                if tts_metrics and tts_metrics.get('timestamp'):
                    audio_timestamps_count += 1
            
            method_used = "STT/TTS timestamps" if audio_timestamps_count >= 2 else "turn timestamps (fallback)"
        
        print(f"📊 Bill Duration: {bill_duration_seconds}s ({len(transcript_data)} transcripts, using {method_used})")
        
        # Ensure trace fields are included in each turn
        enhanced_transcript = []
        for turn in transcript_data:
            # Verify configuration exists
            if not turn.get('turn_configuration'):
                logger.warning(f"Turn {turn.get('turn_id', 'unknown')} missing configuration!")
                # Try to inject from session level as fallback
                turn['turn_configuration'] = session_data.get('complete_configuration')
            
            # Add trace fields to each turn if they exist
            enhanced_turn = {
                **turn,  # All existing fields
                'trace_id': turn.get('trace_id'),
                'otel_spans': turn.get('otel_spans', []),
                'tool_calls': turn.get('tool_calls', []),
                'trace_duration_ms': turn.get('trace_duration_ms'),
                'trace_cost_usd': turn.get('trace_cost_usd')
            }
            enhanced_transcript.append(enhanced_turn)
        
        whispey_data["transcript_with_metrics"] = enhanced_transcript
        
        # Add bill duration to metadata
        whispey_data["billing_duration_seconds"] = bill_duration_seconds
        
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

        # Add bug report data if available
        if 'bug_reports' in session_data:
            whispey_data["metadata"]["bug_reports"] = session_data['bug_reports']
        if 'bug_flagged_turns' in session_data:
            whispey_data["metadata"]["bug_flagged_turns"] = session_data['bug_flagged_turns']

    # Check if evaluation is requested via dynamic parameters
    dynamic_params = session_info.get('dynamic_params', {})
    eval_type = dynamic_params.get('eval')
    
    if eval_type == 'healthbench':
        logger.info(f"🧪 HealthBench evaluation requested for session {session_id}")
        
        # Get transcript data for evaluation
        transcript_for_eval = []
        
        # First try transcript_json (standard format)
        if whispey_data.get("transcript_json") and len(whispey_data["transcript_json"]) > 0:
            transcript_for_eval = whispey_data["transcript_json"]
            logger.info(f"🔍 Using transcript_json with {len(transcript_for_eval)} messages")
        
        # Then try transcript_with_metrics (turn-based format)
        elif whispey_data.get("transcript_with_metrics") and len(whispey_data["transcript_with_metrics"]) > 0:
            logger.info(f"🔍 Processing {len(whispey_data['transcript_with_metrics'])} turns from transcript_with_metrics")
            
            for i, turn in enumerate(whispey_data["transcript_with_metrics"]):
                # Check for both possible field names (agent_response is the actual field name)
                user_content = turn.get('user_transcript', '').strip()
                agent_content = (turn.get('agent_response', '') or turn.get('assistant_response', '')).strip()
                
                logger.debug(f"Turn {i}: user='{user_content[:50]}...', agent='{agent_content[:50]}...'")
                
                if user_content and agent_content:
                    transcript_for_eval.extend([
                        {"role": "user", "content": user_content},
                        {"role": "assistant", "content": agent_content}
                    ])
                elif user_content or agent_content:
                    logger.warning(f"Turn {i} incomplete: user={bool(user_content)}, agent={bool(agent_content)}")
        
        # Log what we found
        if transcript_for_eval:
            logger.info(f"🔍 Prepared {len(transcript_for_eval)} messages for HealthBench evaluation")
        else:
            logger.warning("🔍 No transcript data found for evaluation")
            logger.debug(f"Available keys in whispey_data: {list(whispey_data.keys())}")
            if whispey_data.get("transcript_with_metrics"):
                sample_turn = whispey_data["transcript_with_metrics"][0] if whispey_data["transcript_with_metrics"] else {}
                logger.debug(f"Sample turn keys: {list(sample_turn.keys())}")
                logger.debug(f"Sample turn content: {sample_turn}")
        
        if transcript_for_eval:
            # Get evaluation configuration from dynamic parameters
            eval_config = {
                'grader_model': dynamic_params.get('eval_grader_model', 'gpt-4o-mini'),
                'num_examples': dynamic_params.get('eval_num_examples', None),
                'subset_name': dynamic_params.get('eval_subset_name', None)
            }
            
            # Run HealthBench evaluation in a separate thread to prevent blocking
            import threading
            import queue
            
            result_queue = queue.Queue()
            
            def run_eval_thread():
                try:
                    result = _run_healthbench_evaluation(transcript_for_eval, eval_config)
                    result_queue.put(("success", result))
                except Exception as e:
                    result_queue.put(("error", str(e)))
            
            # Start evaluation in background thread
            eval_thread = threading.Thread(target=run_eval_thread, daemon=True)
            eval_thread.start()
            
            # Wait for result with timeout
            try:
                status, eval_result = result_queue.get(timeout=30)  # 30 second timeout
                if status == "error":
                    logger.error(f"💥 HealthBench evaluation thread failed: {eval_result}")
                    eval_result = {
                        "evaluation_type": "healthbench",
                        "success": False,
                        "error": f"Evaluation thread failed: {eval_result}",
                        "evaluated_at": datetime.now().isoformat()
                    }
            except queue.Empty:
                logger.error("⏰ HealthBench evaluation timed out after 30 seconds")
                eval_result = {
                    "evaluation_type": "healthbench",
                    "success": False,
                    "error": "Evaluation timed out after 30 seconds",
                    "evaluated_at": datetime.now().isoformat()
                }
            
            # Add evaluation results to metadata
            whispey_data["metadata"]["evaluation"] = eval_result
        else:
            logger.warning(f"⚠️ No transcript data available for HealthBench evaluation in session {session_id}")
            whispey_data["metadata"]["evaluation"] = {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "No transcript data available for evaluation"
            }
    
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






def categorize_span(span_name: str) -> str:
    """Categorize span by operation type for easier filtering"""
    if not span_name:
        return "other"
        
    name_lower = span_name.lower()
    
    if any(x in name_lower for x in ['llm_request', 'llm_node', 'llm']):
        return "llm"
    elif any(x in name_lower for x in ['tts_request', 'tts_node', 'tts']):
        return "tts"
    elif any(x in name_lower for x in ['stt_request', 'stt_node', 'stt']):
        return "stt"
    elif 'function_tool' in name_lower or 'tool' in name_lower:
        return "tool"
    elif 'user_turn' in name_lower or 'user_speaking' in name_lower:
        return "user_interaction"
    elif 'assistant_turn' in name_lower or 'agent_speaking' in name_lower:
        return "assistant_interaction"
    elif 'session' in name_lower:
        return "session_management"
    else:
        return "other"

def calculate_duration_ms(span) -> float:
    """Calculate span duration in milliseconds"""
    try:
        start_time = span.get('start_time', 0)
        end_time = span.get('end_time', 0)
        
        if start_time and end_time and end_time > start_time:
            # Assume timestamps are in nanoseconds, convert to milliseconds
            return (end_time - start_time) / 1_000_000
        
        # Fallback to duration if available
        duration = span.get('duration', 0)
        if duration > 0:
            return duration * 1000  # Convert seconds to milliseconds
            
        return 0
    except Exception:
        return 0

def extract_key_attributes(span) -> dict:
    """Extract only the most important attributes for analysis"""
    try:
        attributes = span.get('attributes', {})
        
        # Handle string attributes (sometimes they're stringified)
        if isinstance(attributes, str):
            try:
                import json
                attributes = json.loads(attributes)
            except:
                return {}
        
        if not isinstance(attributes, dict):
            return {}
        
        # Extract key attributes that are useful for analysis
        key_attrs = {}
        important_keys = [
            'session_id', 'lk.user_transcript', 'lk.response.text', 
            'gen_ai.request.model', 'lk.speech_id', 'lk.interrupted',
            'gen_ai.usage.input_tokens', 'gen_ai.usage.output_tokens',
            'lk.tts.streaming', 'lk.input_text', 'model_name',
            'prompt_tokens', 'completion_tokens', 'characters_count',
            'audio_duration', 'request_id', 'error'
        ]
        
        for key in important_keys:
            if key in attributes:
                key_attrs[key] = attributes[key]
        
        return key_attrs
    except Exception:
        return {}

def generate_span_id(span) -> str:
    """Generate a unique span ID"""
    try:
        # Try to use existing span_id or create one
        if 'span_id' in span:
            return str(span['span_id'])
        
        # Generate from name and timestamp
        name = span.get('name', 'unknown')
        timestamp = span.get('start_time', time.time())
        return f"span_{name}_{int(timestamp)}"[:64]  # Limit length
    except Exception:
        return f"span_unknown_{int(time.time())}"

def extract_trace_id(span) -> str:
    """Extract trace ID from span"""
    try:
        if 'trace_id' in span:
            return str(span['trace_id'])
        
        # Check in attributes
        attributes = span.get('attributes', {})
        if isinstance(attributes, dict) and 'trace_id' in attributes:
            return str(attributes['trace_id'])
        
        return None
    except Exception:
        return None

def build_critical_path(spans) -> list:
    """Build the critical path of main conversation flow"""
    try:
        if not spans:
            return []
        
        critical_spans = []
        
        # Sort spans by start time
        sorted_spans = sorted(spans, key=lambda x: x.get('start_time', 0))
        
        # Focus on main conversation flow operations
        for span in sorted_spans:
            operation_type = span.get('operation_type', 'other')
            if operation_type in ['user_interaction', 'assistant_interaction', 'llm', 'tts', 'stt', 'tool']:
                critical_spans.append({
                    "name": span.get('name', 'unknown'),
                    "operation_type": operation_type,
                    "duration_ms": span.get('duration_ms', 0),
                    "start_time": span.get('start_time', 0)
                })
        
        return critical_spans
    except Exception as e:
        logger.error(f"Error building critical path: {e}")
        return []


def structure_telemetry_data(session_id: str) -> Dict[str, Any]:
    """Structure telemetry spans data for better analysis - PRESERVE ALL ORIGINAL DATA"""
    try:
        telemetry_data = {
            "session_traces": [],
            "performance_metrics": {
                "total_spans": 0,
                "avg_llm_latency": 0,
                "avg_tts_latency": 0,
                "avg_stt_latency": 0,
                "total_tool_calls": 0
            },
            "span_summary": {
                "by_operation": {},
                "by_turn": {},
                "critical_path": []
            }
        }
        
        if session_id not in _session_data_store:
            return telemetry_data
            
        session_info = _session_data_store[session_id]
        telemetry_instance = session_info.get('telemetry_instance')
        
        if not telemetry_instance or not hasattr(telemetry_instance, 'spans_data'):
            return telemetry_data
            
        spans = telemetry_instance.spans_data
        if not spans:
            return telemetry_data
                    
        operation_counts = {}
        latency_sums = {"llm": [], "tts": [], "stt": [], "tool": []}
        
        # PRESERVE ALL ORIGINAL SPAN DATA - don't clean/filter
        for span in spans:
            try:
                # Add operation_type categorization but keep everything else
                span_name = span.get('name', 'unknown')
                operation_type = categorize_span(span_name)
                
                # Keep the entire original span, just add our categorization
                enhanced_span = dict(span)  # Copy all original data
                enhanced_span['operation_type'] = operation_type
                enhanced_span['source'] = 'otel_capture'
                
                telemetry_data["session_traces"].append(enhanced_span)
                
                # Collect metrics for summary
                operation_counts[operation_type] = operation_counts.get(operation_type, 0) + 1
                
                # Calculate duration if available
                duration_ms = calculate_duration_ms(span)
                if duration_ms > 0 and operation_type in latency_sums:
                    latency_sums[operation_type].append(duration_ms)
                    
            except Exception as e:
                logger.error(f"Error processing span {span}: {e}")
                continue
        
        # Build summary metrics
        telemetry_data["span_summary"]["by_operation"] = operation_counts
        telemetry_data["performance_metrics"] = {
            "total_spans": len(telemetry_data["session_traces"]),
            "avg_llm_latency": sum(latency_sums["llm"]) / len(latency_sums["llm"]) if latency_sums["llm"] else 0,
            "avg_tts_latency": sum(latency_sums["tts"]) / len(latency_sums["tts"]) if latency_sums["tts"] else 0,
            "avg_stt_latency": sum(latency_sums["stt"]) / len(latency_sums["stt"]) if latency_sums["stt"] else 0,
            "total_tool_calls": operation_counts.get("tool", 0),
            "total_user_interactions": operation_counts.get("user_interaction", 0),
            "total_assistant_interactions": operation_counts.get("assistant_interaction", 0)
        }
        
        # Build critical path (fix the sorting issue)
        try:
            sorted_spans = [s for s in telemetry_data["session_traces"] if s.get('start_time_ns')]
            sorted_spans.sort(key=lambda x: x.get('start_time_ns', 0))
            telemetry_data["span_summary"]["critical_path"] = build_critical_path(sorted_spans)
        except Exception as e:
            logger.error(f"Error building critical path: {e}")
            telemetry_data["span_summary"]["critical_path"] = []
        
        return telemetry_data
        
    except Exception as e:
        logger.error(f"Error structuring telemetry data: {e}")
        return {
            "session_traces": [],
            "performance_metrics": {"total_spans": 0, "avg_llm_latency": 0, "avg_tts_latency": 0, "avg_stt_latency": 0, "total_tool_calls": 0},
            "span_summary": {"by_operation": {}, "by_turn": {}, "critical_path": []}
        }





async def send_session_to_whispey(session_id: str, recording_url: str = "", additional_transcript: list = None, force_end: bool = True, apikey: str = None, api_url: str = None, environment: str = "production", **extra_data) -> dict:
    """
    Send session data to Whispey API
    
    Args:
        session_id: Session ID to send
        recording_url: URL of the call recording
        additional_transcript: Additional transcript data if needed
        force_end: Whether to force end the session before sending (default: True)
        apikey: Custom API key to use. If not provided, uses WHISPEY_API_KEY environment variable
        api_url: Override the default API URL (e.g., your own host). Defaults to built-in Lambda URL
    
    Returns:
        dict: Response from Whispey API
    """
    logger.info(f"🚀 Starting send_session_to_whispey for {session_id}")
    
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found in data store")
        return {"success": False, "error": "Session not found"}
    
    session_info = _session_data_store[session_id]
    
    # Force end session if requested and still active
    if force_end and session_info['call_active']:
        logger.info(f"🔚 Force ending session {session_id}")
        end_session_manually(session_id, "completed")
    
    # Get whispey data
    whispey_data = get_session_whispey_data(session_id)

    # REPLACE the simple telemetry_spans assignment with structured data
    structured_telemetry = structure_telemetry_data(session_id)
    whispey_data["telemetry_data"] = structured_telemetry


    
    
    if not whispey_data:
        logger.error(f"No whispey data generated for session {session_id}")
        return {"success": False, "error": "No data available"}
    
    # Update with additional data
    if recording_url:
        whispey_data["recording_url"] = recording_url
    
    if additional_transcript:
        whispey_data["transcript_json"] = additional_transcript
    
    
    try:
        logger.info(f"📤 Sending to Whispey API...")
        result = await send_to_whispey(whispey_data, apikey=apikey, api_url=api_url, environment=environment)
        
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
