# sdk/whispey/event_handlers.py
import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.agents.metrics import STTMetrics, LLMMetrics, TTSMetrics, EOUMetrics
import re
import uuid
import json
import time 

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
    turn_configuration: Optional[Dict[str, Any]] = None
    
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
    prompt_data: Optional[Dict[str, Any]] = None
    
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
            'trace_cost_usd': self.trace_cost_usd,
            'turn_configuration': self.turn_configuration
        }
        
        # Add enhanced fields only if they have data
        enhanced_fields = {
            'enhanced_stt_data': self.enhanced_stt_data,
            'enhanced_llm_data': self.enhanced_llm_data,
            'enhanced_tts_data': self.enhanced_tts_data,
            'state_events': self.state_events,
            'prompt_data': self.prompt_data
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



    def _send_bug_response_immediately(self):
        """Send bug response immediately and interrupt current TTS"""
        if self.bug_detector and hasattr(self, '_session'):
            response = self.bug_detector.bug_report_response
            try:
                # Cancel any ongoing TTS
                if hasattr(self._session, 'cancel_say'):
                    self._session.cancel_say()
                elif hasattr(self._session, 'stop_audio'):
                    self._session.stop_audio()
                
                # Send the bug response without adding to chat context
                self._session.say(response, add_to_chat_ctx=False)
                logger.info(f"🐛 Sent bug response: {response}")
            except Exception as e:
                logger.error(f"❌ Failed to send bug response: {e}")
        else:
            logger.warning("Cannot send bug response - no bug_detector or session")



    def _send_collection_response_immediately(self):
        """Send collection response immediately"""
        if self.bug_detector and hasattr(self, '_session'):
            response = self.bug_detector.collection_prompt
            try:
                self._session.say(response, add_to_chat_ctx=False)
                logger.info(f"📝 Sent collection prompt: {response}")
            except Exception as e:
                logger.error(f"❌ Failed to send collection response: {e}")
        else:
            logger.warning("Cannot send collection response - no bug_detector or session")

    def _repeat_stored_message_immediately(self):
        """Repeat stored message immediately with continuation prefix"""
        if (self.bug_detector and hasattr(self, '_session') and 
            hasattr(self, '_stored_message') and self._stored_message):
            
            full_message = f"{self.bug_detector.continuation_prefix}{self._stored_message}"
            try:
                self._session.say(full_message, add_to_chat_ctx=False)
                logger.info(f"🔄 Repeated stored message: {full_message[:50]}...")
            except Exception as e:
                logger.error(f"❌ Failed to repeat stored message: {e}")
                # Fallback
                try:
                    self._session.say(self.bug_detector.fallback_message, add_to_chat_ctx=False)
                    logger.info(f"🔄 Sent fallback: {self.bug_detector.fallback_message}")
                except:
                    logger.error("❌ Complete failure to send any response")
        else:
            logger.warning("Cannot repeat stored message - missing components")



 
    def on_conversation_item_added(self, event):
        """Called when conversation item is added - enhanced data extraction from conversation"""
        logger.info(f"CONVERSATION: {event.item.role} - {event.item.text_content[:50]}...")

        # Initialize bug tracking state if not exists
        if not hasattr(self, '_bug_collection_mode'):
            self._bug_collection_mode = False
            self._bug_details = []
            self._stored_message = None
            self._intercepted_messages = {}
            self._bug_report_ended = {}

        if not self.current_turn:
            self.turn_counter += 1
            self.current_turn = ConversationTurn(
                turn_id=f"turn_{self.turn_counter}",
                timestamp=time.time()
            )
            self._ensure_trace_id(self.current_turn)
            
            # Inject complete configuration into the turn
            if hasattr(self, '_session_data') and self._session_data:
                config = self._session_data.get('complete_configuration')
                if config:
                    self.current_turn.turn_configuration = config
                    logger.info(f"SUCCESS: Injected configuration into turn {self.current_turn.turn_id}")

        if event.item.role == "user":
            original_text = event.item.text_content
            
            # Determine if this message should be intercepted
            should_intercept = False
            
            # CHECK 1: Initial bug report detection
            if self._is_bug_report(original_text) and not self._bug_collection_mode:
                logger.info(f"🐛 INITIAL BUG REPORT: {original_text}")
                
                # Store the last agent message for later repetition
                if self.turns and len(self.turns) > 0:
                    last_turn = self.turns[-1]
                    if last_turn.agent_response:
                        self._stored_message = last_turn.agent_response
                        last_turn.bug_report = True
                        logger.info(f"📝 Stored problematic message: {self._stored_message[:50]}...")
                
                # Enter bug collection mode
                self._bug_collection_mode = True
                self._bug_details = [{
                    'type': 'initial_report',
                    'text': original_text,
                    'timestamp': time.time()
                }]
                
                # Mark for interception
                should_intercept = True
                self._intercepted_messages[event.item.id] = original_text
                
                # Send immediate bug response
                self._send_bug_response_immediately()
                logger.info("🐛 Entered bug collection mode")
                
            # CHECK 2: Bug end detection
            elif self._bug_collection_mode and self._is_done_reporting(original_text):
                logger.info(f"🏁 BUG REPORT ENDED: {original_text}")
                
                # Store final bug details
                self._bug_details.append({
                    'type': 'bug_end',
                    'text': original_text,
                    'timestamp': time.time()
                })
                
                # Exit bug collection mode
                self._bug_collection_mode = False
                self._store_bug_details_in_session()
                
                # Mark for interception
                should_intercept = True
                self._bug_report_ended[event.item.id] = original_text
                
                # Repeat the stored message
                self._repeat_stored_message_immediately()
                logger.info("🏁 Exited bug collection mode")
                
            # CHECK 3: Continue collecting bug details
            elif self._bug_collection_mode:
                logger.info(f"📝 COLLECTING BUG DETAILS: {original_text}")
                
                # Store additional bug details
                self._bug_details.append({
                    'type': 'bug_details',
                    'text': original_text,
                    'timestamp': time.time()
                })
                
                # Mark for interception
                should_intercept = True
                self._intercepted_messages[event.item.id] = original_text
                
                # Send collection prompt
                self._send_collection_response_immediately()
                
            # NORMAL PROCESSING: Only if message wasn't intercepted
            if not should_intercept:
                self.current_turn.user_transcript = original_text
                self.current_turn.user_turn_complete = True
                
                # Apply pending metrics
                if self.pending_metrics['stt']:
                    self.current_turn.stt_metrics = self.pending_metrics['stt']
                    self.pending_metrics['stt'] = None
                
                if self.pending_metrics['eou']:
                    self.current_turn.eou_metrics = self.pending_metrics['eou']
                    self.pending_metrics['eou'] = None
                
                self._extract_enhanced_stt_from_conversation(event)
                logger.info(f"👤 Normal user input: {original_text[:50]}...")
            else:
                logger.info(f"🚫 Message intercepted for bug handling: {original_text[:50]}...")
                
        elif event.item.role == "assistant":
            # Skip assistant processing during bug collection
            if self._bug_collection_mode:
                logger.info("🤖 Skipping assistant response - in bug collection mode")
                return
            
            # Normal assistant processing
            if not self.current_turn:
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
                self._ensure_trace_id(self.current_turn)
                
                if hasattr(self, '_session_data') and self._session_data:
                    config = self._session_data.get('complete_configuration')
                    if config:
                        self.current_turn.turn_configuration = config
            
            self.current_turn.agent_response = event.item.text_content
            self.current_turn.agent_turn_complete = True
            
            # Associate prompt data
            if hasattr(self, '_session_data') and self._session_data:
                prompt_captures = self._session_data.get('prompt_captures', [])
                if prompt_captures:
                    self.current_turn.prompt_data = prompt_captures[-1]
            
            # Apply pending metrics
            if self.pending_metrics['llm']:
                self.current_turn.llm_metrics = self.pending_metrics['llm']
                self.pending_metrics['llm'] = None
            
            if self.pending_metrics['tts']:
                self.current_turn.tts_metrics = self.pending_metrics['tts']
                self.pending_metrics['tts'] = None
            
            self._extract_enhanced_llm_from_conversation(event)
            self._extract_enhanced_tts_from_conversation(event)
            
            # Complete the turn
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
        """Extract enhanced STT data from metrics object with complete configuration"""
        try:
            # Get from complete configuration instead of simple session data
            model_name = 'unknown'
            provider = 'unknown'
            full_stt_config = {}
            
            if hasattr(self, '_session_data') and self._session_data:
                complete_config = self._session_data.get('complete_configuration', {})
                stt_config = complete_config.get('stt_configuration', {})
                structured = stt_config.get('structured_config', {})
                
                model_name = structured.get('model', 'unknown')
                provider = stt_config.get('provider_detection', 'unknown')
                full_stt_config = structured
            
            enhanced_data = {
                'model_name': model_name,
                'provider': provider,
                'audio_duration': getattr(metrics_obj, 'audio_duration', 0),
                'processing_time': getattr(metrics_obj, 'duration', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time()),
                'full_stt_configuration': full_stt_config,
                'language': full_stt_config.get('language'),
                'detect_language': full_stt_config.get('detect_language'),
                'interim_results': full_stt_config.get('interim_results'),
                'punctuate': full_stt_config.get('punctuate'),
                'sample_rate': full_stt_config.get('sample_rate'),
                'channels': full_stt_config.get('channels')
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_stt_data:
                    self.current_turn.enhanced_stt_data = {}
                self.current_turn.enhanced_stt_data.update(enhanced_data)
                logger.info(f"Enhanced STT metrics: {model_name} (provider: {provider})")
                
        except Exception as e:
            logger.error(f"Error extracting enhanced STT metrics: {e}")



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
        """Extract enhanced LLM data from metrics object with complete configuration"""
        try:
            # Get from complete configuration instead of simple session data
            model_name = 'unknown'
            provider = 'unknown'
            full_llm_config = {}
            
            if hasattr(self, '_session_data') and self._session_data:
                complete_config = self._session_data.get('complete_configuration', {})
                llm_config = complete_config.get('llm_configuration', {})
                structured = llm_config.get('structured_config', {})
                
                model_name = structured.get('model', 'unknown')
                provider = llm_config.get('provider_detection', 'unknown')
                full_llm_config = structured
            
            enhanced_data = {
                'model_name': model_name,
                'provider': provider,
                'prompt_tokens': getattr(metrics_obj, 'prompt_tokens', 0),
                'completion_tokens': getattr(metrics_obj, 'completion_tokens', 0),
                'total_tokens': getattr(metrics_obj, 'prompt_tokens', 0) + getattr(metrics_obj, 'completion_tokens', 0),
                'ttft': getattr(metrics_obj, 'ttft', 0),
                'tokens_per_second': getattr(metrics_obj, 'tokens_per_second', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time()),
                'full_llm_configuration': full_llm_config,
                'temperature': full_llm_config.get('temperature'),
                'max_tokens': full_llm_config.get('max_tokens'),
                'top_p': full_llm_config.get('top_p'),
                'top_k': full_llm_config.get('top_k'),
                'presence_penalty': full_llm_config.get('presence_penalty'),
                'frequency_penalty': full_llm_config.get('frequency_penalty'),
                'stop': full_llm_config.get('stop'),
                'stream': full_llm_config.get('stream')
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_llm_data:
                    self.current_turn.enhanced_llm_data = {}
                self.current_turn.enhanced_llm_data.update(enhanced_data)
                logger.info(f"Enhanced LLM metrics: {model_name} (provider: {provider}, temp: {enhanced_data['temperature']})")
                
        except Exception as e:
            logger.error(f"Error extracting enhanced LLM metrics: {e}")



 
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
        """Extract enhanced TTS data from metrics object with complete configuration"""
        try:
            # Get from complete configuration instead of simple session data
            voice_id = 'unknown'
            model_name = 'unknown'
            provider = 'unknown'
            full_tts_config = {}
            
            if hasattr(self, '_session_data') and self._session_data:
                complete_config = self._session_data.get('complete_configuration', {})
                tts_config = complete_config.get('tts_configuration', {})
                structured = tts_config.get('structured_config', {})
                
                voice_id = structured.get('voice_id') or structured.get('voice', 'unknown')
                model_name = structured.get('model', 'unknown')
                provider = tts_config.get('provider_detection', 'unknown')
                full_tts_config = structured
            
            enhanced_data = {
                'voice_id': voice_id,
                'model_name': model_name,
                'provider': provider,
                'characters_count': getattr(metrics_obj, 'characters_count', 0),
                'audio_duration': getattr(metrics_obj, 'audio_duration', 0),
                'ttfb': getattr(metrics_obj, 'ttfb', 0),
                'request_id': getattr(metrics_obj, 'request_id', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time()),
                'full_tts_configuration': full_tts_config,
                'voice_settings': full_tts_config.get('voice_settings'),
                'stability': full_tts_config.get('stability'),
                'similarity_boost': full_tts_config.get('similarity_boost'),
                'style': full_tts_config.get('style'),
                'use_speaker_boost': full_tts_config.get('use_speaker_boost'),
                'speed': full_tts_config.get('speed'),
                'format': full_tts_config.get('format'),
                'sample_rate': full_tts_config.get('sample_rate')
            }
            
            # Update current turn if it exists
            if self.current_turn:
                if not self.current_turn.enhanced_tts_data:
                    self.current_turn.enhanced_tts_data = {}
                self.current_turn.enhanced_tts_data.update(enhanced_data)
                logger.info(f"Enhanced TTS metrics: {voice_id} (provider: {provider}, model: {model_name})")
                
        except Exception as e:
            logger.error(f"Error extracting enhanced TTS metrics: {e}")


  
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
        logger.info("Session data reference set for enhanced model detection")
        
        # CRITICAL DEBUG: Log what we actually have
        if session_data and 'complete_configuration' in session_data:
            logger.info("Session data HAS complete_configuration")
        else:
            logger.info("Session data MISSING complete_configuration")

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


    def _is_done_reporting(self, text: str) -> bool:
        """Check if user is done reporting bugs"""
        if self.bug_detector:
            return self.bug_detector._is_done_reporting(text)
        return False

    def _store_bug_details_in_session(self):
        """Store all collected bug details in session data"""
        if hasattr(self, '_session_data') and self._session_data and hasattr(self, '_bug_details'):
            if 'bug_reports' not in self._session_data:
                self._session_data['bug_reports'] = []
            
            bug_report_entry = {
                'report_id': f"bug_report_{len(self._session_data['bug_reports']) + 1}",
                'timestamp': time.time(),
                'details': self._bug_details.copy(),
                'total_messages': len(self._bug_details),
                'stored_problematic_message': getattr(self, '_stored_message', None),
                'status': 'completed'
            }
            
            self._session_data['bug_reports'].append(bug_report_entry)
            logger.info(f"💾 Stored bug report with {len(self._bug_details)} messages")
            
            # Clear bug details for next report
            self._bug_details = []
        else:
            logger.warning("Cannot store bug details - missing session_data or bug_details")


    def _store_session_reference(self):
        """Store session reference for sending responses"""
        # This will be set by the setup function
        pass


def setup_session_event_handlers(session, session_data, usage_collector, userdata, bug_detector):
    """Setup all session event handlers with transcript collector"""

    transcript_collector = CorrectedTranscriptCollector(bug_detector=bug_detector)
    session_data["transcript_collector"] = transcript_collector

    transcript_collector._session = session
    transcript_collector._session_data = session_data

    session_data["transcript_collector"] = transcript_collector

    # EXTRACT CONFIGURATION FIRST - BEFORE setting reference
    try:
        extract_complete_session_configuration(session, session_data)
        logger.info("Configuration extracted immediately during setup")
    except Exception as e:
        logger.error(f"Failed to extract configuration during setup: {e}")

    # NOW SET THE REFERENCE (after configuration exists)
    transcript_collector.set_session_data_reference(session_data)

    @session.on("conversation_item_added") 
    def on_conversation_item_added(event):
        transcript_collector.on_conversation_item_added(event)
        
        # Send any pending bug responses
        if hasattr(transcript_collector, '_pending_bug_response') and transcript_collector._pending_bug_response:
            response_to_send = transcript_collector._pending_bug_response
            transcript_collector._pending_bug_response = None  # clear first

            try:
                session.say(response_to_send, add_to_chat_ctx=False)
                logger.info(f"✅ Sent bug response: {response_to_send}")
            except Exception as e:
                logger.error(f"❌ Failed to send bug response: {e}")
            
            # Create the async task
            send_bug_response()

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



def extract_complete_session_configuration(session, session_data):
    """Extract EVERYTHING - complete configuration capture with proper STT/TTS extraction"""
    
    def make_serializable(obj):
        """Convert non-serializable objects to serializable format - improved version"""
        if obj is None:
            return None
        
        # Handle primitive types
        if isinstance(obj, (str, int, float, bool)):
            return obj
        
        # Handle lists and tuples
        if isinstance(obj, (list, tuple)):
            return [make_serializable(item) for item in obj]
        
        # Handle dictionaries
        if isinstance(obj, dict):
            return {str(k): make_serializable(v) for k, v in obj.items() if not str(k).startswith('_')}
        
        # Handle objects with __dict__
        if hasattr(obj, '__dict__'):
            return {k: make_serializable(v) for k, v in vars(obj).items() if not k.startswith('_')}
        
        # Handle other types by converting to string
        try:
            # Try to see if it's already JSON serializable
            import json
            json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            # Convert to string representation
            return str(obj)
    
    def filter_not_given(config_dict):
        """Remove NOT_GIVEN values from configuration"""
        return {k: v for k, v in config_dict.items() if str(v) != 'NOT_GIVEN' and v is not None}
    
    complete_config = {
        'timestamp': time.time(),
        'llm_configuration': {},
        'stt_configuration': {},
        'tts_configuration': {},
        'session_metadata': {},
        'pipeline_configuration': {}
    }
    
    # LLM Configuration - existing code works well
    if hasattr(session, 'llm') and session.llm:
        llm_obj = session.llm
        llm_config = {
            'model': getattr(llm_obj, 'model', None),
        }
        
        if hasattr(llm_obj, '_opts') and llm_obj._opts:
            opts = llm_obj._opts
            llm_config.update({
                'temperature': getattr(opts, 'temperature', None),
                'max_completion_tokens': getattr(opts, 'max_completion_tokens', None),
                'user': getattr(opts, 'user', None),
                'parallel_tool_calls': getattr(opts, 'parallel_tool_calls', None),
                'tool_choice': getattr(opts, 'tool_choice', None),
                'store': getattr(opts, 'store', None),
                'service_tier': getattr(opts, 'service_tier', None),
            })
            
        llm_config = filter_not_given(llm_config)
        
        if hasattr(llm_obj, '_client') and llm_obj._client:
            client = llm_obj._client
            if hasattr(client, 'timeout'):
                timeout_val = getattr(client, 'timeout')
                llm_config['timeout'] = make_serializable(timeout_val)
        
        complete_config['llm_configuration'] = {
            'structured_config': llm_config,
            'class_info': {
                'class_name': type(llm_obj).__name__,
                'module': llm_obj.__module__,
            },
            'provider_detection': detect_provider_from_model_name(llm_config.get('model'))
        }
    
    # STT Configuration - Enhanced extraction
    if hasattr(session, 'stt') and session.stt:
        stt_obj = session.stt
        stt_config = {}
        
        # Direct attributes from object
        direct_attrs = ['model', 'language', 'sample_rate', 'channels', 'capabilities', 'label']
        for attr in direct_attrs:
            if hasattr(stt_obj, attr):
                val = getattr(stt_obj, attr)
                stt_config[attr] = make_serializable(val)
        
        # Extract from _opts (this is where the real config is stored)
        if hasattr(stt_obj, '_opts') and stt_obj._opts:
            opts = stt_obj._opts
            
            # Common STT options based on your debug output
            opts_attrs = [
                'language', 'model', 'api_key', 'base_url',
                'sample_rate', 'channels', 'encoding', 'format',
                'detect_language', 'interim_results', 'punctuate',
                'profanity_filter', 'redact_pii', 'smart_formatting',
                'utterance_end_ms', 'vad_turnoff', 'keywords'
            ]
            
            for attr in opts_attrs:
                if hasattr(opts, attr):
                    val = getattr(opts, attr)
                    if attr == 'api_key':
                        stt_config[attr] = "masked"
                    else:
                        stt_config[attr] = make_serializable(val)
        
        stt_config = filter_not_given(stt_config)
        
        complete_config['stt_configuration'] = {
            'structured_config': stt_config,
            'class_info': {
                'class_name': type(stt_obj).__name__,
                'module': stt_obj.__module__,
            },
            'provider_detection': detect_provider_from_model_name(stt_config.get('model')),
            'capabilities': make_serializable(getattr(stt_obj, 'capabilities', None))
        }
    
    # TTS Configuration - Enhanced extraction
    if hasattr(session, 'tts') and session.tts:
        tts_obj = session.tts
        tts_config = {}
        
        # Direct attributes from object
        direct_attrs = ['voice_id', 'model', 'language', 'sample_rate', 'num_channels', 'capabilities', 'label']
        for attr in direct_attrs:
            if hasattr(tts_obj, attr):
                val = getattr(tts_obj, attr)
                tts_config[attr] = make_serializable(val)
        
        # Extract from _opts (this is where the real config is stored)
        if hasattr(tts_obj, '_opts') and tts_obj._opts:
            opts = tts_obj._opts
            
            # Common TTS options based on your debug output
            opts_attrs = [
                'voice_id', 'voice', 'model', 'language', 'api_key', 'base_url',
                'sample_rate', 'encoding', 'format', 'speed', 'pitch', 'volume',
                'streaming_latency', 'chunk_length_schedule', 'enable_ssml_parsing',
                'inactivity_timeout', 'sync_alignment', 'auto_mode'
            ]
            
            for attr in opts_attrs:
                if hasattr(opts, attr):
                    val = getattr(opts, attr)
                    if attr == 'api_key':
                        tts_config[attr] = "masked"
                    else:
                        tts_config[attr] = make_serializable(val)
            
            # Special handling for voice_settings (nested object)
            if hasattr(opts, 'voice_settings') and opts.voice_settings:
                voice_settings = opts.voice_settings
                tts_config['voice_settings'] = {}
                
                voice_settings_attrs = [
                    'stability', 'similarity_boost', 'style', 'speed', 
                    'use_speaker_boost', 'optimize_streaming_latency'
                ]
                
                for attr in voice_settings_attrs:
                    if hasattr(voice_settings, attr):
                        val = getattr(voice_settings, attr)
                        tts_config['voice_settings'][attr] = make_serializable(val)
                
                # Remove empty voice_settings
                if not tts_config['voice_settings']:
                    del tts_config['voice_settings']
            
            # Special handling for word_tokenizer
            if hasattr(opts, 'word_tokenizer') and opts.word_tokenizer:
                tokenizer = opts.word_tokenizer
                tts_config['word_tokenizer'] = {
                    'class_name': type(tokenizer).__name__,
                    'module': tokenizer.__module__
                }
        
        tts_config = filter_not_given(tts_config)
        
        complete_config['tts_configuration'] = {
            'structured_config': tts_config,
            'class_info': {
                'class_name': type(tts_obj).__name__,
                'module': tts_obj.__module__,
            },
            'provider_detection': detect_provider_from_model_name(tts_config.get('model') or tts_config.get('voice_id')),
            'capabilities': make_serializable(getattr(tts_obj, 'capabilities', None))
        }
    
    # VAD Configuration (based on actual debug output)
    if hasattr(session, 'vad') and session.vad:
        vad_obj = session.vad
        vad_config = {}
        
        # Extract from _opts where the real config is stored
        if hasattr(vad_obj, '_opts') and vad_obj._opts:
            opts = vad_obj._opts
            
            # Based on debug output: _VADOptions(min_speech_duration=0.05, min_silence_duration=0.4, prefix_padding_duration=0.5, max_buffered_speech=60.0, activation_threshold=0.5, sample_rate=16000)
            vad_opts_attrs = [
                'min_speech_duration', 'min_silence_duration', 'prefix_padding_duration', 
                'max_buffered_speech', 'activation_threshold', 'sample_rate'
            ]
            
            for attr in vad_opts_attrs:
                if hasattr(opts, attr):
                    val = getattr(opts, attr)
                    vad_config[attr] = make_serializable(val)
        
        # Also get capabilities
        if hasattr(vad_obj, 'capabilities') and vad_obj.capabilities:
            vad_config['capabilities'] = make_serializable(vad_obj.capabilities)
        
        if vad_config:
            complete_config['vad_configuration'] = {
                'structured_config': vad_config,
                'class_info': {
                    'class_name': type(vad_obj).__name__,
                    'module': vad_obj.__module__,
                }
            }
    
    # Session metadata - with serialization safety
    session_attrs = {}
    for key, value in vars(session).items():
        if not key.startswith('_'):
            session_attrs[key] = make_serializable(value)
    
    complete_config['session_metadata'] = {
        'session_attributes': session_attrs,
        'session_class': type(session).__name__,
        'session_module': session.__module__,
        'room_name': getattr(session, 'room', {}).get('name') if hasattr(session, 'room') else None
    }
    
    # Store in session data
    session_data['complete_configuration'] = complete_config
    
    # Log what we captured
    stt_model = complete_config['stt_configuration']['structured_config'].get('model', 'unknown')
    stt_lang = complete_config['stt_configuration']['structured_config'].get('language', 'unknown')
    tts_voice = complete_config['tts_configuration']['structured_config'].get('voice_id', 'unknown')
    tts_model = complete_config['tts_configuration']['structured_config'].get('model', 'unknown')
    llm_temp = complete_config['llm_configuration']['structured_config'].get('temperature', 'unknown')
    vad_threshold = complete_config.get('vad_configuration', {}).get('structured_config', {}).get('activation_threshold', 'unknown')
    
    logger.info(f"Complete configuration captured:")
    logger.info(f"  STT: {stt_model} ({stt_lang})")
    logger.info(f"  TTS: {tts_voice} ({tts_model})")  
    logger.info(f"  LLM: temp={llm_temp}")
    logger.info(f"  VAD: threshold={vad_threshold}")
    
    return complete_config


def setup_instrumentation_when_ready():
    """Check if instrumentation setup is ready - currently returns False to use fallback"""
    return False


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