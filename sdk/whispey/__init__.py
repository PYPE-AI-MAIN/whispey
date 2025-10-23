# sdk/whispey/__init__.py
"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "2.1.1"
__author__ = "Whispey AI Voice Analytics"

import re
import logging
from typing import List, Optional, AsyncIterable, Any, Union, Dict
from .whispey import observe_session, send_session_to_whispey
import time

logger = logging.getLogger("whispey-sdk")

# Professional wrapper class
class LivekitObserve:
    def __init__(
        self, 
        agent_id="whispey-agent",
        apikey=None, 
        host_url=None, 
        environment="production",
        bug_reports_enable=False,
        bug_reports_config: Dict[str, Any] = {},
        enable_otel: bool = True,
    ):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
        self.environment = environment.lower()
        self.enable_otel = enable_otel
        self.spans_data = []  
        self._current_turn_context = {
            'turn_id': None,
            'turn_sequence': 0
        }
        
        if bug_reports_enable:
            self.enable_bug_reports = True
            
            # Default configuration
            default_config = {
                'bug_start_command': ['feedback start'],
                'bug_end_command': ['feedback over'],
                'response': 'Please tell me the issue?',
                'continuation_prefix': 'So, as I was saying, ',
                'fallback_message': 'So, as I was saying,',
                'collection_prompt': '',
                'debug': False
            }
            
            # Merge user config with defaults
            config = {**default_config, **bug_reports_config}
        else:
            self.enable_bug_reports = False
            config = {}
        
        start_patterns = config.get('bug_start_command', ['feedback start'])
        end_patterns = config.get('bug_end_command', ['feedback over'])
        
        self.bug_start_patterns = self._convert_to_regex(start_patterns)
        self.bug_end_patterns = self._convert_to_regex(end_patterns)

        if not start_patterns:
            start_patterns = ['feedback start']
        if not end_patterns:
            end_patterns = ['feedback over']
        
        self.bug_report_response = config.get(
            'response', 
            "Please tell me the issue?"
        )
        self.continuation_prefix = config.get(
            'continuation_prefix',
            "So, as I was saying, "
        )
        self.fallback_message = config.get(
            'fallback_message',
            "So, as I was saying, "
        )
        self.collection_prompt = config.get(
            'collection_prompt',
            ""
        )

        self.bug_report_debug = config.get('debug', False)

    def _update_turn_context(self, turn_id, sequence=None):
        """Update the current turn context"""
        self._current_turn_context = {
            'turn_id': turn_id,
            'turn_sequence': sequence or (self._current_turn_context.get('turn_sequence', 0) + 1)
        }

    def _debug_log(self, message: str):
        """Debug logging for bug reports when enabled"""
        if self.bug_report_debug:
            print(f"🐛 BUG DEBUG: {message}")
            logger.debug(f"BUG DEBUG: {message}")

    def _setup_telemetry(self, session_id):
        if not self.enable_otel:
            return None
        
        from opentelemetry.sdk.trace import TracerProvider, SpanProcessor
        import time
        import uuid
        import logging
        
        logger = logging.getLogger("whispey-sdk")
        
        tracer_provider = TracerProvider()

        class WhispeySpanCollector(SpanProcessor):
            """Custom span processor that only collects spans without exporting them"""
            
            def __init__(self, whispey_instance):
                self.whispey = whispey_instance

            def on_start(self, span, parent_context=None):
                pass

            def on_end(self, span):
                # Enhanced request_id extraction
                request_id = self._extract_request_id_comprehensive(span)
                
                duration_ns = (span.end_time - span.start_time) if span.start_time and span.end_time else 0
                duration_ms = duration_ns / 1_000_000
                
                comprehensive_span_data = {
                    'name': span.name,
                    'start_time_ns': span.start_time,
                    'end_time_ns': span.end_time, 
                    'duration_ns': duration_ns,
                    'duration_ms': duration_ms,
                    'duration_seconds': duration_ms / 1000,
                    
                    'status': {
                        'code': span.status.status_code.value if span.status else 0,
                        'name': span.status.status_code.name if span.status else 'UNSET',
                        'description': getattr(span.status, 'description', None) if span.status else None
                    },
                    
                    'attributes': dict(span.attributes) if span.attributes else {},
                    
                    'events': [
                        {
                            'name': event.name,
                            'timestamp': getattr(event, 'timestamp', None),
                            'attributes': dict(event.attributes) if event.attributes else {}
                        }
                        for event in span.events
                    ] if span.events else [],
                    
                    'context': {
                        'trace_id': hex(span.get_span_context().trace_id) if hasattr(span, 'get_span_context') else None,
                        'span_id': hex(span.get_span_context().span_id) if hasattr(span, 'get_span_context') else None,
                        'trace_flags': int(span.get_span_context().trace_flags) if hasattr(span, 'get_span_context') and hasattr(span.get_span_context(), 'trace_flags') else None
                    } if hasattr(span, 'get_span_context') else {},
                    
                    'parent_span_id': hex(span.parent.span_id) if span.parent and hasattr(span.parent, 'span_id') else None,
                    'resource': dict(span.resource.attributes) if hasattr(span, 'resource') and span.resource and span.resource.attributes else {},
                    
                    'links': [
                        {
                            'context': {
                                'trace_id': hex(link.context.trace_id) if hasattr(link.context, 'trace_id') else None,
                                'span_id': hex(link.context.span_id) if hasattr(link.context, 'span_id') else None
                            },
                            'attributes': dict(link.attributes) if link.attributes else {}
                        }
                        for link in span.links
                    ] if hasattr(span, 'links') and span.links else [],
                    
                    'instrumentation_scope': {
                        'name': span.instrumentation_scope.name if hasattr(span, 'instrumentation_scope') and span.instrumentation_scope else None,
                        'version': getattr(span.instrumentation_scope, 'version', None) if hasattr(span, 'instrumentation_scope') and span.instrumentation_scope else None,
                        'schema_url': getattr(span.instrumentation_scope, 'schema_url', None) if hasattr(span, 'instrumentation_scope') and span.instrumentation_scope else None
                    },
                    
                    'kind': span.kind.name if hasattr(span, 'kind') and span.kind else 'INTERNAL',
                    
                    'exceptions': [
                        {
                            'type': event.attributes.get('exception.type'),
                            'message': event.attributes.get('exception.message'),
                            'stacktrace': event.attributes.get('exception.stacktrace'),
                            'timestamp': getattr(event, 'timestamp', None)
                        }
                        for event in (span.events or [])
                        if event.name == 'exception' and event.attributes
                    ],
                    
                    'request_id': request_id,
                    'request_id_source': self._get_request_id_source(span, request_id),
                    'captured_at': time.time(),
                    'sdk_version': '2.1.1',
                    'conversation_turn_id': self._get_current_turn_id(),
                    'turn_sequence': self._get_turn_sequence_number(),
                }
                
                self.whispey.spans_data.append(comprehensive_span_data)

            def shutdown(self):
                pass

            def force_flush(self, timeout_millis=30000):
                return True

            def _get_current_turn_id(self):
                if hasattr(self.whispey, '_current_turn_context'):
                    return self.whispey._current_turn_context.get('turn_id')
                return 'unknown_turn'

            def _get_turn_sequence_number(self):
                if hasattr(self.whispey, '_current_turn_context'):
                    return self.whispey._current_turn_context.get('turn_sequence', 0)
                return 0

            def _extract_request_id_comprehensive(self, span):
                span_attrs = span.attributes or {}
                
                # Method 1: Direct request_id attributes
                direct_keys = ['request_id', 'lk.request_id', 'gen_ai.request.id', 'gen_ai.request_id']
                for key in direct_keys:
                    if span_attrs.get(key):
                        return str(span_attrs[key])
                
                # Method 2: Extract from nested JSON in attributes
                json_keys = ['lk.llm_metrics', 'lk.tts_metrics', 'lk.stt_metrics']
                for key in json_keys:
                    if key in span_attrs:
                        try:
                            import json
                            metrics_data = json.loads(str(span_attrs[key]))
                            if isinstance(metrics_data, dict) and metrics_data.get('request_id'):
                                return str(metrics_data['request_id'])
                        except:
                            continue
                
                # Method 3: Extract from events
                events = span.events or []
                for event in events:
                    event_attrs = event.attributes or {}
                    for key in direct_keys:
                        if event_attrs.get(key):
                            return str(event_attrs[key])
                
                # Method 4: Generate deterministic ID from span characteristics
                span_name = span.name or 'unknown'
                start_time = span.start_time or 0
                
                if span_name and start_time:
                    import hashlib
                    context = span.get_span_context() if hasattr(span, 'get_span_context') else None
                    span_id = hex(context.span_id) if context else str(start_time)
                    content = f"{span_name}_{start_time}_{span_id}"
                    synthetic_id = hashlib.md5(content.encode()).hexdigest()[:16]
                    return synthetic_id
                
                return None

            def _get_request_id_source(self, span, request_id):
                if not request_id:
                    return 'none'
                
                span_attrs = span.attributes or {}
                direct_keys = ['request_id', 'lk.request_id', 'gen_ai.request.id', 'gen_ai.request_id']
                
                if any(span_attrs.get(key) for key in direct_keys):
                    return 'direct_attribute'
                
                json_keys = ['lk.llm_metrics', 'lk.tts_metrics', 'lk.stt_metrics']
                for key in json_keys:
                    if key in span_attrs:
                        try:
                            import json
                            metrics_data = json.loads(str(span_attrs[key]))
                            if isinstance(metrics_data, dict) and metrics_data.get('request_id'):
                                return 'nested_json'
                        except:
                            continue
                
                events = span.events or []
                for event in events:
                    event_attrs = event.attributes or {}
                    if any(event_attrs.get(key) for key in direct_keys):
                        return 'event_attribute'
                
                return 'synthetic'
        
        tracer_provider.add_span_processor(WhispeySpanCollector(self))

        from livekit.agents.telemetry import set_tracer_provider
        try:
            set_tracer_provider(tracer_provider, metadata={'session_id': session_id})
        except TypeError:
            # Fallback for older versions that don't support metadata
            set_tracer_provider(tracer_provider)

    
    def start_session(self, session,room=None, **kwargs):
        """Start session with earlier telemetry setup"""
        # Setup telemetry BEFORE observe_session if enabled
        temp_session_id = f"temp_{int(time.time())}"
        if self.enable_otel:
            self._setup_telemetry(temp_session_id)
        
        bug_detector = self if self.enable_bug_reports else None
        session_id = observe_session(
            session, 
            room=room,
            agent_id=self.agent_id, 
            host_url=self.host_url, 
            bug_detector=bug_detector,
            enable_otel=self.enable_otel,
            telemetry_instance=self,
            **kwargs
        )
        
        # Re-setup telemetry with actual session_id if different
        if self.enable_otel and session_id != temp_session_id:
            self._setup_telemetry(session_id)
        
        self._setup_prompt_capture(session, session_id)
        
        if self.enable_bug_reports:
            self._setup_bug_report_handling(session, session_id)
        
        return session_id

    def _setup_prompt_capture(self, session, session_id):
        """Setup prompt data capture by wrapping session.start"""
        original_start = session.start
        
        async def wrapped_start(*args, **kwargs):
            agent = kwargs.get('agent') or (args[0] if args else None)
            
            if agent:
                # Wrap the agent's llm_node method
                original_llm_node = agent.llm_node
                
                def wrapped_llm_node(chat_ctx, tools, model_settings):
                    # Capture prompt data here
                    self._capture_prompt_data(session_id, chat_ctx, tools, agent)
                    
                    # Call original llm_node
                    return original_llm_node(chat_ctx, tools, model_settings)
                
                agent.llm_node = wrapped_llm_node
            
            return await original_start(*args, **kwargs)
        
        session.start = wrapped_start


    def _capture_prompt_data(self, session_id, chat_ctx, tools, agent):
        """Capture the prompt data when LLM is called"""
        try:
            from .whispey import _session_data_store
            
            if session_id not in _session_data_store:
                return
                
            session_info = _session_data_store[session_id]
            session_data = session_info.get('session_data', {})
            
            conversation_history = []
            
            if hasattr(chat_ctx, 'messages') and chat_ctx.messages:
                for msg in chat_ctx.messages:
                    conversation_history.append({
                        'role': str(msg.role),
                        'content': str(msg.content) if msg.content else None,
                        'id': getattr(msg, 'id', None),
                        'name': getattr(msg, 'name', None),
                        'timestamp': getattr(msg, 'timestamp', None)
                    })
            
            # Method 2: Try items if messages doesn't exist
            elif hasattr(chat_ctx, 'items') and chat_ctx.items:
                for item in chat_ctx.items:
                    conversation_history.append({
                        'role': str(item.role) if hasattr(item, 'role') else 'unknown',
                        'content': str(item.content) if hasattr(item, 'content') and item.content else str(item.text_content) if hasattr(item, 'text_content') else None,
                        'id': getattr(item, 'id', None)
                    })
            
            # Method 3: Try to access via _items or other internal attributes
            elif hasattr(chat_ctx, '_items') and chat_ctx._items:
                for item in chat_ctx._items:
                    conversation_history.append({
                        'role': str(getattr(item, 'role', 'unknown')),
                        'content': str(getattr(item, 'content', None) or getattr(item, 'text_content', None) or ''),
                        'id': getattr(item, 'id', None)
                    })
            
            # Get system instructions from agent
            system_instructions = getattr(agent, 'instructions', None) or getattr(agent, '_instructions', None)
            
            # Get available tools - improved extraction
            available_tools = []
            for tool in tools:
                # Try multiple ways to extract tool info
                tool_name = None
                tool_description = None
                
                # Method 1: Direct attributes
                if hasattr(tool, 'name') and tool.name:
                    tool_name = str(tool.name)
                if hasattr(tool, 'description') and tool.description:
                    tool_description = str(tool.description)
                
                # Method 2: Check info attribute
                if hasattr(tool, 'info'):
                    info = tool.info
                    if hasattr(info, 'name') and info.name:
                        tool_name = str(info.name)
                    if hasattr(info, 'description') and info.description:
                        tool_description = str(info.description)
                
                # Method 3: Check function attribute for function tools
                if hasattr(tool, 'function'):
                    func = tool.function
                    if hasattr(func, '__name__'):
                        tool_name = func.__name__
                    if hasattr(func, '__doc__') and func.__doc__:
                        tool_description = func.__doc__.strip()
                
                # Method 4: Check _func attribute
                if hasattr(tool, '_func'):
                    func = tool._func
                    if hasattr(func, '__name__') and not tool_name:
                        tool_name = func.__name__
                    if hasattr(func, '__doc__') and func.__doc__ and not tool_description:
                        tool_description = func.__doc__.strip()
                
                # Method 5: Extract from callable
                if callable(tool) and hasattr(tool, '__name__') and not tool_name:
                    tool_name = tool.__name__
                if callable(tool) and hasattr(tool, '__doc__') and tool.__doc__ and not tool_description:
                    tool_description = tool.__doc__.strip()
                
                available_tools.append({
                    'name': tool_name or 'unknown_tool',
                    'description': tool_description or 'No description available',
                    'tool_type': type(tool).__name__
                })
            
            # Store prompt data
            prompt_data = {
                'system_instructions': system_instructions,
                'conversation_history': conversation_history,
                'available_tools': available_tools,
                'timestamp': time.time(),
                'context_length': len(conversation_history),
                'tools_count': len(available_tools)
            }
            
            # Add to session data
            if 'prompt_captures' not in session_data:
                session_data['prompt_captures'] = []
            
            session_data['prompt_captures'].append(prompt_data)
            

            
        except Exception as e:
            logger.error(f"Error capturing prompt data: {e}")
            import traceback
            traceback.print_exc()

    def _convert_to_regex(self, patterns: List[str]) -> List[str]:
        """Convert simple strings to regex patterns with Hindi support and case-insensitive English"""
        regex_patterns = []
        for pattern in patterns:
            if pattern.startswith('r\'') or '\\b' in pattern:
                regex_patterns.append(pattern)
            else:
                # Check if pattern contains Hindi characters (Devanagari script)
                hindi_chars = re.search(r'[\u0900-\u097F]', pattern)
                
                if hindi_chars:
                    # For Hindi text, don't use word boundaries, just escape and match literally
                    escaped = re.escape(pattern)
                    regex_patterns.append(escaped)
                else:
                    # For English text, convert to lowercase, use word boundaries, and make case-insensitive
                    pattern_lower = pattern.lower()
                    escaped = re.escape(pattern_lower)
                    regex_patterns.append(f'\\b{escaped}\\b')
        
        return regex_patterns
    
    def _is_bug_report(self, text: str) -> bool:
        """Check if user input is a bug report"""
        if not self.enable_bug_reports or not text:
            return False
        return any(re.search(pattern, text.lower()) for pattern in self.bug_start_patterns)
    
    def _is_done_reporting(self, text: str) -> bool:
        """Check if user is done reporting bugs"""
        if not text:
            return False
        return any(re.search(pattern, text.lower()) for pattern in self.bug_end_patterns)

    
    def _setup_bug_report_handling(self, session, session_id):
        """Setup simplified bug report handling - STT interception only"""
        
        original_start = session.start
        
        async def wrapped_start(*args, **kwargs):
            agent = kwargs.get('agent') or (args[0] if args else None)
            
            if agent:
                # Initialize bug report state
                agent._whispey_bug_report_mode = False
                agent._whispey_bug_details = []
                
                # Store original STT node
                if hasattr(agent, 'stt_node'):
                    agent._whispey_original_stt_node = agent.stt_node
                else:
                    agent._whispey_original_stt_node = None
                
                # Simple STT node with bug report detection
                async def bug_aware_stt_node(audio_stream, model_settings):
                    """STT node with bug report detection - with proper debug logging"""
                    
                    try:
                        # Get original STT result
                        if agent._whispey_original_stt_node:
                            stt_result = agent._whispey_original_stt_node(audio_stream, model_settings)
                        else:
                            from livekit.agents import Agent
                            if hasattr(Agent, 'default_stt_node'):
                                stt_result = Agent.default_stt_node(agent, audio_stream, model_settings)
                            else:
                                # Fallback for older versions
                                stt_result = agent.stt_node(audio_stream, model_settings)
                        
                        # STRATEGY: Always try await first
                        try:
                            # Try awaiting (this should work for v1.2.6, might work for v1.2.4)
                            stt_events = await stt_result
                        except TypeError as e:
                            # If await fails (async generator can't be awaited in v1.2.4)
                            if "can't be used in 'await' expression" in str(e):
                                stt_events = stt_result
                            else:
                                raise e  # Different TypeError, re-raise it
                        
                        # Now we should have an async generator in both cases
                        async for event in stt_events:
                            # Extract transcript from event
                            transcript = None
                            if hasattr(event, 'alternatives') and event.alternatives:
                                transcript = event.alternatives[0].text
                            elif hasattr(event, 'text'):
                                transcript = event.text
                            elif isinstance(event, str):
                                transcript = event
                            
                            # Skip empty transcripts but still yield the event
                            if not transcript or not transcript.strip():
                                yield event
                                continue
                            
                            transcript = transcript.strip()
                            
                            # Debug logging for STT level processing
                            if self.bug_report_debug:
                                print(f"🐛 STT DEBUG: Received transcript: '{transcript}'")
                                print(f"🐛 STT DEBUG: Current bug mode: {agent._whispey_bug_report_mode}")
                            
                            # Handle bug reporting cases
                            if agent._whispey_bug_report_mode and self._is_done_reporting(transcript):
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: ✅ Bug end detected: '{transcript}'")
                                    print(f"🐛 STT DEBUG: Collected {len(agent._whispey_bug_details)} bug messages")
                                
                                agent._whispey_bug_report_mode = False
                                await self._store_bug_report_details(session_id, agent._whispey_bug_details)
                                agent._whispey_bug_details = []
                                
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: Sending continuation message")
                                
                                await self._repeat_stored_message(session_id, session)
                                
                                # Don't yield this event - it's intercepted
                                continue
                                
                            elif not agent._whispey_bug_report_mode and self._is_bug_report(transcript):
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: ✅ Bug start detected: '{transcript}'")
                                
                                captured_message = await self._capture_and_store_last_message(session_id)
                                if not captured_message:
                                    if self.bug_report_debug:
                                        print(f"🐛 STT DEBUG: ⚠️ No message to capture")
                                else:
                                    if self.bug_report_debug:
                                        print(f"🐛 STT DEBUG: 📝 Captured message: '{captured_message[:50]}...'")
                                
                                agent._whispey_bug_report_mode = True
                                agent._whispey_bug_details = [{
                                    'type': 'initial_report',
                                    'text': transcript,
                                    'timestamp': __import__('time').time()
                                }]
                                
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: Sending bug response: '{self.bug_report_response}'")
                                
                                await session.say(self.bug_report_response, add_to_chat_ctx=False)
                                
                                # Don't yield this event - it's intercepted
                                continue
                                
                            elif agent._whispey_bug_report_mode:
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: 📥 Collecting bug details: '{transcript}'")
                                    print(f"🐛 STT DEBUG: Total bug messages so far: {len(agent._whispey_bug_details)}")
                                
                                agent._whispey_bug_details.append({
                                    'type': 'bug_details',
                                    'text': transcript,
                                    'timestamp': __import__('time').time()
                                })
                                
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: Sending collection prompt: '{self.collection_prompt}'")
                                
                                await session.say(self.collection_prompt, add_to_chat_ctx=False)
                                
                                # Don't yield this event - it's intercepted
                                continue
                                
                            else:
                                # Normal processing - yield the event
                                if self.bug_report_debug:
                                    print(f"🐛 STT DEBUG: Normal processing: '{transcript}'")
                                
                                yield event
                                
                    except Exception as e:
                        if self.bug_report_debug:
                            print(f"🐛 STT DEBUG: ❌ STT wrapper error: {e}")
                        
                        # Ultimate fallback: try to use original STT without modification
                        try:
                            if agent._whispey_original_stt_node:
                                fallback_result = agent._whispey_original_stt_node(audio_stream, model_settings)
                            else:
                                from livekit.agents import Agent
                                fallback_result = Agent.default_stt_node(agent, audio_stream, model_settings)
                            
                            # Apply same await strategy to fallback
                            try:
                                fallback_events = await fallback_result
                            except TypeError:
                                fallback_events = fallback_result
                            
                            async for event in fallback_events:
                                yield event
                                
                        except Exception as fallback_error:
                            if self.bug_report_debug:
                                print(f"🐛 STT DEBUG: ❌ Fallback STT also failed: {fallback_error}")
                            raise fallback_error
                
                # Replace agent's STT node
                agent.stt_node = bug_aware_stt_node
            
            return await original_start(*args, **kwargs)
        
        session.start = wrapped_start
    
    async def _capture_and_store_last_message(self, session_id):
        """Capture and store the last agent message immediately when bug is reported"""
        try:
            try:
                from .whispey import _session_data_store
            except ImportError:
                from whispey import _session_data_store
                
            if session_id in _session_data_store:
                session_info = _session_data_store[session_id]
                session_data = session_info.get('session_data', {})
                
                # Get the last agent message from transcript collector
                if 'transcript_collector' in session_data:
                    collector = session_data['transcript_collector']
                    if collector.turns and len(collector.turns) > 0:
                        last_turn = collector.turns[-1]
                        
                        # Flag the turn as a bug report
                        last_turn.bug_report = True
                        
                        # Store the agent response for repetition
                        if last_turn.agent_response:
                            # Store in multiple locations for reliability
                            session_data['last_buggy_message'] = last_turn.agent_response
                            session_data['captured_message_for_repeat'] = last_turn.agent_response
                            session_data['capture_timestamp'] = __import__('time').time()
                            
                            # Also store in bug flagged turns for export
                            if 'bug_flagged_turns' not in session_data:
                                session_data['bug_flagged_turns'] = []
                            session_data['bug_flagged_turns'].append({
                                'turn_id': last_turn.turn_id,
                                'agent_message': last_turn.agent_response,
                                'flagged_at': __import__('time').time()
                            })
                            
                            return last_turn.agent_response
                
                return None
                
        except Exception as e:
            logger.error(f"❌ CAPTURE ERROR: {e}")
            return None
    
    async def _repeat_stored_message(self, session_id, session):
        """Repeat the stored problematic message with multiple fallback layers"""
        try:
            try:
                from .whispey import _session_data_store
            except ImportError:
                from whispey import _session_data_store
            
            if session_id not in _session_data_store:
                await session.say(self.fallback_message, add_to_chat_ctx=False)
                return None
            
            session_info = _session_data_store[session_id]
            session_data = session_info.get('session_data', {})
            
            # Try multiple stored message sources in priority order
            message_sources = [
                ('captured_message_for_repeat', 'Recently captured'),
                ('last_buggy_message', 'Flagged buggy message'),
            ]
            
            for source_key, source_desc in message_sources:
                stored_message = session_data.get(source_key)
                if stored_message and stored_message.strip():
                    full_repeat = f"{self.continuation_prefix}{stored_message}"
                    await session.say(full_repeat, add_to_chat_ctx=False)
                    return stored_message
            
            # fallback: try to get from recent turns
            if 'transcript_collector' in session_data:
                collector = session_data['transcript_collector']
                # Look back through recent turns for the last agent response
                for turn in reversed(collector.turns[-3:]):  # Check last 3 turns
                    if turn.agent_response and turn.agent_response.strip():
                        full_repeat = f"{self.continuation_prefix}{turn.agent_response}"
                        await session.say(full_repeat, add_to_chat_ctx=False)
                        return turn.agent_response
            
            await session.say(self.fallback_message, add_to_chat_ctx=False)
            return None
            
        except Exception as e:
            await session.say(self.fallback_message, add_to_chat_ctx=False)
            return None
    
    async def _store_bug_report_details(self, session_id, bug_details):
        """Store bug report details in session data"""
        try:
            try:
                from .whispey import _session_data_store
            except ImportError:
                from whispey import _session_data_store
                
            if session_id in _session_data_store:
                session_info = _session_data_store[session_id]
                session_data = session_info.get('session_data', {})
                
                if 'bug_reports' not in session_data:
                    session_data['bug_reports'] = []
                
                session_data['bug_reports'].append({
                    'timestamp': __import__('time').time(),
                    'details': bug_details,
                    'total_messages': len(bug_details),
                    'stored_problematic_message': session_data.get('captured_message_for_repeat', 'N/A')
                })
                
        except Exception as e:
            logger.error(f"❌ STORE BUG DETAILS ERROR: {e}")


    
    async def export(self, session_id, recording_url=""):
        """Export session data to Whispey"""
        
        # Add telemetry spans to the export if available
        extra_data = {}
        if hasattr(self, 'spans_data') and self.spans_data:
            extra_data['telemetry_spans'] = self.spans_data
        
        return await send_session_to_whispey(
            session_id, 
            recording_url, 
            apikey=self.apikey, 
            api_url=self.host_url,
            environment=self.environment,
        )

__all__ = ['LivekitObserve', 'observe_session', 'send_session_to_whispey']