"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "2.1.3"
__author__ = "Whispey AI Voice Analytics"

import re
import logging
from typing import List, Optional, AsyncIterable, Any, Union, Dict
from .whispey import observe_session, send_session_to_whispey

logger = logging.getLogger("whispey-sdk")

# Professional wrapper class
class LivekitObserve:
    def __init__(
        self, 
        agent_id="whispey-agent",
        apikey=None, 
        host_url=None, 
        bug_reports: Union[bool, Dict[str, Any]] = False
    ):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
        
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
        
        # Simple parameter handling - only support feedback_start_command and feedback_end_command
        start_patterns = config.get('feedback_start_command', ['feedback start'])
        end_patterns = config.get('feedback_end_command', ['feedback over'])
        
        # Convert to regex patterns
        self.bug_report_patterns = self._convert_to_regex(start_patterns)
        self.done_reporting_patterns = self._convert_to_regex(end_patterns)
        
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
            "Got it. Any other details about this feedback?"
        )
    
    def _convert_to_regex(self, patterns: List[str]) -> List[str]:
        """Convert simple strings to regex patterns with Hindi support"""
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
                    # For English text, use word boundaries as before
                    escaped = re.escape(pattern)
                    regex_patterns.append(f'\\b{escaped}\\b')
        
        return regex_patterns
    
    def _is_bug_report(self, text: str) -> bool:
        """Check if user input is a bug report"""
        if not self.enable_bug_reports or not text:
            return False
        return any(re.search(pattern, text.lower()) for pattern in self.bug_report_patterns)
    
    def _is_done_reporting(self, text: str) -> bool:
        """Check if user is done reporting bugs"""
        if not text:
            return False
        return any(re.search(pattern, text.lower()) for pattern in self.done_reporting_patterns)
    
    def start_session(self, session, **kwargs):
        """Start session with optional bug report functionality"""
        bug_detector = self if self.enable_bug_reports else None
        session_id = observe_session(session, self.agent_id, self.host_url, bug_detector=bug_detector, **kwargs)
        
        if self.enable_bug_reports:
            self._setup_bug_report_handling(session, session_id)
        
        return session_id
    
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
                        logger.info(f"🎙️ TRANSCRIPT: '{transcript}' (bug_mode: {agent._whispey_bug_report_mode})")
                        
                        # CASE 1: User says "feedback over" - exit bug mode and repeat response
                        if agent._whispey_bug_report_mode and self._is_done_reporting(transcript):
                            logger.info(f"🏁 FEEDBACK COMPLETE: {transcript}")
                            agent._whispey_bug_report_mode = False
                            
                            # Store all collected bug details
                            await self._store_bug_report_details(session_id, agent._whispey_bug_details)
                            logger.info(f"📝 Stored {len(agent._whispey_bug_details)} bug report messages")
                            agent._whispey_bug_details = []
                            
                            # Get the stored problematic message and repeat it
                            repeated_message = await self._repeat_stored_message(session_id, session)
                            if repeated_message:
                                logger.info(f"✅ SUCCESSFULLY REPEATED: {repeated_message[:100]}...")
                            else:
                                logger.warning("⚠️ FAILED TO REPEAT MESSAGE")
                            
                            continue  # Don't process this as normal input
                        
                        # CASE 2: User starts bug report with "feedback"
                        elif not agent._whispey_bug_report_mode and self._is_bug_report(transcript):
                            logger.info(f"🐛 BUG REPORT DETECTED: {transcript}")
                            
                            # Immediately capture and store the last agent message
                            captured_message = await self._capture_and_store_last_message(session_id)
                            if captured_message:
                                logger.info(f"💾 CAPTURED PROBLEMATIC MESSAGE: {captured_message[:100]}...")
                            else:
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
                            logger.info(f"🤖 REQUESTED BUG DETAILS")
                            continue  # Don't process this as normal input
                        
                        # CASE 3: User is providing bug details
                        elif agent._whispey_bug_report_mode:
                            logger.info(f"📝 COLLECTING DETAILS: {transcript}")
                            
                            agent._whispey_bug_details.append({
                                'type': 'bug_details',
                                'text': transcript,
                                'timestamp': __import__('time').time()
                            })
                            
                            # Acknowledge and ask for more
                            await session.say(self.collection_prompt, add_to_chat_ctx=False)
                            logger.info(f"🤖 ACKNOWLEDGED BUG DETAILS")
                            continue  # Don't process this as normal input
                        
                        # CASE 4: Normal conversation
                        else:
                            logger.info(f"💬 NORMAL CONVERSATION: {transcript}")
                            yield event
                
                # Replace agent's STT node
                agent.stt_node = bug_aware_stt_node
                
                logger.info(f"✅ Simplified bug report handling enabled for session {session_id}")
            
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
                        logger.info(f"🐛 FLAGGED turn {last_turn.turn_id} as bug report")
                        
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
                
                logger.warning("⚠️ No recent turns or agent responses found to capture")
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
                logger.error(f"❌ Session {session_id} not found in data store")
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
                    logger.info(f"✅ REPEATED from {source_desc}: {stored_message[:100]}...")
                    return stored_message
            
            # Final fallback: try to get from recent turns
            if 'transcript_collector' in session_data:
                collector = session_data['transcript_collector']
                # Look back through recent turns for the last agent response
                for turn in reversed(collector.turns[-3:]):  # Check last 3 turns
                    if turn.agent_response and turn.agent_response.strip():
                        full_repeat = f"{self.continuation_prefix}{turn.agent_response}"
                        await session.say(full_repeat, add_to_chat_ctx=False)
                        logger.info(f"✅ REPEATED from recent turn {turn.turn_id}: {turn.agent_response[:100]}...")
                        return turn.agent_response
            
            # Absolute fallback
            logger.warning("⚠️ No stored message found, using default fallback")
            await session.say(self.fallback_message, add_to_chat_ctx=False)
            return None
            
        except Exception as e:
            logger.error(f"❌ REPEAT ERROR: {e}")
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
                
                logger.info(f"📝 STORED COMPLETE BUG REPORT: {len(bug_details)} detail messages")
        except Exception as e:
            logger.error(f"❌ STORE BUG DETAILS ERROR: {e}")
    
    async def export(self, session_id, recording_url="", save_telemetry_json=False):
        """Export session data to Whispey"""
        return await send_session_to_whispey(
            session_id, 
            recording_url, 
            apikey=self.apikey, 
            api_url=self.host_url
        )

__all__ = ['LivekitObserve', 'observe_session', 'send_session_to_whispey']