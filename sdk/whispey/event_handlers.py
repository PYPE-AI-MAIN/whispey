# sdk/whispey/event_handlers.py
import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.agents.metrics import STTMetrics, LLMMetrics, TTSMetrics, EOUMetrics
import re
import uuid

logger = logging.getLogger("whispey-sdk")

@dataclass
class ConversationTurn:
    """A complete conversation turn with user input, agent processing, and response"""
    turn_id: str
    user_transcript: str = ""
    agent_response: str = ""
    stt_metrics: Optional[Dict[str, Any]] = None
    llm_metrics: Optional[Dict[str, Any]] = None
    tts_metrics: Optional[Dict[str, Any]] = None
    eou_metrics: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)
    user_turn_complete: bool = False
    bug_report: bool = False
    agent_turn_complete: bool = False
    
    # Trace fields
    trace_id: Optional[str] = None
    otel_spans: List[Dict[str, Any]] = field(default_factory=list)
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    trace_duration_ms: Optional[int] = None
    trace_cost_usd: Optional[float] = None
    
    # Enhanced data fields - extracted from existing sources
    enhanced_stt_data: Optional[Dict[str, Any]] = None
    enhanced_llm_data: Optional[Dict[str, Any]] = None  
    enhanced_tts_data: Optional[Dict[str, Any]] = None
    state_events: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary - backwards compatible"""
        base_dict = {
            'turn_id': self.turn_id,
            'user_transcript': self.user_transcript,
            'agent_response': self.agent_response,
            'stt_metrics': self.stt_metrics,
            'llm_metrics': self.llm_metrics,
            'tts_metrics': self.tts_metrics,
            'eou_metrics': self.eou_metrics,
            'timestamp': self.timestamp,
            'bug_report': self.bug_report,
            'trace_id': self.trace_id,
            'otel_spans': self.otel_spans,
            'tool_calls': self.tool_calls,
            'trace_duration_ms': self.trace_duration_ms,
            'trace_cost_usd': self.trace_cost_usd
        }
        
        # Add enhanced fields only if they have data
        enhanced_fields = {
            'enhanced_stt_data': self.enhanced_stt_data,
            'enhanced_llm_data': self.enhanced_llm_data,
            'enhanced_tts_data': self.enhanced_tts_data,
            'state_events': self.state_events
        }
        
        for key, value in enhanced_fields.items():
            if value is not None and value != [] and value != {}:
                base_dict[key] = value
        
        return base_dict

class CorrectedTranscriptCollector:
    """Enhanced collector - extracts data from metrics and conversation events"""
    
    def __init__(self, bug_detector=None):
        # Core fields - DO NOT CHANGE
        self.turns: List[ConversationTurn] = []
        self.session_start_time = time.time()
        self.current_turn: Optional[ConversationTurn] = None
        self.turn_counter = 0
        self.pending_metrics = {
            'stt': None,
            'llm': None,
            'tts': None,
            'eou': None
        }
        self.bug_detector = bug_detector
        
        # Enhanced state tracking
        self.session_events: List[Dict[str, Any]] = []
        self.current_user_state = "listening"
        self.current_agent_state = "initializing"

    def _create_trace_span(self, metrics_obj, operation_name: str) -> Dict[str, Any]:
        """Create a trace span from metrics object - UNCHANGED"""
        span_data = {
            "span_id": f"span_{operation_name}_{uuid.uuid4().hex[:8]}",
            "operation": operation_name,
            "start_time": getattr(metrics_obj, 'timestamp', time.time()),
            "duration_ms": int(getattr(metrics_obj, 'duration', 0) * 1000),
            "status": "success",
            "metadata": {}
        }
        
        if operation_name == "stt":
            span_data["metadata"] = {
                "audio_duration": getattr(metrics_obj, 'audio_duration', 0),
                "request_id": getattr(metrics_obj, 'request_id', None)
            }
        elif operation_name == "llm":
            span_data["metadata"] = {
                "prompt_tokens": getattr(metrics_obj, 'prompt_tokens', 0),
                "completion_tokens": getattr(metrics_obj, 'completion_tokens', 0),
                "ttft": getattr(metrics_obj, 'ttft', 0),
                "tokens_per_second": getattr(metrics_obj, 'tokens_per_second', 0),
                "request_id": getattr(metrics_obj, 'request_id', None)
            }
        elif operation_name == "tts":
            span_data["metadata"] = {
                "characters_count": getattr(metrics_obj, 'characters_count', 0),
                "audio_duration": getattr(metrics_obj, 'audio_duration', 0),
                "ttfb": getattr(metrics_obj, 'ttfb', 0),
                "request_id": getattr(metrics_obj, 'request_id', None)
            }
        elif operation_name == "eou":
            span_data["metadata"] = {
                "end_of_utterance_delay": getattr(metrics_obj, 'end_of_utterance_delay', 0),
                "transcription_delay": getattr(metrics_obj, 'transcription_delay', 0)
            }
        
        return span_data

    def _ensure_trace_id(self, turn: ConversationTurn):
        """Ensure the turn has a trace ID - UNCHANGED"""
        if not turn.trace_id:
            turn.trace_id = f"trace_{uuid.uuid4().hex[:16]}"

    def _is_bug_report(self, text: str) -> bool:
        """Check if user input is a bug report using SDK detector if available"""
        if self.bug_detector:
            return self.bug_detector._is_bug_report(text)
        return False
            
    def on_conversation_item_added(self, event):
        """Called when conversation item is added - enhanced data extraction from conversation"""
        logger.info(f"🔍 CONVERSATION: {event.item.role} - {event.item.text_content[:50]}...")
        
        if event.item.role == "user":
            if self._is_bug_report(event.item.text_content):
                logger.info(f"🐛 Bug report detected: {event.item.text_content}")
                if self.turns:
                    self.turns[-1].bug_report = True
                    logger.info(f"🐛 Flagged turn {self.turns[-1].turn_id} as bug report")
                return
            
            if not self.current_turn:
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
                self._ensure_trace_id(self.current_turn)

            self.current_turn.user_transcript = event.item.text_content
            self.current_turn.user_turn_complete = True
            
            # Apply pending metrics
            if self.pending_metrics['stt']:
                self.current_turn.stt_metrics = self.pending_metrics['stt']
                self.pending_metrics['stt'] = None
                logger.info(f"📊 Applied pending STT metrics to turn {self.current_turn.turn_id}")
            
            if self.pending_metrics['eou']:
                self.current_turn.eou_metrics = self.pending_metrics['eou']
                self.pending_metrics['eou'] = None
                logger.info(f"⏱️ Applied pending EOU metrics to turn {self.current_turn.turn_id}")
            
            # Extract enhanced STT data from what we can infer
            self._extract_enhanced_stt_from_conversation(event)
                
            logger.info(f"👤 User input for turn {self.current_turn.turn_id}: {event.item.text_content[:50]}...")
            
        elif event.item.role == "assistant":
            if not self.current_turn:
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
                self._ensure_trace_id(self.current_turn)
            
            self.current_turn.agent_response = event.item.text_content
            self.current_turn.agent_turn_complete = True
            
            # Apply pending metrics
            if self.pending_metrics['llm']:
                self.current_turn.llm_metrics = self.pending_metrics['llm']
                self.pending_metrics['llm'] = None
                logger.info(f"🧠 Applied pending LLM metrics to turn {self.current_turn.turn_id}")
            
            if self.pending_metrics['tts']:
                self.current_turn.tts_metrics = self.pending_metrics['tts']
                self.pending_metrics['tts'] = None
                logger.info(f"🗣️ Applied pending TTS metrics to turn {self.current_turn.turn_id}")
            
            # Extract enhanced data from conversation and session context
            self._extract_enhanced_llm_from_conversation(event)
            self._extract_enhanced_tts_from_conversation(event)
            
            logger.info(f"🤖 Agent response for turn {self.current_turn.turn_id}: {event.item.text_content[:50]}...")
            
            # Turn is complete
            self.turns.append(self.current_turn)
            logger.info(f"✅ Completed turn {self.current_turn.turn_id}")
            self.current_turn = None
    
    def on_metrics_collected(self, metrics_event):
        """Called when metrics are collected - extract enhanced data from metrics"""
        metrics_obj = metrics_event.metrics
        logger.info(f"📈 METRICS: {type(metrics_obj).__name__}")
        
        if isinstance(metrics_obj, STTMetrics):
            stt_data = {
                'audio_duration': metrics_obj.audio_duration,
                'duration': metrics_obj.duration,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.stt_metrics:
                self.current_turn.stt_metrics = stt_data
                logger.info(f"📊 Applied STT metrics to current turn {self.current_turn.turn_id}")
                self._ensure_trace_id(self.current_turn)
                span = self._create_trace_span(metrics_obj, "stt")
                self.current_turn.otel_spans.append(span)
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].stt_metrics:
                self.turns[-1].stt_metrics = stt_data
                logger.info(f"📊 Applied STT metrics to last turn {self.turns[-1].turn_id}")
                self._ensure_trace_id(self.turns[-1])
                span = self._create_trace_span(metrics_obj, "stt")
                self.turns[-1].otel_spans.append(span)
            else:
                self.pending_metrics['stt'] = stt_data
                logger.info("📊 Stored STT metrics as pending")
            
            # Extract enhanced STT data from metrics
            self._extract_enhanced_stt_from_metrics(metrics_obj)
                
        elif isinstance(metrics_obj, LLMMetrics):
            llm_data = {
                'prompt_tokens': metrics_obj.prompt_tokens,
                'completion_tokens': metrics_obj.completion_tokens,
                'ttft': metrics_obj.ttft,
                'tokens_per_second': metrics_obj.tokens_per_second,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            if self.current_turn and not self.current_turn.llm_metrics:
                self.current_turn.llm_metrics = llm_data
                logger.info(f"🧠 Applied LLM metrics to current turn {self.current_turn.turn_id}")
                self._ensure_trace_id(self.current_turn)
                span = self._create_trace_span(metrics_obj, "llm")
                self.current_turn.otel_spans.append(span)
            else:
                self.pending_metrics['llm'] = llm_data
                logger.info("🧠 Stored LLM metrics as pending")
            
            # Extract enhanced LLM data from metrics
            self._extract_enhanced_llm_from_metrics(metrics_obj)
                
        elif isinstance(metrics_obj, TTSMetrics):
            tts_data = {
                'characters_count': metrics_obj.characters_count,
                'audio_duration': metrics_obj.audio_duration,
                'ttfb': metrics_obj.ttfb,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            if self.current_turn and self.current_turn.agent_response and not self.current_turn.tts_metrics:
                self.current_turn.tts_metrics = tts_data
                logger.info(f"🗣️ Applied TTS metrics to current turn {self.current_turn.turn_id}")
                self._ensure_trace_id(self.current_turn)
                span = self._create_trace_span(metrics_obj, "tts")
                self.current_turn.otel_spans.append(span)
            elif self.turns and self.turns[-1].agent_response and not self.turns[-1].tts_metrics:
                self.turns[-1].tts_metrics = tts_data
                logger.info(f"🗣️ Applied TTS metrics to last turn {self.turns[-1].turn_id}")
                self._ensure_trace_id(self.turns[-1])
                span = self._create_trace_span(metrics_obj, "tts")
                self.turns[-1].otel_spans.append(span)
            else:
                self.pending_metrics['tts'] = tts_data
                logger.info("🗣️ Stored TTS metrics as pending")
            
            # Extract enhanced TTS data from metrics
            self._extract_enhanced_tts_from_metrics(metrics_obj)
                
        elif isinstance(metrics_obj, EOUMetrics):
            eou_data = {
                'end_of_utterance_delay': metrics_obj.end_of_utterance_delay,
                'transcription_delay': metrics_obj.transcription_delay,
                'timestamp': metrics_obj.timestamp
            }
            
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.eou_metrics:
                self.current_turn.eou_metrics = eou_data
                logger.info(f"⏱️ Applied EOU metrics to current turn {self.current_turn.turn_id}")
                self._ensure_trace_id(self.current_turn)
                span = self._create_trace_span(metrics_obj, "eou")
                self.current_turn.otel_spans.append(span)
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].eou_metrics:
                self.turns[-1].eou_metrics = eou_data
                logger.info(f"⏱️ Applied EOU metrics to last turn {self.turns[-1].turn_id}")
                self._ensure_trace_id(self.turns[-1])
                span = self._create_trace_span(metrics_obj, "eou")
                self.turns[-1].otel_spans.append(span)
            else:
                self.pending_metrics['eou'] = eou_data
                logger.info("⏱️ Stored EOU metrics as pending")

    # Extract enhanced data from available sources, not pipeline interception
    def _extract_enhanced_stt_from_conversation(self, event):
        """Extract enhanced STT data from conversation context"""
        if not self.current_turn:
            return
            
        try:
            # Extract what we can infer from the conversation event
            enhanced_data = {
                'transcript_text': event.item.text_content,
                'transcript_length': len(event.item.text_content),
                'word_count': len(event.item.text_content.split()),
                'language_detected': None,  # Could be enhanced later
                'confidence_estimate': None,  # Could be enhanced later
                'timestamp': time.time()
            }
            
            self.current_turn.enhanced_stt_data = enhanced_data
            logger.info(f"📊 Extracted STT data from conversation: {enhanced_data['word_count']} words")
            
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced STT data: {e}")

    def _extract_enhanced_stt_from_metrics(self, metrics_obj):
        """Extract enhanced STT data from metrics object"""
        try:
            # Get model info from session data
            model_name = 'unknown'
            provider = 'unknown'
            
            if hasattr(self, '_session_data') and self._session_data:
                model_name = self._session_data.get('detected_stt_model', 'unknown')
                provider = self._session_data.get('detected_stt_provider', 'unknown')
            
            enhanced_data = {
                'model_name': model_name,
                'provider': provider,
                'audio_duration': getattr(metrics_obj, 'audio_duration', 0),
                'processing_time': getattr(metrics_obj, 'duration', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time())
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_stt_data:
                    self.current_turn.enhanced_stt_data = {}
                self.current_turn.enhanced_stt_data.update(enhanced_data)
                logger.info(f"📊 Enhanced STT metrics: {model_name} (provider: {provider})")
                
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced STT metrics: {e}")

    def _extract_enhanced_llm_from_conversation(self, event):
        """Extract enhanced LLM data from conversation context"""
        if not self.current_turn:
            return
            
        try:
            # Extract what we can from the conversation
            enhanced_data = {
                'response_text': event.item.text_content,
                'response_length': len(event.item.text_content),
                'word_count': len(event.item.text_content.split()),
                'has_code': '```' in event.item.text_content or 'def ' in event.item.text_content,
                'has_urls': 'http' in event.item.text_content,
                'timestamp': time.time()
            }
            
            self.current_turn.enhanced_llm_data = enhanced_data
            logger.info(f"🧠 Extracted LLM data from conversation: {enhanced_data['word_count']} words")
            
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced LLM data: {e}")

    def _extract_enhanced_llm_from_metrics(self, metrics_obj):
        """Extract enhanced LLM data from metrics object"""
        try:
            # Get model info from session data
            model_name = 'unknown'
            provider = 'unknown'
            
            if hasattr(self, '_session_data') and self._session_data:
                model_name = self._session_data.get('detected_llm_model', 'unknown')
                provider = self._session_data.get('detected_llm_provider', 'unknown')
            
            enhanced_data = {
                'model_name': model_name,
                'provider': provider,
                'prompt_tokens': getattr(metrics_obj, 'prompt_tokens', 0),
                'completion_tokens': getattr(metrics_obj, 'completion_tokens', 0),
                'total_tokens': getattr(metrics_obj, 'prompt_tokens', 0) + getattr(metrics_obj, 'completion_tokens', 0),
                'ttft': getattr(metrics_obj, 'ttft', 0),
                'tokens_per_second': getattr(metrics_obj, 'tokens_per_second', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time())
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_llm_data:
                    self.current_turn.enhanced_llm_data = {}
                self.current_turn.enhanced_llm_data.update(enhanced_data)
                logger.info(f"🧠 Enhanced LLM metrics: {model_name} (provider: {provider})")
                
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced LLM metrics: {e}")

    def _extract_enhanced_tts_from_conversation(self, event):
        """Extract enhanced TTS data from conversation context"""
        if not self.current_turn:
            return
            
        try:
            # Extract what we can from the agent response
            enhanced_data = {
                'text_to_synthesize': event.item.text_content,
                'character_count': len(event.item.text_content),
                'word_count': len(event.item.text_content.split()),
                'has_punctuation': any(p in event.item.text_content for p in '.,!?;:'),
                'estimated_speech_duration': len(event.item.text_content) / 15,  # Rough estimate: 15 chars per second
                'timestamp': time.time()
            }
            
            self.current_turn.enhanced_tts_data = enhanced_data
            logger.info(f"🗣️ Extracted TTS data from conversation: {enhanced_data['character_count']} chars")
            
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced TTS data: {e}")

    def _extract_enhanced_tts_from_metrics(self, metrics_obj):
        """Extract enhanced TTS data from metrics object"""
        try:
            # Get model info from session data
            voice_id = 'unknown'
            model_name = 'unknown'
            provider = 'unknown'
            
            if hasattr(self, '_session_data') and self._session_data:
                voice_id = self._session_data.get('detected_tts_voice', 'unknown')
                model_name = self._session_data.get('detected_tts_model', 'unknown')
                provider = self._session_data.get('detected_tts_provider', 'unknown')
            
            enhanced_data = {
                'voice_id': voice_id,
                'model_name': model_name,
                'provider': provider,
                'characters_count': getattr(metrics_obj, 'characters_count', 0),
                'audio_duration': getattr(metrics_obj, 'audio_duration', 0),
                'ttfb': getattr(metrics_obj, 'ttfb', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time())
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_tts_data:
                    self.current_turn.enhanced_tts_data = {}
                self.current_turn.enhanced_tts_data.update(enhanced_data)
                logger.info(f"🗣️ Enhanced TTS metrics: {voice_id} (provider: {provider})")
                
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced TTS metrics: {e}")

    # State tracking methods - these work well
    def capture_user_state_change(self, old_state: str, new_state: str):
        """Capture user state changes (speaking, silent, away)"""
        state_change = {
            'type': 'user_state',
            'old_state': old_state,
            'new_state': new_state,
            'timestamp': time.time()
        }
        
        if self.current_turn:
            self.current_turn.state_events.append(state_change)
        
        self.current_user_state = new_state
        logger.info(f"👤 User state: {old_state} → {new_state}")

    def capture_agent_state_change(self, old_state: str, new_state: str):
        """Capture agent state changes (thinking, speaking, listening)"""
        state_change = {
            'type': 'agent_state',
            'old_state': old_state,
            'new_state': new_state,
            'timestamp': time.time()
        }
        
        if self.current_turn:
            self.current_turn.state_events.append(state_change)
        
        self.current_agent_state = new_state
        logger.info(f"🤖 Agent state: {old_state} → {new_state}")

    def enable_enhanced_instrumentation(self, session, agent):
        """Enable state change tracking only"""
        try:
            logger.info("🔧 Enabling state tracking...")
            
            # state change handlers
            self._setup_state_change_handlers(session)
            
            logger.info("✅ state tracking enabled")
            
        except Exception as e:
            logger.error(f"⚠️ Could not enable state tracking: {e}")

    def _setup_state_change_handlers(self, session):
        """Setup state change event handlers - this works reliably"""
        try:
            @session.on("user_state_changed")
            def on_user_state_changed(event):
                old_state = getattr(event, 'old_state', 'unknown')
                new_state = getattr(event, 'new_state', 'unknown')
                self.capture_user_state_change(old_state, new_state)

            @session.on("agent_state_changed")
            def on_agent_state_changed(event):
                old_state = getattr(event, 'old_state', 'unknown')
                new_state = getattr(event, 'new_state', 'unknown')
                self.capture_agent_state_change(old_state, new_state)
                
            logger.info("🔧 State change handlers set up")
            
        except Exception as e:
            logger.error(f"⚠️ Could not set up state handlers: {e}")

    # Rest of the methods remain unchanged...
    def finalize_session(self):
        """Apply any remaining pending metrics"""
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
            
        if self.pending_metrics['tts'] and self.turns:
            for turn in reversed(self.turns):
                if turn.agent_response and not turn.tts_metrics:
                    turn.tts_metrics = self.pending_metrics['tts']
                    logger.info(f"🗣️ Applied final TTS metrics to turn {turn.turn_id}")
                    break
                    
        if self.pending_metrics['stt'] and self.turns:
            for turn in reversed(self.turns):
                if turn.user_transcript and not turn.stt_metrics:
                    turn.stt_metrics = self.pending_metrics['stt']
                    logger.info(f"📊 Applied final STT metrics to turn {turn.turn_id}")
                    break
        
        for turn in self.turns:
            self._finalize_trace_data(turn)

    def _fallback_cost_calculation(self, turn: ConversationTurn):
        """Fallback cost calculation if dynamic pricing fails"""
        total_cost = 0.0
        
        for span in turn.otel_spans:
            metadata = span.get('metadata', {})
            operation = span.get('operation', '')
            
            if operation == 'llm':
                prompt_tokens = metadata.get('prompt_tokens', 0)
                completion_tokens = metadata.get('completion_tokens', 0)
                cost = (prompt_tokens * 1.0 / 1000000) + (completion_tokens * 3.0 / 1000000)
                total_cost += cost
            elif operation == 'tts':
                chars = metadata.get('characters_count', 0)
                cost = chars * 20.0 / 1000000
                total_cost += cost
            elif operation == 'stt':
                duration = metadata.get('audio_duration', 0)
                cost = duration * 0.50 / 3600
                total_cost += cost
        
        turn.trace_cost_usd = round(total_cost, 6)

    def set_session_data_reference(self, session_data):
        """Set reference to session data for model detection"""
        self._session_data = session_data
        logger.info("🔧 Session data reference set for enhanced model detection")

    def _finalize_trace_data(self, turn: ConversationTurn):
        """Calculate trace duration and cost for a completed turn"""
        if not turn.otel_spans:
            return
        
        # Calculate total trace duration
        if turn.otel_spans:
            start_times = [span.get('start_time', 0) for span in turn.otel_spans]
            end_times = []
            
            for span in turn.otel_spans:
                start_time = span.get('start_time', 0)
                duration_ms = span.get('duration_ms', 0)
                end_time = start_time + (duration_ms / 1000)
                end_times.append(end_time)
            
            if start_times and end_times:
                total_duration = (max(end_times) - min(start_times)) * 1000
                turn.trace_duration_ms = int(total_duration)
        
        # Calculate cost using dynamic pricing
        try:
            from .pricing_calculator import calculate_dynamic_cost
            
            total_cost = 0.0
            
            for span in turn.otel_spans:
                metadata = span.get('metadata', {})
                operation = span.get('operation', '')
                
                # Enhanced metadata collection from turn data
                enhanced_metadata = metadata.copy()
                
                if operation == 'llm':
                    model_sources = [
                        metadata.get('model_name'),
                        turn.enhanced_llm_data.get('model_name') if turn.enhanced_llm_data else None,
                        self._session_data.get('detected_llm_model') if hasattr(self, '_session_data') and self._session_data else None,
                    ]
                    model_name = next((m for m in model_sources if m and m != 'unknown'), 'unknown')
                    enhanced_metadata['model_name'] = model_name
                    
                elif operation == 'tts':
                    voice_sources = [
                        metadata.get('voice_id'),
                        turn.enhanced_tts_data.get('voice_id') if turn.enhanced_tts_data else None,
                        self._session_data.get('detected_tts_voice') if hasattr(self, '_session_data') and self._session_data else None,
                    ]
                    voice_name = next((v for v in voice_sources if v and v != 'unknown'), 'unknown')
                    enhanced_metadata['model_name'] = voice_name
                    
                elif operation == 'stt':
                    model_sources = [
                        metadata.get('model_name'),
                        turn.enhanced_stt_data.get('model_name') if turn.enhanced_stt_data else None,
                        self._session_data.get('detected_stt_model') if hasattr(self, '_session_data') and self._session_data else None,
                    ]
                    model_name = next((m for m in model_sources if m and m != 'unknown'), 'unknown')
                    enhanced_metadata['model_name'] = model_name
                
                span['metadata'] = enhanced_metadata
                span_cost, cost_explanation = calculate_dynamic_cost(span)
                total_cost += span_cost
                
                logger.info(f"💰 {operation.upper()} cost: ${span_cost:.6f} ({cost_explanation})")
            
            turn.trace_cost_usd = round(total_cost, 6)
            logger.info(f"💰 Total trace cost: ${turn.trace_cost_usd} for turn {turn.turn_id}")
            
        except ImportError:
            logger.warning("💰 Dynamic pricing not available, using fallback calculation")
            self._fallback_cost_calculation(turn)
        except Exception as e:
            logger.error(f"💰 Error in dynamic cost calculation: {e}")
            self._fallback_cost_calculation(turn)

    def get_turns_array(self) -> List[Dict[str, Any]]:
        """Get the array of conversation turns with transcripts and metrics"""
        self.finalize_session()
        return [turn.to_dict() for turn in self.turns]
    
    def get_formatted_transcript(self) -> str:
        """Get formatted transcript with enhanced data"""
        self.finalize_session()
        lines = []
        lines.append("=" * 80)
        lines.append("CONVERSATION TRANSCRIPT (ENHANCED DATA FROM METRICS & CONVERSATION)")
        lines.append("=" * 80)
        
        for i, turn in enumerate(self.turns, 1):
            lines.append(f"\n🔄 TURN {i} (ID: {turn.turn_id})")
            lines.append("-" * 40)
            
            if turn.trace_id:
                lines.append(f"🔍 TRACE: {turn.trace_id} | {len(turn.otel_spans)} spans | {turn.trace_duration_ms}ms | ${turn.trace_cost_usd}")
            
            if turn.user_transcript:
                lines.append(f"👤 USER: {turn.user_transcript}")
                if turn.stt_metrics:
                    lines.append(f"   📊 STT: {turn.stt_metrics['audio_duration']:.2f}s audio ✅")
                
                if turn.enhanced_stt_data:
                    stt_data = turn.enhanced_stt_data
                    lines.append(f"   🎯 Enhanced STT: {stt_data.get('word_count', 0)} words, {stt_data.get('model_name', 'unknown')} model")
                    
                if turn.eou_metrics:
                    lines.append(f"   ⏱️ EOU: {turn.eou_metrics['end_of_utterance_delay']:.2f}s delay")
            else:
                lines.append("👤 USER: [No user input]")
            
            if turn.agent_response:
                lines.append(f"🤖 AGENT: {turn.agent_response}")
                if turn.llm_metrics:
                    lines.append(f"   🧠 LLM: {turn.llm_metrics['prompt_tokens']}+{turn.llm_metrics['completion_tokens']} tokens, TTFT: {turn.llm_metrics['ttft']:.2f}s ✅")
                
                if turn.enhanced_llm_data:
                    llm_data = turn.enhanced_llm_data
                    lines.append(f"   🤖 Enhanced LLM: {llm_data.get('word_count', 0)} words, {llm_data.get('model_name', 'unknown')} model")
                    
                if turn.tts_metrics:
                    lines.append(f"   🗣️ TTS: {turn.tts_metrics['characters_count']} chars, {turn.tts_metrics['audio_duration']:.2f}s ✅")
                
                if turn.enhanced_tts_data:
                    tts_data = turn.enhanced_tts_data
                    lines.append(f"   🎵 Enhanced TTS: {tts_data.get('character_count', 0)} chars, {tts_data.get('voice_id', 'unknown')} voice")
        
        return "\n".join(lines)

def setup_session_event_handlers(session, session_data, usage_collector, userdata, bug_detector):
    """Setup all session event handlers with transcript collector"""

    transcript_collector = CorrectedTranscriptCollector(bug_detector=bug_detector)
    transcript_collector.set_session_data_reference(session_data)
    session_data["transcript_collector"] = transcript_collector

    def setup_instrumentation_when_ready():
        """Setup instrumentation when agent becomes available"""
        try:
            agent_sources = [
                getattr(session, '_agent', None),
                getattr(session, 'agent', None), 
                getattr(session, '_current_agent', None)
            ]
            
            agent = next((a for a in agent_sources if a is not None), None)
            
            if agent:
                logger.info(f"🔧 Found agent: {type(agent).__name__}")
                transcript_collector.enable_enhanced_instrumentation(session, agent)
                extract_model_info_from_session(session, transcript_collector, session_data)
                return True
            else:
                logger.info("🔧 Agent not yet available - will try again when session starts")
                return False
                
        except Exception as e:
            logger.error(f"⚠️ instrumentation setup failed: {e}")
            return False

    if not setup_instrumentation_when_ready():
        original_start = getattr(session, 'start', None)
        if original_start:
            async def enhanced_start(*args, **kwargs):
                result = await original_start(*args, **kwargs)
                agent = kwargs.get('agent')
                if agent:
                    logger.info(f"🔧 Found agent during start: {type(agent).__name__}")
                    transcript_collector.enable_enhanced_instrumentation(session, agent)
                    extract_model_info_from_session(session, transcript_collector, session_data)
                return result
            session.start = enhanced_start

    # Rest of the event handlers remain the same...
    @session.on("agent_started_speaking")
    def on_agent_started_speaking(event):
        logger.debug(f"🎤 Agent started speaking: {event}")

    @session.on("agent_stopped_speaking") 
    def on_agent_stopped_speaking(event):
        logger.debug(f"🎤 Agent stopped speaking: {event}")

    @session.on("function_calls_collected")
    def on_function_calls_collected(event):
        logger.info(f"🔧 Function calls collected: {event}")
        if transcript_collector.current_turn:
            for func_call in event.function_calls:
                tool_call_data = {
                    'name': func_call.name,
                    'arguments': func_call.arguments,
                    'call_id': getattr(func_call, 'call_id', None),
                    'timestamp': time.time(),
                    'status': 'called'
                }
                
                if not transcript_collector.current_turn.tool_calls:
                    transcript_collector.current_turn.tool_calls = []
                transcript_collector.current_turn.tool_calls.append(tool_call_data)
                logger.info(f"🔧 Captured tool call via event: {func_call.name}")

    @session.on("function_tools_executed")
    def on_function_tools_executed(event):
        """LiveKit's official event for when function tools are executed"""
        logger.info(f"🔧 Function tools executed: {len(event.function_calls)} tools")
        
        if transcript_collector.current_turn:
            for func_call, func_output in event.zipped():
                parsed_arguments = func_call.arguments
                if isinstance(func_call.arguments, str):
                    try:
                        import json
                        parsed_arguments = json.loads(func_call.arguments)
                    except:
                        parsed_arguments = func_call.arguments
                
                output_details = {
                    'content': None,
                    'error': None,
                    'success': True,
                    'raw_output': str(func_output) if func_output else None
                }
                
                if hasattr(func_output, 'content'):
                    output_details['content'] = func_output.content
                elif hasattr(func_output, 'result'):
                    output_details['content'] = func_output.result
                elif func_output:
                    output_details['content'] = str(func_output)
                
                if hasattr(func_output, 'error') and func_output.error:
                    output_details['error'] = str(func_output.error)
                    output_details['success'] = False
                elif hasattr(func_output, 'is_error') and func_output.is_error:
                    output_details['error'] = output_details['content']
                    output_details['success'] = False
                    
                execution_start = getattr(func_call, 'start_time', None) or time.time()
                execution_end = getattr(func_call, 'end_time', None) or time.time()
                execution_duration = execution_end - execution_start
                
                tool_data = {
                    'name': func_call.name,
                    'arguments': parsed_arguments,
                    'raw_arguments': func_call.arguments,
                    'call_id': getattr(func_call, 'call_id', None) or getattr(func_call, 'id', None),
                    'timestamp': execution_start,
                    'execution_start': execution_start,
                    'execution_end': execution_end,
                    'execution_duration_ms': int(execution_duration * 1000),
                    'status': 'success' if output_details['success'] else 'error',
                    'result': output_details['content'],
                    'error': output_details['error'],
                    'result_length': len(output_details['content']) if output_details['content'] else 0,
                    'raw_output': output_details['raw_output'],
                    'function_signature': getattr(func_call, 'signature', None),
                    'function_description': getattr(func_call, 'description', None),
                    'tool_type': type(func_call).__name__,
                }
                
                if not transcript_collector.current_turn.tool_calls:
                    transcript_collector.current_turn.tool_calls = []
                transcript_collector.current_turn.tool_calls.append(tool_data)
                
                tool_span = {
                    "span_id": f"span_tool_{func_call.name}_{uuid.uuid4().hex[:8]}",
                    "operation": f"tool_call",
                    "start_time": execution_start,
                    "duration_ms": int(execution_duration * 1000),
                    "status": "success" if output_details['success'] else "error",
                    "metadata": {
                        "function_name": func_call.name,
                        "arguments": parsed_arguments,
                        "raw_arguments": func_call.arguments,
                        "result_length": tool_data['result_length'],
                        "call_id": tool_data['call_id'],
                        "execution_duration_s": execution_duration,
                        "has_error": not output_details['success'],
                        "error_message": output_details['error'],
                        "tool_type": tool_data['tool_type'],
                        "latency_category": "fast" if execution_duration < 1.0 else "medium" if execution_duration < 3.0 else "slow",
                        "result_size_category": "small" if tool_data['result_length'] < 100 else "medium" if tool_data['result_length'] < 500 else "large"
                    }
                }
                
                transcript_collector._ensure_trace_id(transcript_collector.current_turn)
                transcript_collector.current_turn.otel_spans.append(tool_span)
                
                status_emoji = "✅" if output_details['success'] else "❌"
                logger.info(f"🔧 {status_emoji} Tool executed: {func_call.name}")
                logger.info(f"   📥 Arguments: {parsed_arguments}")
                logger.info(f"   📤 Result: {tool_data['result_length']} chars")
                logger.info(f"   ⏱️ Duration: {execution_duration*1000:.1f}ms")
                if output_details['error']:
                    logger.error(f"   💥 Error: {output_details['error']}")
    
    @session.on("metrics_collected")
    def on_metrics_collected(ev: MetricsCollectedEvent):
        usage_collector.collect(ev.metrics)
        metrics.log_metrics(ev.metrics)
        transcript_collector.on_metrics_collected(ev)
        
        if isinstance(ev.metrics, metrics.LLMMetrics):
            logger.info(f"🧠 LLM: {ev.metrics.prompt_tokens} prompt + {ev.metrics.completion_tokens} completion tokens, TTFT: {ev.metrics.ttft:.2f}s")
        elif isinstance(ev.metrics, metrics.TTSMetrics):
            logger.info(f"🗣️ TTS: {ev.metrics.characters_count} chars, Duration: {ev.metrics.audio_duration:.2f}s, TTFB: {ev.metrics.ttfb:.2f}s")
        elif isinstance(ev.metrics, metrics.STTMetrics):
            logger.info(f"🎙️ STT: {ev.metrics.audio_duration:.2f}s audio processed in {ev.metrics.duration:.2f}s")

    @session.on("conversation_item_added")
    def on_conversation_item_added(event):
        """Track conversation flow for metrics"""
        transcript_collector.on_conversation_item_added(event)
        
        if event.item.role == "user":
            logger.info(f"👤 User: {event.item.text_content[:50]}...")
            session_data["user_messages"].append({
                "timestamp": time.time(),
                "content": event.item.text_content,
                "type": "user_input"
            })
        elif event.item.role == "assistant":
            logger.info(f"🤖 Agent: {event.item.text_content[:50]}...")
            session_data["agent_messages"].append({
                "timestamp": time.time(), 
                "content": event.item.text_content,
                "type": "agent_response"
            })
            
            if any(phrase in event.item.text_content for phrase in [
                "[Handing off to", "[Handing back to", "handoff_to_", "transfer_to_"
            ]):
                session_data["handoffs"] += 1
                logger.info(f"🔄 Handoff detected - Total: {session_data['handoffs']}")

    @session.on("close")
    def on_session_close(event):
        """Mark session as completed or failed"""
        session_data["call_success"] = event.error is None
        if event.error:
            session_data["errors"].append(f"Session Error: {event.error}")
        
        if userdata and userdata.current_lesson_step == "lesson_completed":
            session_data["lesson_completed"] = True
            
        logger.info(f"📊 Session ended - Success: {session_data['call_success']}, Lesson completed: {session_data['lesson_completed']}")

