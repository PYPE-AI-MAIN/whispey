# sdk/whispey/event_handlers.py
import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.agents.metrics import STTMetrics, LLMMetrics, TTSMetrics, EOUMetrics, VADMetrics
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
    enhanced_vad_data: Optional[Dict[str, Any]] = None
    
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
            'prompt_data': self.prompt_data,
            'enhanced_vad_data': self.enhanced_vad_data
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

        self._stored_telemetry_instance = None


    def _extract_enhanced_vad_from_metrics(self, metrics_obj):
        """Extract enhanced VAD data from metrics object with complete configuration"""
        try:
            # Get VAD configuration
            vad_config = {}
            if hasattr(self, '_session_data') and self._session_data:
                complete_config = self._session_data.get('complete_configuration', {})
                vad_config = complete_config.get('vad_configuration', {}).get('structured_config', {})
            
            enhanced_data = {
                'activation_threshold': vad_config.get('activation_threshold', 0.5),
                'min_speech_duration': vad_config.get('min_speech_duration', 0.05),
                'min_silence_duration': vad_config.get('min_silence_duration', 0.4),
                'sample_rate': vad_config.get('sample_rate', 16000),
                'speech_probability': getattr(metrics_obj, 'speech_probability', None),
                'voice_activity_detected': getattr(metrics_obj, 'voice_activity_detected', None),
                'silence_duration': getattr(metrics_obj, 'silence_duration', None),
                'speech_duration': getattr(metrics_obj, 'speech_duration', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time()),
                'full_vad_configuration': vad_config
            }
            
            if self.current_turn:
                if not self.current_turn.enhanced_vad_data:
                    self.current_turn.enhanced_vad_data = {}
                self.current_turn.enhanced_vad_data.update(enhanced_data)
                
        except Exception as e:
            logger.error(f"Error extracting enhanced VAD metrics: {e}")

    def _extract_enhanced_vad_from_state_events(self):
        """Extract VAD insights from state change events"""
        if not self.current_turn or not self.current_turn.state_events:
            return
            
        try:
            user_states = [e for e in self.current_turn.state_events if e['type'] == 'user_state']
            
            speech_periods = []
            silence_periods = []
            
            for i, event in enumerate(user_states):
                if event['new_state'] == 'speaking':
                    # Calculate silence before speaking
                    if i > 0 and user_states[i-1]['new_state'] == 'silent':
                        silence_duration = event['timestamp'] - user_states[i-1]['timestamp']
                        silence_periods.append(silence_duration)
                elif event['new_state'] == 'silent':
                    # Calculate speech duration
                    if i > 0 and user_states[i-1]['new_state'] == 'speaking':
                        speech_duration = event['timestamp'] - user_states[i-1]['timestamp']
                        speech_periods.append(speech_duration)
            
            vad_insights = {
                'total_speech_periods': len(speech_periods),
                'total_silence_periods': len(silence_periods),
                'avg_speech_duration': sum(speech_periods) / len(speech_periods) if speech_periods else 0,
                'avg_silence_duration': sum(silence_periods) / len(silence_periods) if silence_periods else 0,
                'speech_to_silence_ratio': len(speech_periods) / len(silence_periods) if silence_periods else float('inf'),
                'state_transitions': len(user_states)
            }
            
            if not self.current_turn.enhanced_vad_data:
                self.current_turn.enhanced_vad_data = {}
            self.current_turn.enhanced_vad_data.update(vad_insights)
            
        except Exception as e:
            logger.error(f"Error extracting VAD insights from state events: {e}")
    




    def _create_trace_span(self, metrics_obj, operation_name: str) -> Dict[str, Any]:
        """Create a trace span from metrics object - with detailed logging"""
        print(f"\n--- Creating {operation_name.upper()} span ---")
        print(f"Metrics object type: {type(metrics_obj)}")
        print(f"Available attributes: {[attr for attr in dir(metrics_obj) if not attr.startswith('_')]}")
        
        span_data = {
            "span_id": f"span_{operation_name}_{uuid.uuid4().hex[:8]}",
            "operation": operation_name,
            "start_time": getattr(metrics_obj, 'timestamp', time.time()),
            "duration_ms": int(getattr(metrics_obj, 'duration', 0) * 1000),
            "status": "success",
            "metadata": {}
        }
        
        # Log what metadata we're extracting
        if operation_name == "llm":
            metadata = {
                "prompt_tokens": getattr(metrics_obj, 'prompt_tokens', 0),
                "completion_tokens": getattr(metrics_obj, 'completion_tokens', 0),
                "ttft": getattr(metrics_obj, 'ttft', 0),
                "tokens_per_second": getattr(metrics_obj, 'tokens_per_second', 0),
                "request_id": getattr(metrics_obj, 'request_id', None)
            }
            print(f"LLM Metadata extracted: {metadata}")
            
            # CHECK: Does metrics_obj have any prompt-related attributes?
            prompt_attrs = [attr for attr in dir(metrics_obj) if 'prompt' in attr.lower() or 'message' in attr.lower() or 'context' in attr.lower()]
            if prompt_attrs:
                print(f"FOUND prompt-related attributes: {prompt_attrs}")
                for attr in prompt_attrs:
                    try:
                        value = getattr(metrics_obj, attr)
                        print(f"  {attr}: {str(value)[:100]}...")
                    except:
                        print(f"  {attr}: <unable to access>")
            else:
                print("NO prompt-related attributes found in metrics object")
            
            span_data["metadata"] = metadata
        
        print(f"Final span data: {span_data}")
        print("--- End span creation ---\n")
        
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
            except Exception as e:
                logger.error(f"❌ Failed to repeat stored message: {e}")
                # Fallback
                try:
                    self._session.say(self.bug_detector.fallback_message, add_to_chat_ctx=False)
                except:
                    logger.error("❌ Complete failure to send any response")
        else:
            logger.warning("Cannot repeat stored message - missing components")




    def on_conversation_item_added(self, event):
        """Called when conversation item is added - enhanced data extraction from conversation"""

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

        if event.item.role == "user":
            original_text = event.item.text_content
            
            # Determine if this message should be intercepted
            should_intercept = False
            
            # CHECK 1: Initial bug report detection
            if self._is_bug_report(original_text) and not self._bug_collection_mode:
                # Store the last agent message for later repetition
                if self.turns and len(self.turns) > 0:
                    last_turn = self.turns[-1]
                    if last_turn.agent_response:
                        self._stored_message = last_turn.agent_response
                        last_turn.bug_report = True
                
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
                
            # CHECK 2: Bug end detection
            elif self._bug_collection_mode and self._is_done_reporting(original_text):
                if self.bug_detector:
                    self.bug_detector._debug_log("✅ Bug reporting ENDED!")
                    self.bug_detector._debug_log(f"Collected {len(self._bug_details)} bug messages")
                
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
                
                if self.bug_detector:
                    continuation_prefix = self.bug_detector.continuation_prefix
                    continuation_msg = f"{continuation_prefix}{self._stored_message if self._stored_message else 'N/A'}"
                    self.bug_detector._debug_log(f"Repeating stored message: '{continuation_msg[:100]}...'")
                
                # Repeat the stored message
                self._repeat_stored_message_immediately()
                
            # CHECK 3: Continue collecting bug details
            elif self._bug_collection_mode:
                if self.bug_detector:
                    self.bug_detector._debug_log(f"Collecting bug details: '{original_text}'")
                
                # Store additional bug details
                self._bug_details.append({
                    'type': 'bug_details',
                    'text': original_text,
                    'timestamp': time.time()
                })
                
                # Mark for interception
                should_intercept = True
                self._intercepted_messages[event.item.id] = original_text
                
                if self.bug_detector:
                    collection_prompt = self.bug_detector.collection_prompt
                    self.bug_detector._debug_log(f"Sending collection prompt: '{collection_prompt}'")
                
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
            else:
                if self.bug_detector:
                    self.bug_detector._debug_log("❌ Message INTERCEPTED - not processing normally")
                    
        elif event.item.role == "assistant":
            # Skip assistant processing during bug collection
            if self._bug_collection_mode:
                if self.bug_detector:
                    self.bug_detector._debug_log("Skipping assistant processing (bug collection mode)")
                return
            
            # Normal assistant processing
            if not self.current_turn:
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
                
                # Update the telemetry instance's turn context
                if hasattr(self, '_session_data') and self._session_data:
                    telemetry_instance = self._session_data.get('telemetry_instance')
                    if telemetry_instance:
                        telemetry_instance._update_turn_context(
                            self.current_turn.turn_id, 
                            self.turn_counter
                        )
            
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
            self._extract_enhanced_vad_from_state_events()
            
            # Complete the turn
            self.turns.append(self.current_turn)
            self.current_turn = None




    def _extract_model_from_llm_metrics(self, metrics_obj):
        """Extract model name directly from LLM metrics object"""
        # Try direct attributes first
        # log metrics_obj


        if hasattr(metrics_obj, 'model') and metrics_obj.model:
            return str(metrics_obj.model)
        
        # Try session configuration as fallback
        if hasattr(self, '_session_data') and self._session_data:
            complete_config = self._session_data.get('complete_configuration', {})
            llm_config = complete_config.get('llm_configuration', {})
            structured = llm_config.get('structured_config', {})
            model = structured.get('model')
            if model and model != 'unknown':
                return model
        
        return 'unknown'

    def _extract_model_from_tts_metrics(self, metrics_obj):
        """Extract model/voice from TTS metrics object"""
        # Try session configuration
        if hasattr(self, '_session_data') and self._session_data:
            complete_config = self._session_data.get('complete_configuration', {})
            tts_config = complete_config.get('tts_configuration', {})
            structured = tts_config.get('structured_config', {})
            voice = structured.get('voice_id') or structured.get('voice') or structured.get('model')
            if voice and voice != 'unknown':
                return voice
        
        return 'unknown'

    def _extract_model_from_stt_metrics(self, metrics_obj):
        """Extract model name from STT metrics object"""
        # Try session configuration
        if hasattr(self, '_session_data') and self._session_data:
            complete_config = self._session_data.get('complete_configuration', {})
            stt_config = complete_config.get('stt_configuration', {})
            structured = stt_config.get('structured_config', {})
            model = structured.get('model')
            if model and model != 'unknown':
                return model
        
        return 'unknown'

    def _calculate_llm_cost_immediately(self, metrics_obj, model_name):
        """Calculate LLM cost immediately when metrics arrive"""
        try:
            from whispey.pricing_calculator import get_pricing_calculator
            calculator = get_pricing_calculator()
            cost, explanation = calculator.calculate_llm_cost(
                model_name, 
                metrics_obj.prompt_tokens, 
                metrics_obj.completion_tokens
            )
            return cost
        except Exception as e:
            logger.error(f"Error calculating LLM cost: {e}")
            return 0.0

    def _calculate_tts_cost_immediately(self, metrics_obj, model_name):
        """Calculate TTS cost immediately when metrics arrive"""
        try:
            from whispey.pricing_calculator import get_pricing_calculator
            calculator = get_pricing_calculator()
            cost = calculator.calculate_tts_cost(
                model_name, 
                metrics_obj.characters_count
            )
            return cost
        except Exception as e:
            logger.error(f"Error calculating TTS cost: {e}")
            return 0.0

    def _calculate_stt_cost_immediately(self, metrics_obj, model_name):
        """Calculate STT cost immediately when metrics arrive"""
        try:
            from whispey.pricing_calculator import get_pricing_calculator
            calculator = get_pricing_calculator()
            cost = calculator.calculate_stt_cost(
                model_name, 
                metrics_obj.audio_duration
            )
            return cost
        except Exception as e:
            logger.error(f"Error calculating STT cost: {e}")
            return 0.0





    

    def on_metrics_collected(self, metrics_event):
        """Enhanced metrics collection with immediate cost calculation using provider data"""
        metrics_obj = metrics_event.metrics
        
        # Store metrics for session-level processing
        metrics_data = {
            'metrics_obj': metrics_obj,
            'request_id': getattr(metrics_obj, 'request_id', None),
            'timestamp': time.time(),
            'type': type(metrics_obj).__name__
        }
        
        if not hasattr(self, '_pending_metrics_for_spans'):
            self._pending_metrics_for_spans = []
        self._pending_metrics_for_spans.append(metrics_data)
        
        if isinstance(metrics_obj, STTMetrics):
            # First extract enhanced metrics to get provider and model info
            enhanced_data = self._extract_enhanced_stt_from_metrics(metrics_obj)
            
            # Log comprehensive STT metrics
            all_attrs = {attr: getattr(metrics_obj, attr, 'MISSING') for attr in dir(metrics_obj) if not attr.startswith('_')}
            
            # Use enhanced data for model and provider info
            model_name = enhanced_data.get('model', 'unknown') if enhanced_data else self._extract_model_from_stt_metrics(metrics_obj)
            provider = enhanced_data.get('provider', 'unknown') if enhanced_data else 'unknown'
            
            # Calculate cost using enhanced data
            cost = self._calculate_stt_cost_with_provider(metrics_obj, model_name, provider)
            
            # Log in structured format
            audio_duration = getattr(metrics_obj, 'audio_duration', 'N/A')
            request_id = getattr(metrics_obj, 'request_id', 'N/A')
            timestamp = getattr(metrics_obj, 'timestamp', 'N/A')
            
            
            stt_data = {
                'audio_duration': metrics_obj.audio_duration,
                'duration': metrics_obj.duration,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id,
                'model_used': model_name,
                'provider': provider,
                'calculated_cost': cost
            }
            
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.stt_metrics:
                self.current_turn.stt_metrics = stt_data
                self._ensure_trace_id(self.current_turn)
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].stt_metrics:
                self.turns[-1].stt_metrics = stt_data
                self._ensure_trace_id(self.turns[-1])
            else:
                self.pending_metrics['stt'] = stt_data
            
        elif isinstance(metrics_obj, LLMMetrics):
            # First extract enhanced metrics to get provider and model info
            enhanced_data = self._extract_enhanced_llm_from_metrics(metrics_obj)
            
            # Use enhanced data for model and provider info
            model_name = enhanced_data.get('model', 'unknown') if enhanced_data else self._extract_model_from_llm_metrics(metrics_obj)
            provider = enhanced_data.get('provider', 'unknown') if enhanced_data else 'unknown'
            
            # Calculate cost using enhanced data
            cost = self._calculate_llm_cost_with_provider(metrics_obj, model_name, provider)
            
            llm_data = {
                'prompt_tokens': metrics_obj.prompt_tokens,
                'completion_tokens': metrics_obj.completion_tokens,
                'ttft': metrics_obj.ttft,
                'tokens_per_second': metrics_obj.tokens_per_second,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id,
                'model_used': model_name,
                'provider': provider,
                'calculated_cost': cost
            }
            
            if self.current_turn and not self.current_turn.llm_metrics:
                self.current_turn.llm_metrics = llm_data
                self._ensure_trace_id(self.current_turn)
            else:
                self.pending_metrics['llm'] = llm_data
            
        elif isinstance(metrics_obj, TTSMetrics):
            # First extract enhanced metrics to get provider and model info
            enhanced_data = self._extract_enhanced_tts_from_metrics(metrics_obj)
            
            # Use enhanced data for model and provider info
            model_name = enhanced_data.get('model', 'unknown') if enhanced_data else self._extract_model_from_tts_metrics(metrics_obj)
            provider = enhanced_data.get('provider', 'unknown') if enhanced_data else 'unknown'
            
            # Calculate cost using enhanced data
            cost = self._calculate_tts_cost_with_provider(metrics_obj, model_name, provider)
            
            
            tts_data = {
                'characters_count': metrics_obj.characters_count,
                'audio_duration': metrics_obj.audio_duration,
                'ttfb': metrics_obj.ttfb,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id,
                'model_used': model_name,
                'provider': provider,
                'calculated_cost': cost
            }
            
            if self.current_turn and self.current_turn.agent_response and not self.current_turn.tts_metrics:
                self.current_turn.tts_metrics = tts_data
                self._ensure_trace_id(self.current_turn)
            elif self.turns and self.turns[-1].agent_response and not self.turns[-1].tts_metrics:
                self.turns[-1].tts_metrics = tts_data
                self._ensure_trace_id(self.turns[-1])
            else:
                self.pending_metrics['tts'] = tts_data
            
        elif isinstance(metrics_obj, EOUMetrics):
            eou_data = {
                'end_of_utterance_delay': metrics_obj.end_of_utterance_delay,
                'transcription_delay': metrics_obj.transcription_delay,
                'timestamp': metrics_obj.timestamp
            }
            
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.eou_metrics:
                self.current_turn.eou_metrics = eou_data
                self._ensure_trace_id(self.current_turn)
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].eou_metrics:
                self.turns[-1].eou_metrics = eou_data
                self._ensure_trace_id(self.turns[-1])
            else:
                self.pending_metrics['eou'] = eou_data

        elif isinstance(metrics_obj, VADMetrics):
            vad_data = {
                'speech_probability': getattr(metrics_obj, 'speech_probability', None),
                'voice_activity_detected': getattr(metrics_obj, 'voice_activity_detected', None),
                'silence_duration': getattr(metrics_obj, 'silence_duration', None),
                'speech_duration': getattr(metrics_obj, 'speech_duration', None),
                'timestamp': getattr(metrics_obj, 'timestamp', time.time())
            }
            
            if not hasattr(self, '_vad_events'):
                self._vad_events = []
            self._vad_events.append(vad_data)
            
            self._extract_enhanced_vad_from_metrics(metrics_obj)
        

    def _calculate_stt_cost_with_provider(self, metrics_obj, model_name, provider):
        """Calculate STT cost using provider and model information"""
        audio_duration = getattr(metrics_obj, 'audio_duration', 0)
        
        # Define your cost structure based on provider/model
        cost_rates = {
            'sarvam': {
                'saarika:v2.5': 0.00002,  # per second
            },
            'openai': {
                'whisper-1': 0.006 / 60,  # $0.006 per minute = per second
            }
            # Add more providers/models as needed
        }
        
        rate = cost_rates.get(provider, {}).get(model_name, 0.00001)  # default rate
        return audio_duration * rate

    def _calculate_tts_cost_with_provider(self, metrics_obj, model_name, provider):
        """Calculate TTS cost using provider and model information"""
        characters_count = getattr(metrics_obj, 'characters_count', 0)
        
        # Define your cost structure based on provider/model
        cost_rates = {
            'elevenlabs': {
                'eleven_flash_v2_5': 0.0001,  # per 1000 characters
            },
            'openai': {
                'tts-1': 0.015 / 1000,  # $0.015 per 1000 characters
                'tts-1-hd': 0.030 / 1000,  # $0.030 per 1000 characters
            }
            # Add more providers/models as needed
        }
        
        rate = cost_rates.get(provider, {}).get(model_name, 0.00001)  # default rate
        return characters_count * rate

    def _calculate_llm_cost_with_provider(self, metrics_obj, model_name, provider):
        """Calculate LLM cost using provider and model information"""
        prompt_tokens = getattr(metrics_obj, 'prompt_tokens', 0)
        completion_tokens = getattr(metrics_obj, 'completion_tokens', 0)
        
        # Define your cost structure based on provider/model
        cost_rates = {
            'openai': {
                'gpt-4.1-mini': {
                    'input': 0.15 / 1000000,  # per token
                    'output': 0.6 / 1000000,  # per token
                },
                'gpt-4o': {
                    'input': 2.5 / 1000000,
                    'output': 10.0 / 1000000,
                }
            }
            # Add more providers/models as needed
        }
        
        rates = cost_rates.get(provider, {}).get(model_name, {'input': 0.00001, 'output': 0.00001})
        return (prompt_tokens * rates['input']) + (completion_tokens * rates['output'])






    def finalize_session(self):
        """Enhanced finalization with comprehensive span assignment"""
        
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
        
        if self._stored_telemetry_instance and hasattr(self._stored_telemetry_instance, 'spans_data'):
            self._assign_session_spans_to_turns_direct(self._stored_telemetry_instance)
        else:
            logger.error("No stored telemetry instance available for span assignment")
        
        # Apply remaining pending metrics
        if self.pending_metrics['tts'] and self.turns:
            for turn in reversed(self.turns):
                if turn.agent_response and not turn.tts_metrics:
                    turn.tts_metrics = self.pending_metrics['tts']
                    break
                    
        if self.pending_metrics['stt'] and self.turns:
            for turn in reversed(self.turns):
                if turn.user_transcript and not turn.stt_metrics:
                    turn.stt_metrics = self.pending_metrics['stt']
                    break
        
        if self.pending_metrics['llm'] and self.turns:
            for turn in reversed(self.turns):
                if turn.agent_response and not turn.llm_metrics:
                    turn.llm_metrics = self.pending_metrics['llm']
                    break
        
        if self.pending_metrics['eou'] and self.turns:
            for turn in reversed(self.turns):
                if turn.user_transcript and not turn.eou_metrics:
                    turn.eou_metrics = self.pending_metrics['eou']
                    break
        
        # Finalize trace data for each turn
        for turn in self.turns:
            self._finalize_trace_data(turn)
        


    def _assign_session_spans_to_turns(self):
        """Debug version - Fixed span assignment focusing on real request_ids"""
        
        if not (hasattr(self, '_session_data') and self._session_data):
            logger.error("No session data for span assignment")
            return
            
        telemetry_instance = self._session_data.get('telemetry_instance')
        if not (telemetry_instance and hasattr(telemetry_instance, 'spans_data')):
            logger.error("No telemetry instance found for span assignment")
            return
        
        all_spans = telemetry_instance.spans_data
        
        # Filter spans to only those with real request_ids
        real_spans = [span for span in all_spans if span.get('request_id_source') in ['nested_json', 'direct_attribute']]
        
        assigned_count = 0
        
        for turn in self.turns:
            
            if turn.otel_spans and len(turn.otel_spans) > 0:
                continue
                
            # Get turn's request_ids
            turn_request_ids = {}
            if turn.stt_metrics and turn.stt_metrics.get('request_id'):
                turn_request_ids['stt'] = turn.stt_metrics['request_id']
            if turn.llm_metrics and turn.llm_metrics.get('request_id'):
                turn_request_ids['llm'] = turn.llm_metrics['request_id']
            if turn.tts_metrics and turn.tts_metrics.get('request_id'):
                turn_request_ids['tts'] = turn.tts_metrics['request_id']
            
            
            # Find exact matches in real spans
            matched_spans = []
            for span in real_spans:
                span_request_id = span.get('request_id')
                span_name = span.get('name', '')
                
                
                # Check if this span's request_id matches any turn request_id
                for turn_type, turn_request_id in turn_request_ids.items():
                    
                    if span_request_id == turn_request_id:
                        
                        # Check span type matches turn type
                        type_match = False
                        if turn_type == 'llm' and 'llm_request' in span_name:
                            type_match = True
                        elif turn_type == 'tts' and 'tts_request' in span_name:
                            type_match = True
                        elif turn_type == 'stt' and 'stt_request' in span_name:
                            type_match = True
                        
                        
                        if type_match:
                            clean_span = self._create_clean_span_data(span, span_request_id)
                            matched_spans.append(clean_span)
                            assigned_count += 1
                            break
                        else:
                            logger.info(f"Type mismatch, skipped")
            
            if matched_spans:
                turn.otel_spans.extend(matched_spans)
        




    def _find_matching_otel_spans(self, request_id, operation_type):
        """Enhanced span matching with multiple strategies"""
        matching_spans = []
        
        if not (hasattr(self, '_session_data') and self._session_data):
            return matching_spans
            
        telemetry_instance = self._session_data.get('telemetry_instance')
        if not (telemetry_instance and hasattr(telemetry_instance, 'spans_data')):
            return matching_spans


        current_time = time.time()
        recent_threshold = current_time - 30  # 30 seconds window

        for span in telemetry_instance.spans_data:
            span_name = span.get('name', 'unknown')
            span_op_type = self._categorize_span_operation(span_name)
            span_request_id = span.get('request_id')
            span_request_id_source = span.get('request_id_source', 'unknown')
            
            # Strategy 1: Exact request_id match
            if request_id and span_request_id == request_id and span_op_type == operation_type:
                clean_span = self._create_clean_span_data(span, request_id)
                matching_spans.append(clean_span)
                continue
            
            # Strategy 2: Partial request_id match (for synthetic IDs)
            if (request_id and span_request_id and 
                len(request_id) >= 8 and len(span_request_id) >= 8 and
                (request_id[:8] == span_request_id[:8] or request_id[-8:] == span_request_id[-8:]) and
                span_op_type == operation_type):
                clean_span = self._create_clean_span_data(span, request_id)
                matching_spans.append(clean_span)
                continue
            
            # Strategy 3: Recent spans of same operation type (fallback)
            span_captured_time = span.get('captured_at', 0)
            if (not matching_spans and 
                span_op_type == operation_type and 
                span_captured_time > recent_threshold):
                clean_span = self._create_clean_span_data(span, request_id)
                matching_spans.append(clean_span)
        
        return matching_spans

    def _is_span_already_assigned(self, span_id):
        """Check if a span is already assigned to any turn"""
        for turn in self.turns:
            for span in turn.otel_spans:
                if span.get('span_id') == span_id:
                    return True
        
        if self.current_turn:
            for span in self.current_turn.otel_spans:
                if span.get('span_id') == span_id:
                    return True
        
        return False

    def _categorize_span_operation(self, span_name):
        """Categorize span by name to match operation types"""
        if not span_name:
            return "other"
            
        name_lower = span_name.lower()
        
        if any(x in name_lower for x in ['llm', 'chat', 'completion', 'gpt']):
            return "llm"
        elif any(x in name_lower for x in ['tts', 'text_to_speech', 'synthesize']):
            return "tts" 
        elif any(x in name_lower for x in ['stt', 'speech_to_text', 'transcribe']):
            return "stt"
        elif any(x in name_lower for x in ['function_tool', 'tool_call']):
            return "tool"
        else:
            return "other"


    def _extract_request_id_from_span(self, span):
        """Extract request_id from span using multiple methods"""
        span_attrs = span.get('attributes', {})
        
        # Check direct request_id
        if span_attrs.get('request_id'):
            return span_attrs.get('request_id')
        
        # Check gen_ai attributes
        if span_attrs.get('gen_ai.request.id') or span_attrs.get('gen_ai.request_id'):
            return span_attrs.get('gen_ai.request.id') or span_attrs.get('gen_ai.request_id')
        
        # Check in nested JSON metrics
        for metrics_key in ['lk.llm_metrics', 'lk.tts_metrics', 'lk.stt_metrics']:
            metrics_attr = span_attrs.get(metrics_key, '')
            if isinstance(metrics_attr, str) and 'request_id' in metrics_attr:
                try:
                    import json
                    metrics_data = json.loads(metrics_attr)
                    if metrics_data.get('request_id'):
                        return metrics_data.get('request_id')
                except:
                    pass
        
        return None

    
    def _extract_metadata_for_cost_calculation(self, span, operation_type):
        """Extract metadata needed for cost calculation from span and turn data"""
        metadata = {}
        
        if operation_type == 'llm' and self.current_turn:
            # Get from turn's LLM metrics or enhanced data
            if self.current_turn.llm_metrics:
                metadata.update({
                    'model_name': self.current_turn.enhanced_llm_data.get('model_name', 'unknown') if self.current_turn.enhanced_llm_data else 'unknown',
                    'prompt_tokens': self.current_turn.llm_metrics.get('prompt_tokens', 0),
                    'completion_tokens': self.current_turn.llm_metrics.get('completion_tokens', 0)
                })
        
        elif operation_type == 'tts' and self.current_turn:
            if self.current_turn.tts_metrics:
                metadata.update({
                    'model_name': self.current_turn.enhanced_tts_data.get('voice_id', 'unknown') if self.current_turn.enhanced_tts_data else 'unknown',
                    'characters_count': self.current_turn.tts_metrics.get('characters_count', 0)
                })
        
        return metadata

    def _create_clean_span_data(self, span, request_id):
        """Create clean span data preserving all important information"""
        operation_type = self._categorize_span_operation(span.get('name', ''))

        return {
            'span_id': span.get('context', {}).get('span_id') or f"otel_{int(time.time())}",
            'trace_id': span.get('context', {}).get('trace_id'),
            'name': span.get('name', 'unknown'),
            'operation_type': self._categorize_span_operation(span.get('name', '')),
            'operation': operation_type,
            'start_time': span.get('start_time_ns', 0),
            'end_time': span.get('end_time_ns', 0),
            'duration_ms': span.get('duration_ms', 0),
            'attributes': span.get('attributes', {}),
            'events': span.get('events', []),
            'status': span.get('status', {}),
            'request_id': request_id,
            'source': 'otel_capture',
            'metadata': self._extract_metadata_for_cost_calculation(span, operation_type)
        }


   
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
            
        except Exception as e:
            logger.error(f"❌ Error extracting enhanced LLM data: {e}")




    def _extract_enhanced_llm_from_metrics(self, metrics_obj):
        """Extract enhanced LLM data from metrics object with direct model extraction"""
        try:
            # STEP 1: Extract model name directly from metrics_obj first
            model_name = 'unknown'
            provider = 'unknown'
            
            # Try direct extraction from metrics object
            if hasattr(metrics_obj, 'model') and metrics_obj.model:
                model_name = str(metrics_obj.model)
            
            # Try other possible attribute names on metrics_obj
            elif hasattr(metrics_obj, '__dict__'):
                for attr_name in ['model_name', 'llm_model', '_model']:
                    if hasattr(metrics_obj, attr_name):
                        attr_value = getattr(metrics_obj, attr_name)
                        if attr_value and str(attr_value) != 'unknown':
                            model_name = str(attr_value)
                            break
            
            # STEP 2: Fallback to session configuration only if still unknown
            full_llm_config = {}
            if model_name == 'unknown' and hasattr(self, '_session_data') and self._session_data:
                complete_config = self._session_data.get('complete_configuration', {})
                llm_config = complete_config.get('llm_configuration', {})
                structured = llm_config.get('structured_config', {})
                full_llm_config = structured
                
                config_model = structured.get('model')
                if config_model and config_model != 'unknown':
                    model_name = config_model
                
                provider = llm_config.get('provider_detection', 'unknown')
            
            # STEP 3: Detect provider from model name if not found in config
            if provider == 'unknown':
                if 'gpt' in model_name.lower() or 'openai' in model_name.lower():
                    provider = 'openai'
                elif 'claude' in model_name.lower() or 'anthropic' in model_name.lower():
                    provider = 'anthropic'
                elif 'gemini' in model_name.lower() or 'palm' in model_name.lower():
                    provider = 'google'
            
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
                
        except Exception as e:
            logger.error(f"Error extracting enhanced LLM metrics: {e}")
            import traceback
            traceback.print_exc()



 
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

    def enable_enhanced_instrumentation(self, session, agent):
        """Enable state change tracking only"""
        try:
            
            # state change handlers
            self._setup_state_change_handlers(session)
            
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
                
            
        except Exception as e:
            logger.error(f"⚠️ Could not set up state handlers: {e}")


    def _assign_session_spans_to_turns(self):
        """Assign session-level spans to turns at the end"""
        if not (hasattr(self, '_session_data') and self._session_data):
            logger.warning("No session data for span assignment")
            return
            
        telemetry_instance = self._session_data.get('telemetry_instance')
        if not (telemetry_instance and hasattr(telemetry_instance, 'spans_data')):
            logger.warning("No telemetry instance found for span assignment")
            return
        
        all_spans = telemetry_instance.spans_data
        
        # Track assigned spans to avoid duplicates
        assigned_span_ids = set()
        
        for turn in self.turns:
            # Skip turns that already have spans
            if turn.otel_spans and len(turn.otel_spans) > 0:
                for span in turn.otel_spans:
                    assigned_span_ids.add(span.get('span_id', ''))
                continue
            
            turn_spans = []
            
            # Collect all request_ids for this turn
            turn_request_ids = {}
            if turn.stt_metrics and turn.stt_metrics.get('request_id'):
                turn_request_ids['stt'] = turn.stt_metrics['request_id']
            if turn.llm_metrics and turn.llm_metrics.get('request_id'):
                turn_request_ids['llm'] = turn.llm_metrics['request_id']
            if turn.tts_metrics and turn.tts_metrics.get('request_id'):
                turn_request_ids['tts'] = turn.tts_metrics['request_id']
            
            
            # Strategy 1: Match by exact request_id
            for span in all_spans:
                span_id = span.get('context', {}).get('span_id', '') or span.get('span_id', '')
                if span_id in assigned_span_ids:
                    continue
                    
                span_request_id = span.get('request_id')
                span_name = span.get('name', '')
                span_op_type = self._categorize_span_operation(span_name)
                
                # Check if this span's request_id matches any of the turn's request_ids
                for turn_op_type, turn_request_id in turn_request_ids.items():
                    if span_request_id == turn_request_id and span_op_type == turn_op_type:
                        clean_span = self._create_clean_span_data(span, turn_request_id)
                        turn_spans.append(clean_span)
                        assigned_span_ids.add(span_id)
                        break
            
            # Strategy 2: If no exact matches, try partial matching
            if not turn_spans:
                for span in all_spans:
                    span_id = span.get('context', {}).get('span_id', '') or span.get('span_id', '')
                    if span_id in assigned_span_ids:
                        continue
                        
                    span_request_id = span.get('request_id')
                    if not span_request_id:
                        continue
                    
                    # Check partial matches (last 8 chars)
                    for turn_op_type, turn_request_id in turn_request_ids.items():
                        if (len(turn_request_id) >= 8 and len(span_request_id) >= 8 and
                            turn_request_id[-8:] == span_request_id[-8:]):
                            clean_span = self._create_clean_span_data(span, turn_request_id)
                            turn_spans.append(clean_span)
                            assigned_span_ids.add(span_id)
                            break
            
            # Strategy 3: Time-based fallback
            if not turn_spans:
                turn_time = turn.timestamp
                time_window = 20.0  # 20 second window
                
                candidates = []
                for span in all_spans:
                    span_id = span.get('context', {}).get('span_id', '') or span.get('span_id', '')
                    if span_id in assigned_span_ids:
                        continue
                        
                    span_time = span.get('captured_at', 0)
                    if span_time and abs(span_time - turn_time) < time_window:
                        candidates.append((abs(span_time - turn_time), span))
                
                # Sort by time distance and take closest 3
                candidates.sort(key=lambda x: x[0])
                for _, span in candidates[:3]:
                    span_id = span.get('context', {}).get('span_id', '') or span.get('span_id', '')
                    clean_span = self._create_clean_span_data(span, None)
                    turn_spans.append(clean_span)
                    assigned_span_ids.add(span_id)
            
            # Assign spans to turn
            if turn_spans:
                turn.otel_spans.extend(turn_spans)
            else:
                logger.warning(f"NO SPANS assigned to turn {turn.turn_id}")



    def finalize_session(self):
        """Enhanced finalization with comprehensive span assignment"""
        
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
        
        # CRITICAL: Get telemetry instance BEFORE session cleanup
        telemetry_instance = None
        if hasattr(self, '_session_data') and self._session_data:
            telemetry_instance = self._session_data.get('telemetry_instance')
        
        # Assign spans if we have telemetry data
        if telemetry_instance and hasattr(telemetry_instance, 'spans_data'):
            self._assign_session_spans_to_turns_direct(telemetry_instance)
        else:
            logger.error("Cannot assign spans - no telemetry instance available")
        
        # Apply remaining pending metrics
        if self.pending_metrics['tts'] and self.turns:
            for turn in reversed(self.turns):
                if turn.agent_response and not turn.tts_metrics:
                    turn.tts_metrics = self.pending_metrics['tts']
                    break
                    
        if self.pending_metrics['stt'] and self.turns:
            for turn in reversed(self.turns):
                if turn.user_transcript and not turn.stt_metrics:
                    turn.stt_metrics = self.pending_metrics['stt']
                    break
        
        if self.pending_metrics['llm'] and self.turns:
            for turn in reversed(self.turns):
                if turn.agent_response and not turn.llm_metrics:
                    turn.llm_metrics = self.pending_metrics['llm']
                    break
        
        if self.pending_metrics['eou'] and self.turns:
            for turn in reversed(self.turns):
                if turn.user_transcript and not turn.eou_metrics:
                    turn.eou_metrics = self.pending_metrics['eou']
                    break
        
        # Finalize trace data for each turn
        for turn in self.turns:
            self._finalize_trace_data(turn)
        

    def _assign_session_spans_to_turns_direct(self, telemetry_instance):
        """Direct span assignment with telemetry instance passed in"""
        all_spans = telemetry_instance.spans_data
        
        # Filter spans to only those with real request_ids
        real_spans = [span for span in all_spans if span.get('request_id_source') in ['nested_json', 'direct_attribute']]
        
        assigned_count = 0
        
        for turn in self.turns:
            # Get turn's request_ids
            turn_request_ids = {}
            if turn.stt_metrics and turn.stt_metrics.get('request_id'):
                turn_request_ids['stt'] = turn.stt_metrics['request_id']
            if turn.llm_metrics and turn.llm_metrics.get('request_id'):
                turn_request_ids['llm'] = turn.llm_metrics['request_id']
            if turn.tts_metrics and turn.tts_metrics.get('request_id'):
                turn_request_ids['tts'] = turn.tts_metrics['request_id']
            
            
            # Find exact matches in real spans
            matched_spans = []
            for span in real_spans:
                span_request_id = span.get('request_id')
                span_name = span.get('name', '')
                
                
                # Check if this span's request_id matches any turn request_id
                for turn_type, turn_request_id in turn_request_ids.items():
                    
                    if span_request_id == turn_request_id:
                        
                        # Check span type matches turn type
                        type_match = False
                        if turn_type == 'llm' and 'llm_request' in span_name:
                            type_match = True
                        elif turn_type == 'tts' and 'tts_request' in span_name:
                            type_match = True
                        elif turn_type == 'stt' and 'stt_request' in span_name:
                            type_match = True
                        
                        
                        if type_match:
                            clean_span = self._create_clean_span_data(span, span_request_id)
                            matched_spans.append(clean_span)
                            assigned_count += 1
                            break
                        else:
                            logger.info(f"Type mismatch, skipped")
            
            if matched_spans:
                turn.otel_spans.extend(matched_spans)
            else:
                logger.info(f"  NO SPANS matched for {turn.turn_id}")
        
        logger.info(f"ASSIGNMENT COMPLETE: {assigned_count} primary spans assigned")

    




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
        
        # NEW: Store telemetry instance reference immediately
        if session_data:
            telemetry_instance = session_data.get('telemetry_instance')
            if telemetry_instance:
                self._stored_telemetry_instance = telemetry_instance
                logger.info(f"Stored telemetry instance reference with {len(getattr(telemetry_instance, 'spans_data', []))} spans")
            else:
                logger.warning("No telemetry instance found in session data")



    def _finalize_trace_data(self, turn: ConversationTurn):
        """Calculate trace duration and cost for a completed turn"""
        if not turn.otel_spans:
            return

        start_times_ns = []
        end_times_ns = []
            
        for span in turn.otel_spans:
            start_ns = span.get('start_time_ns', 0) or span.get('start_time', 0)
            end_ns = span.get('end_time_ns', 0) or span.get('end_time', 0)
                
            if start_ns and end_ns:
                start_times_ns.append(start_ns)
                end_times_ns.append(end_ns)
            elif start_ns and span.get('duration_ms', 0):
                # Fallback: calculate end time from start + duration
                duration_ns = span.get('duration_ms', 0) * 1_000_000  # Convert ms to ns
                start_times_ns.append(start_ns)
                end_times_ns.append(start_ns + duration_ns)
            
        if start_times_ns and end_times_ns:
            # Convert to seconds and calculate duration
            earliest_start = min(start_times_ns) / 1_000_000_000
            latest_end = max(end_times_ns) / 1_000_000_000
            duration_seconds = latest_end - earliest_start
            
            # Sanity check - reject durations over 1 hour
            if duration_seconds > 3600:
                logger.warning(f"Abnormally long trace duration: {duration_seconds:.3f}s, capping to 60s")
                duration_seconds = 60.0
            
            # Store as seconds with 3 decimal places (millisecond precision)
            turn.trace_duration_s = round(duration_seconds, 3)
            logger.info(f"Trace duration: {turn.trace_duration_s}s for turn {turn.turn_id}")
        
        # Use pre-calculated costs from metrics instead of dynamic pricing
        total_cost = 0.0
        
        if turn.llm_metrics and 'calculated_cost' in turn.llm_metrics:
            total_cost += turn.llm_metrics['calculated_cost']
        
        if turn.tts_metrics and 'calculated_cost' in turn.tts_metrics:
            total_cost += turn.tts_metrics['calculated_cost']
        
        if turn.stt_metrics and 'calculated_cost' in turn.stt_metrics:
            total_cost += turn.stt_metrics['calculated_cost']
        
        turn.trace_cost_usd = round(total_cost, 6)


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

    @session.on("function_tools_executed")
    def on_function_tools_executed(event):
        """LiveKit's official event for when function tools are executed"""
        
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
                
                if output_details['error']:
                    logger.error(f"   💥 Error: {output_details['error']}")
    
    @session.on("metrics_collected")
    def on_metrics_collected(ev: MetricsCollectedEvent):
        usage_collector.collect(ev.metrics)
        metrics.log_metrics(ev.metrics)
        transcript_collector.on_metrics_collected(ev)



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
    session_data['telemetry_instance'] = telemetry_instance
    
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