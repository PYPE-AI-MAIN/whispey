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
        bug_reports: Union[bool, Dict[str, Any]] = False,
        enable_otel: bool = False,  # ADD THIS LINE
    ):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
        self.enable_otel = enable_otel        # ADD THIS LINE
        self.spans_data = []  
        
        # Handle bug_reports parameter
        if bug_reports is not False:
            self.enable_bug_reports = True
            if isinstance(bug_reports, dict):
                config = bug_reports
            else:
                config = {}
        else:
            self.enable_bug_reports = False
            config = {}
        
        # Simple parameter handling - only support bug_start_command and bug_end_command
        start_patterns = config.get('bug_start_command', ['fault report start']) # Default to 'fault report start'
        end_patterns = config.get('bug_end_command', ['fault report over']) # Default to 'fault report over'
        
        # Convert to regex patterns
        self.bug_start_patterns = self._convert_to_regex(start_patterns)
        self.bug_end_patterns = self._convert_to_regex(end_patterns)
        
        # Response messages
        self.bug_report_response = config.get(
            'response', 
            "Thanks for reporting that. Please tell me the issue?"
        )
        self.continuation_prefix = config.get(
            'continuation_prefix',
            "So, as I was saying, "
        )
        self.fallback_message = config.get(
            'fallback_message',
            "So, as I was saying,"
        )
        self.collection_prompt = config.get(
            'collection_prompt',
            "Anything else?"
        )

    def _setup_telemetry(self, session_id):
        if not self.enable_otel:
            return None
        
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        
        tracer_provider = TracerProvider()
        
        # Custom span processor to capture spans
        class WhispeySpanProcessor(BatchSpanProcessor):
            def __init__(self, whispey_instance):
                self.whispey = whispey_instance
                super().__init__(OTLPSpanExporter(endpoint="http://localhost:3000/dev/send-call-logs"))
            
            def on_end(self, span):
                # Store simplified version for export
                self.whispey.spans_data.append({
                    'name': span.name,
                    'start_time': span.start_time,
                    'end_time': span.end_time,
                    'attributes': dict(span.attributes) if span.attributes else {},
                    'status': span.status.status_code.name if span.status else None,
                })
                
                super().on_end(span)
        
        tracer_provider.add_span_processor(WhispeySpanProcessor(self))

        # Set the tracer provider using LiveKit's method
        from livekit.agents.telemetry import set_tracer_provider
        set_tracer_provider(tracer_provider, metadata={'session_id': session_id})
    
    
    def start_session(self, session, **kwargs):
        """Start session with prompt capture AND bug report functionality"""
        bug_detector = self if self.enable_bug_reports else None
        session_id = observe_session(
            session, 
            self.agent_id, 
            self.host_url, 
            bug_detector=bug_detector,
            enable_otel=self.enable_otel,
            telemetry_instance=self,
            **kwargs
        )
        
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
            
            # Debug: Log what we found in chat_ctx
            chat_ctx_attrs = [attr for attr in dir(chat_ctx) if not attr.startswith('_')]
            logger.debug(f"Chat context attributes: {chat_ctx_attrs}")
            
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
            
            logger.info(f"Captured prompt data: {len(conversation_history)} messages, {len(available_tools)} tools")
            
            # Debug logging
            if conversation_history:
                logger.debug(f"Sample conversation history: {conversation_history[0] if conversation_history else 'None'}")
            if available_tools:
                logger.debug(f"Sample tool: {available_tools[0] if available_tools else 'None'}")
            
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
                    """STT node with bug report detection - simplified version"""
                    
                    # Get original STT events
                    if agent._whispey_original_stt_node:
                        stt_events = agent._whispey_original_stt_node(audio_stream, model_settings)
                    else:
                        from livekit.agents import Agent
                        stt_events = Agent.default_stt_node(agent, audio_stream, model_settings)
                    
                    async for event in stt_events:
                        # Extract transcript from various event types
                        transcript = None
                        if hasattr(event, 'alternatives') and event.alternatives:
                            transcript = event.alternatives[0].text
                        elif hasattr(event, 'text'):
                            transcript = event.text
                        elif isinstance(event, str):
                            transcript = event
                        
                        if not transcript or not transcript.strip():
                            yield event
                            continue
                        
                        transcript = transcript.strip()
                        
                        # CASE 1: User says "bug over" - exit bug mode and repeat response
                        if agent._whispey_bug_report_mode and self._is_done_reporting(transcript):
                            agent._whispey_bug_report_mode = False
                            
                            # Store all collected bug details
                            await self._store_bug_report_details(session_id, agent._whispey_bug_details)
                            agent._whispey_bug_details = []
                            
                            # ✅ REPEAT the stored problematic message
                            await self._repeat_stored_message(session_id, session)
                            continue
                        
                        # CASE 2: User starts bug report with "feedback"
                        elif not agent._whispey_bug_report_mode and self._is_bug_report(transcript):
                            # Immediately capture and store the last agent message
                            captured_message = await self._capture_and_store_last_message(session_id)
                            if captured_message:
                                logger.warning("⚠️ NO MESSAGE TO CAPTURE")
                            
                            # Enter bug collection mode
                            agent._whispey_bug_report_mode = True
                            agent._whispey_bug_details = [{
                                'type': 'initial_report',
                                'text': transcript,
                                'timestamp': __import__('time').time()
                            }]
                            
                            # Ask for details
                            await session.say(self.bug_report_response, add_to_chat_ctx=False)
                            continue
                        
                        # CASE 3: User is providing bug details
                        elif agent._whispey_bug_report_mode:
                            
                            agent._whispey_bug_details.append({
                                'type': 'bug_details',
                                'text': transcript,
                                'timestamp': __import__('time').time()
                            })
                            
                            # Acknowledge and ask for more
                            await session.say(self.collection_prompt, add_to_chat_ctx=False)
                            continue
                        
                        # CASE 4: Normal conversation
                        else:
                            yield event
                
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


    
    async def export(self, session_id, recording_url="", save_telemetry_json=False):
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
        )

__all__ = ['LivekitObserve', 'observe_session', 'send_session_to_whispey']