def extract_model_info_from_session(session, transcript_collector, session_data):
    """Extract model information from session components and store in session_data"""
    try:
        logger.info("🔍 Extracting model info from session...")
        
        model_info = {
            'stt_models': [],
            'llm_models': [],
            'tts_models': [],
            'pipeline_info': {}
        }
        
        if hasattr(session, 'llm') and session.llm:
            llm_model = getattr(session.llm, 'model', 'unknown')
            provider = 'unknown'
            
            if hasattr(session.llm, '__module__'):
                module_path = session.llm.__module__
                if 'openai' in module_path.lower():
                    provider = 'openai'
                elif 'anthropic' in module_path.lower():
                    provider = 'anthropic'
                elif 'elevenlabs' in module_path.lower():
                    provider = 'elevenlabs'
                elif 'sarvam' in module_path.lower():
                    provider = 'sarvam'
            
            if provider == 'unknown':
                provider = detect_provider_from_model_name(llm_model)
            
            llm_info = {
                'class': type(session.llm).__name__,
                'provider': provider,
                'model': llm_model,
                'module': getattr(session.llm, '__module__', 'unknown')
            }
            model_info['llm_models'].append(llm_info)
            logger.info(f"🧠 LLM: {llm_info['class']} (model: {llm_info['model']}, provider: {llm_info['provider']})")
        
        if hasattr(session, 'stt') and session.stt:
            stt_model = getattr(session.stt, 'model', 'unknown')
            provider = 'unknown'
            if hasattr(session.stt, '__module__'):
                module_path = session.stt.__module__
                if 'sarvam' in module_path.lower():
                    provider = 'sarvam'
                elif 'openai' in module_path.lower():
                    provider = 'openai'
                elif 'deepgram' in module_path.lower():
                    provider = 'deepgram'
            
            if provider == 'unknown':
                provider = detect_provider_from_model_name(stt_model)
                
            stt_info = {
                'class': type(session.stt).__name__,
                'provider': provider,
                'model': stt_model,
                'module': getattr(session.stt, '__module__', 'unknown')
            }
            model_info['stt_models'].append(stt_info)
            logger.info(f"📊 STT: {stt_info['class']} (model: {stt_info['model']}, provider: {stt_info['provider']})")
        
        if hasattr(session, 'tts') and session.tts:
            tts_model = getattr(session.tts, 'model', 'unknown')
            tts_voice = getattr(session.tts, 'voice_id', 'unknown')
            provider = 'unknown'
            if hasattr(session.tts, '__module__'):
                module_path = session.tts.__module__
                if 'elevenlabs' in module_path.lower():
                    provider = 'elevenlabs'
                elif 'openai' in module_path.lower():
                    provider = 'openai'
                elif 'cartesia' in module_path.lower():
                    provider = 'cartesia'
            
            if provider == 'unknown':
                provider = detect_provider_from_model_name(tts_model)
                
            tts_info = {
                'class': type(session.tts).__name__,
                'provider': provider,
                'model': tts_model,
                'voice': tts_voice,
                'module': getattr(session.tts, '__module__', 'unknown')
            }
            model_info['tts_models'].append(tts_info)
            logger.info(f"🗣️ TTS: {tts_info['class']} (model: {tts_info['model']}, voice: {tts_info['voice']}, provider: {tts_info['provider']})")
        
        session_data['extracted_model_info'] = model_info
        
        if model_info['llm_models']:
            session_data['detected_llm_model'] = model_info['llm_models'][0]['model']
            session_data['detected_llm_provider'] = model_info['llm_models'][0]['provider']
        if model_info['tts_models']:
            session_data['detected_tts_model'] = model_info['tts_models'][0]['model']
            session_data['detected_tts_voice'] = model_info['tts_models'][0]['voice']
            session_data['detected_tts_provider'] = model_info['tts_models'][0]['provider']
        if model_info['stt_models']:
            session_data['detected_stt_model'] = model_info['stt_models'][0]['model']
            session_data['detected_stt_provider'] = model_info['stt_models'][0]['provider']
        
        logger.info(f"✅ Model info extraction complete")
        
    except Exception as e:
        logger.error(f"⚠️ Error extracting model info: {e}")
        session_data['extracted_model_info'] = {
            'error': str(e),
            'stt_models': [], 'llm_models': [], 'tts_models': [], 'pipeline_info': {}
        }

