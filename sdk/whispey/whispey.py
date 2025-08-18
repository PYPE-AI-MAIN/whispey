import time
import uuid
import logging
import json
from datetime import datetime
from typing import Dict, Any, List
from whispey.metrics_service import setup_session_event_handlers, safe_extract_transcript_data
from whispey.metrics_service import setup_usage_collector, create_session_data
from whispey.send_log import send_to_whispey
from livekit.agents.telemetry import set_tracer_provider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.trace import Span

logger = logging.getLogger("observe_session")

# Global session storage - store data, not class instances
_session_data_store = {}

# Global telemetry storage for JSON export
_telemetry_data_store = {}

class JSONTelemetryExporter(SpanExporter):
    """Your existing custom exporter - unchanged"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        if session_id not in _telemetry_data_store:
            _telemetry_data_store[session_id] = {
                "spans": [],
                "session_start": time.time(),
                "session_end": None
            }
    
    def export(self, spans) -> SpanExportResult:
        """Export spans to our JSON storage"""
        try:
            for span in spans:
                span_data = {
                    "name": span.name,
                    "trace_id": format(span.get_span_context().trace_id, '032x'),
                    "span_id": format(span.get_span_context().span_id, '016x'),
                    "parent_id": format(span.parent.span_id, '016x') if span.parent else None,
                    "start_time": span.start_time,
                    "end_time": span.end_time,
                    "duration_ms": (span.end_time - span.start_time) / 1_000_000 if span.end_time else None,
                    "status": str(span.status.status_code) if span.status else "UNSET",
                    "attributes": dict(span.attributes) if span.attributes else {},
                    "events": [
                        {
                            "name": event.name,
                            "timestamp": event.timestamp,
                            "attributes": dict(event.attributes) if event.attributes else {}
                        }
                        for event in span.events
                    ] if span.events else []
                }
                
                _telemetry_data_store[self.session_id]["spans"].append(span_data)
                
            return SpanExportResult.SUCCESS
        except Exception as e:
            logger.error(f"Failed to export telemetry spans: {e}")
            return SpanExportResult.FAILURE
    
    def shutdown(self):
        """Mark session as ended"""
        if self.session_id in _telemetry_data_store:
            _telemetry_data_store[self.session_id]["session_end"] = time.time()

def setup_livekit_telemetry(telemetry_provider: str = "console", session_id: str = None):
    """Your existing telemetry setup - unchanged"""
    import os
    
    try:
        trace_provider = TracerProvider()
        
        # Always add JSON exporter for session storage
        if session_id:
            json_exporter = JSONTelemetryExporter(session_id)
            trace_provider.add_span_processor(BatchSpanProcessor(json_exporter))
        
        if telemetry_provider == "console":
            # Console exporter for debugging
            from opentelemetry.sdk.trace.export import ConsoleSpanExporter
            trace_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("✅ LiveKit telemetry enabled - Console output + JSON capture")
            
        elif telemetry_provider == "langfuse":
            # Langfuse configuration
            public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
            secret_key = os.getenv("LANGFUSE_SECRET_KEY")
            host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
            
            if not public_key or not secret_key:
                logger.error("❌ Langfuse telemetry requires LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY")
                return False
            
            import base64
            langfuse_auth = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
            os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"{host.rstrip('/')}/api/public/otel"
            os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {langfuse_auth}"
            
            trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
            logger.info(f"✅ LiveKit telemetry enabled - Langfuse ({host})")
            
        elif telemetry_provider == "datadog":
            # Datadog configuration
            dd_api_key = os.getenv("DD_API_KEY")
            dd_site = os.getenv("DD_SITE", "datadoghq.com")
            
            if not dd_api_key:
                logger.error("❌ Datadog telemetry requires DD_API_KEY")
                return False
            
            os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"https://otlp.{dd_site}/v1/traces"
            os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"dd-api-key={dd_api_key}"
            
            trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
            logger.info(f"✅ LiveKit telemetry enabled - Datadog ({dd_site})")
            
        elif telemetry_provider == "jaeger":
            # Jaeger configuration
            jaeger_endpoint = os.getenv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")
            os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = jaeger_endpoint
            
            trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
            logger.info(f"✅ LiveKit telemetry enabled - Jaeger ({jaeger_endpoint})")
            
        elif telemetry_provider == "custom":
            # Custom OTLP endpoint
            endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
            if not endpoint:
                logger.error("❌ Custom telemetry requires OTEL_EXPORTER_OTLP_ENDPOINT")
                return False
            
            trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
            logger.info(f"✅ LiveKit telemetry enabled - Custom endpoint ({endpoint})")
            
        else:
            logger.error(f"❌ Unknown telemetry provider: {telemetry_provider}")
            return False
        
        set_tracer_provider(trace_provider)
        return True
        
    except Exception as e:
        logger.warning(f"⚠️ Failed to setup LiveKit telemetry: {e}")
        return False

def observe_session(session, agent_id, telemetry_provider="console", **kwargs):
    """Your existing observe_session with enhanced data collection"""
    session_id = str(uuid.uuid4())
    
    logger.info(f"🔗 Setting up Enhanced Whispey-compatible metrics collection for session {session_id}")
    logger.info(f"📋 Dynamic parameters: {list(kwargs.keys())}")
    
    # Setup LiveKit telemetry
    setup_livekit_telemetry(telemetry_provider, session_id)
    
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
        
        logger.info(f"✅ Enhanced Whispey-compatible metrics collection active for session {session_id}")
        return session_id
        
    except Exception as e:
        logger.error(f"⚠️ Failed to set up metrics collection: {e}")
        return session_id

def generate_whispey_data(session_id: str, status: str = "in_progress", error: str = None) -> Dict[str, Any]:
    """ENHANCED: Generate Whispey data with model and tool information"""
    if session_id not in _session_data_store:
        logger.error(f"Session {session_id} not found in data store")
        return {}
    
    session_info = _session_data_store[session_id]
    current_time = time.time()
    start_time = session_info['start_time']
    
    # Extract transcript data using enhanced function with telemetry
    session_data = session_info['session_data']
    telemetry_spans = _telemetry_data_store.get(session_id, {}).get("spans", [])
    
    if session_data:
        try:
            # NEW: Pass telemetry spans for automatic tool extraction
            safe_extract_transcript_data(session_data, telemetry_spans)
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
    
    # NEW: Enhanced analysis from transcript data
    enhanced_analytics = {}
    transcript_data = session_data.get("transcript_with_metrics", [])
    
    if transcript_data:
        # Extract model usage analytics
        model_usage = {
            'stt_models': set(),
            'llm_models': set(), 
            'tts_models': set(),
            'total_cost': 0.0,
            'tool_calls_total': 0,
            'tool_success_rate': 1.0
        }
        
        total_tools = 0
        successful_tools = 0
        
        for turn in transcript_data:
            if not turn:  # ADD THIS LINE
                continue 
            # Collect model information
            if turn.get('stt_metrics', {}).get('model_name'):
                model_usage['stt_models'].add(turn['stt_metrics']['model_name'])
            if turn.get('llm_metrics', {}).get('model_name'):
                model_usage['llm_models'].add(turn['llm_metrics']['model_name'])
            if turn.get('tts_metrics', {}).get('model_name'):
                model_usage['tts_models'].add(turn['tts_metrics']['model_name'])
            
            # Collect cost information
            if turn.get('cost_breakdown', {}).get('total_turn_cost'):
                model_usage['total_cost'] += turn['cost_breakdown']['total_turn_cost']
            
            # Collect tool information
            tool_calls = turn.get('tool_calls', [])
            total_tools += len(tool_calls)
            successful_tools += sum(1 for tool in tool_calls if tool.get('success', True))
        
        # Calculate tool success rate
        if total_tools > 0:
            model_usage['tool_success_rate'] = successful_tools / total_tools
            model_usage['tool_calls_total'] = total_tools
        
        # Convert sets to lists for JSON serialization
        model_usage['stt_models'] = list(model_usage['stt_models'])
        model_usage['llm_models'] = list(model_usage['llm_models'])
        model_usage['tts_models'] = list(model_usage['tts_models'])
        
        enhanced_analytics = {
            'model_usage_summary': model_usage,
            'conversation_quality': {
                'total_turns': len(transcript_data),
                'avg_cost_per_turn': model_usage['total_cost'] / len(transcript_data) if transcript_data else 0,
                'models_used_count': len(model_usage['stt_models']) + len(model_usage['llm_models']) + len(model_usage['tts_models']),
                'tools_reliability': model_usage['tool_success_rate']
            }
        }
    
    # Prepare enhanced Whispey format data
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
            # Your existing usage data
            "usage": usage_summary,
            "duration_formatted": f"{duration // 60}m {duration % 60}s",
            "call_success": status == "completed",
            "error": error,
            
            # NEW: Enhanced analytics
            "enhanced_analytics": enhanced_analytics,
            
            # NEW: Session-level insights
            "session_insights": {
                "conversation_turns": len(transcript_data),
                "total_session_cost": enhanced_analytics.get('model_usage_summary', {}).get('total_cost', 0),
                "models_used": {
                    "stt": enhanced_analytics.get('model_usage_summary', {}).get('stt_models', []),
                    "llm": enhanced_analytics.get('model_usage_summary', {}).get('llm_models', []),
                    "tts": enhanced_analytics.get('model_usage_summary', {}).get('tts_models', [])
                },
                "tools_performance": {
                    "total_calls": enhanced_analytics.get('model_usage_summary', {}).get('tool_calls_total', 0),
                    "success_rate": enhanced_analytics.get('model_usage_summary', {}).get('tool_success_rate', 1.0)
                }
            },
            
            # Your existing dynamic parameters
            **session_info['dynamic_params']
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
    """Your existing function - unchanged"""
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
    """Your existing function - unchanged"""
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
    """Your existing function - unchanged"""
    if session_id in _session_data_store:
        del _session_data_store[session_id]
        logger.info(f"🗑️ Cleaned up session {session_id}")

async def send_session_to_whispey(session_id: str, recording_url: str = "", additional_transcript: list = None, force_end: bool = True, apikey: str = None, host_url: str | None = None) -> dict:
    """ENHANCED: Send session data to Whispey API with rich analytics"""
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
    
    # NEW: Enhanced debug print with model and tool info
    print("=== ENHANCED WHISPEY DATA FOR SENDING ===")
    print(f"Call ID: {whispey_data.get('call_id', 'N/A')}")
    print(f"Agent ID: {whispey_data.get('agent_id', 'N/A')}")
    print(f"Duration: {whispey_data.get('metadata', {}).get('duration_formatted', 'N/A')}")
    print(f"Usage: {whispey_data.get('metadata', {}).get('usage', {})}")
    
    # NEW: Show model and tool information
    session_insights = whispey_data.get('metadata', {}).get('session_insights', {})
    if session_insights:
        print(f"Models Used: STT: {session_insights.get('models_used', {}).get('stt', [])}")
        print(f"            LLM: {session_insights.get('models_used', {}).get('llm', [])}")
        print(f"            TTS: {session_insights.get('models_used', {}).get('tts', [])}")
        print(f"Tools: {session_insights.get('tools_performance', {}).get('total_calls', 0)} calls, {session_insights.get('tools_performance', {}).get('success_rate', 0):.1%} success")
        print(f"Total Cost: ${session_insights.get('total_session_cost', 0):.4f}")
    
    print("============================")
    
    # Send to Whispey
    try:
        logger.info(f"📤 Sending to Whispey API...")
        result = await send_to_whispey(whispey_data, apikey=apikey, host_url=host_url)
        
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

# Your existing utility functions stay the same
def get_latest_session():
    """Your existing function - unchanged"""
    if _session_data_store:
        latest_id = max(_session_data_store.keys(), key=lambda x: _session_data_store[x]['start_time'])
        return latest_id, _session_data_store[latest_id]
    return None, None

def get_all_active_sessions():
    """Your existing function - unchanged"""
    return [sid for sid, data in _session_data_store.items() if data['call_active']]

def cleanup_all_sessions():
    """Your existing function - unchanged"""
    session_ids = list(_session_data_store.keys())
    for session_id in session_ids:
        end_session_manually(session_id, "cleanup")
        cleanup_session(session_id)
    logger.info(f"🗑️ Cleaned up {len(session_ids)} sessions")

def debug_session_state(session_id: str = None):
    """Your existing function - unchanged"""
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

def save_telemetry_to_json(session_id: str, filename: str = None) -> str:
    """ENHANCED: Save telemetry data with model and tool analytics"""
    if session_id not in _telemetry_data_store:
        logger.warning(f"No telemetry data found for session {session_id}")
        return None
    
    try:
        # Get pure telemetry data only
        telemetry_data = _telemetry_data_store[session_id].copy()
        
        # Mark session end if not already marked
        if not telemetry_data.get("session_end"):
            telemetry_data["session_end"] = time.time()
        
        # Create enhanced telemetry JSON structure
        enhanced_telemetry = {
            "resource": {
                "attributes": {
                    "service.name": "livekit-agent",
                    "service.version": "1.0.0",
                    "session.id": session_id
                }
            },
            "instrumentation_scope": {
                "name": "livekit.agents.telemetry",
                "version": "1.0.0"
            },
            "spans": telemetry_data.get("spans", []),
            "metadata": {
                "session_id": session_id,
                "session_start_time": telemetry_data.get("session_start"),
                "session_end_time": telemetry_data.get("session_end"),
                "total_spans": len(telemetry_data.get("spans", [])),
                "export_timestamp": datetime.now().isoformat()
            }
        }
        
        # Add enhanced span statistics
        span_stats = {}
        total_duration = 0
        model_operations = {'stt': 0, 'llm': 0, 'tts': 0, 'tool': 0}
        
        for span in telemetry_data.get("spans", []):
            span_name = span.get("name", "unknown")
            duration = span.get("duration_ms", 0) or 0
            
            if span_name not in span_stats:
                span_stats[span_name] = {
                    "count": 0,
                    "total_duration_ms": 0,
                    "avg_duration_ms": 0,
                    "min_duration_ms": float('inf'),
                    "max_duration_ms": 0
                }
            
            span_stats[span_name]["count"] += 1
            span_stats[span_name]["total_duration_ms"] += duration
            span_stats[span_name]["min_duration_ms"] = min(span_stats[span_name]["min_duration_ms"], duration)
            span_stats[span_name]["max_duration_ms"] = max(span_stats[span_name]["max_duration_ms"], duration)
            total_duration += duration
            
            # NEW: Count AI model operations
            if 'stt' in span_name.lower():
                model_operations['stt'] += 1
            elif 'llm' in span_name.lower():
                model_operations['llm'] += 1
            elif 'tts' in span_name.lower():
                model_operations['tts'] += 1
            elif 'tool' in span_name.lower() or 'function' in span_name.lower():
                model_operations['tool'] += 1
        
        # Calculate averages
        for stat in span_stats.values():
            if stat["count"] > 0:
                stat["avg_duration_ms"] = stat["total_duration_ms"] / stat["count"]
                if stat["min_duration_ms"] == float('inf'):
                    stat["min_duration_ms"] = 0
        
        enhanced_telemetry["statistics"] = {
            "total_session_duration_ms": (telemetry_data.get("session_end", time.time()) - telemetry_data.get("session_start", 0)) * 1000,
            "total_operation_duration_ms": total_duration,
            "span_statistics": span_stats,
            
            # NEW: AI model operation counts
            "ai_operations_summary": {
                "stt_operations": model_operations['stt'],
                "llm_operations": model_operations['llm'], 
                "tts_operations": model_operations['tts'],
                "tool_operations": model_operations['tool'],
                "total_ai_operations": sum(model_operations.values())
            }
        }
        
        # Generate filename
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"enhanced_telemetry_{session_id}_{timestamp}.json"
        
        # Save enhanced telemetry to file
        with open(filename, 'w') as f:
            json.dump(enhanced_telemetry, f, indent=2, default=str)
        
        logger.info(f"📊 Enhanced telemetry data saved to: {filename}")
        logger.info(f"   - Total spans: {len(telemetry_data.get('spans', []))}")
        logger.info(f"   - Span types: {list(span_stats.keys())}")
        logger.info(f"   - Total operations duration: {total_duration:.2f}ms")
        logger.info(f"   - AI operations: STT:{model_operations['stt']}, LLM:{model_operations['llm']}, TTS:{model_operations['tts']}, Tools:{model_operations['tool']}")
        
        return filename
        
    except Exception as e:
        logger.error(f"❌ Failed to save enhanced telemetry data: {e}")
        return None