def detect_provider_from_model_name(model_name: str) -> str:
    """Detect provider from model name"""
    if not model_name:
        return 'unknown'
    
    model_lower = model_name.lower()
    
    if any(x in model_lower for x in ['gpt', 'openai', 'whisper', 'tts-1']):
        return 'openai'
    elif any(x in model_lower for x in ['claude', 'anthropic']):
        return 'anthropic'  
    elif any(x in model_lower for x in ['gemini', 'palm', 'bard']):
        return 'google'
    elif any(x in model_lower for x in ['saarika', 'sarvam']):
        return 'sarvam'
    elif any(x in model_lower for x in ['eleven', 'elevenlabs']):
        return 'elevenlabs'
    elif any(x in model_lower for x in ['cartesia', 'sonic']):
        return 'cartesia'
    elif any(x in model_lower for x in ['deepgram', 'nova']):
        return 'deepgram'
    else:
        return 'unknown'

def get_session_transcript(session_data) -> Dict[str, Any]:
    """Get transcript data from session"""
    if "transcript_collector" in session_data:
        collector = session_data["transcript_collector"]
        return {
            "turns_array": collector.get_turns_array(),
            "formatted_transcript": collector.get_formatted_transcript(),
            "total_turns": len(collector.turns)
        }
    return {"turns_array": [], "formatted_transcript": "", "total_turns": 0}

def safe_extract_transcript_data(session_data):
    """Safely extract transcript data and remove non-serializable objects"""
    transcript_data = get_session_transcript(session_data)
    
    if "transcript_collector" in session_data:
        del session_data["transcript_collector"]
        logger.info("🔧 Removed transcript_collector from session_data")
    
    session_data["transcript_with_metrics"] = transcript_data["turns_array"]
    session_data["formatted_transcript"] = transcript_data["formatted_transcript"]
    session_data["total_conversation_turns"] = transcript_data["total_turns"]
    
    logger.info(f"✅ Extracted {len(transcript_data['turns_array'])} conversation turns")
    
    return session_data