import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.agents.metrics import STTMetrics, LLMMetrics, TTSMetrics, EOUMetrics
from opentelemetry import trace

logger = logging.getLogger("kannada-tutor")

# === NEW: Model Information Tracker ===
class ModelInfoTracker:
    """Simple tracker to add model information to existing metrics"""
    
    def __init__(self):
        # Based on your doctor agent logs - these are the models you're likely using
        self.model_mapping = {
            'gpt-4o-mini': {
                'provider': 'OpenAI',
                'type': 'LLM',
                'cost_per_1k_input': 0.00015,
                'cost_per_1k_output': 0.0006
            },
            'deepgram-nova-2': {
                'provider': 'Deepgram', 
                'type': 'STT',
                'cost_per_minute': 0.0043
            },
            'elevenlabs-turbo-v2': {
                'provider': 'ElevenLabs',
                'type': 'TTS', 
                'cost_per_1k_chars': 0.18
            }
        }
    
    def enrich_llm_metrics(self, llm_metrics: LLMMetrics, model_hint: str = "gpt-4o-mini") -> Dict[str, Any]:
        """Add model info to your existing LLM metrics"""
        model_info = self.model_mapping.get(model_hint, {'provider': 'Unknown', 'type': 'LLM'})
        
        # Calculate cost
        input_cost = (llm_metrics.prompt_tokens / 1000) * model_info.get('cost_per_1k_input', 0)
        output_cost = (llm_metrics.completion_tokens / 1000) * model_info.get('cost_per_1k_output', 0)
        total_cost = input_cost + output_cost
        
        return {
            # Your existing metrics (unchanged)
            'prompt_tokens': llm_metrics.prompt_tokens,
            'completion_tokens': llm_metrics.completion_tokens,
            'ttft': llm_metrics.ttft,
            'tokens_per_second': llm_metrics.tokens_per_second,
            'timestamp': llm_metrics.timestamp,
            'request_id': llm_metrics.request_id,
            
            # NEW: Model information
            'model_name': model_hint,
            'model_provider': model_info['provider'],
            'model_type': model_info['type'],
            
            # NEW: Cost tracking
            'cost_analysis': {
                'input_cost': input_cost,
                'output_cost': output_cost, 
                'total_cost': total_cost,
                'total_tokens': llm_metrics.prompt_tokens + llm_metrics.completion_tokens
            },
            
            # NEW: Performance analysis
            'performance_quality': 'excellent' if llm_metrics.ttft < 0.5 else 'good' if llm_metrics.ttft < 1.0 else 'slow'
        }
    
    def enrich_stt_metrics(self, stt_metrics: STTMetrics, model_hint: str = "deepgram-nova-2") -> Dict[str, Any]:
        """Add model info to your existing STT metrics"""
        model_info = self.model_mapping.get(model_hint, {'provider': 'Unknown', 'type': 'STT'})
        
        # Calculate cost (STT usually charged per minute)
        cost = (stt_metrics.audio_duration / 60) * model_info.get('cost_per_minute', 0)
        
        # Calculate real-time factor
        rtf = stt_metrics.duration / stt_metrics.audio_duration if stt_metrics.audio_duration > 0 else 0
        
        return {
            # Your existing metrics (unchanged) 
            'audio_duration': stt_metrics.audio_duration,
            'duration': stt_metrics.duration,
            'timestamp': stt_metrics.timestamp,
            'request_id': stt_metrics.request_id,
            
            # NEW: Model information
            'model_name': model_hint,
            'model_provider': model_info['provider'],
            'model_type': model_info['type'],
            
            # NEW: Cost tracking
            'cost_analysis': {
                'total_cost': cost,
                'cost_per_minute': model_info.get('cost_per_minute', 0),
                'audio_minutes': stt_metrics.audio_duration / 60
            },
            
            # NEW: Performance analysis
            'real_time_factor': rtf,
            'processing_efficiency': 'excellent' if rtf < 0.1 else 'good' if rtf < 0.3 else 'slow'
        }
    
    def enrich_tts_metrics(self, tts_metrics: TTSMetrics, model_hint: str = "elevenlabs-turbo-v2") -> Dict[str, Any]:
        """Add model info to your existing TTS metrics"""
        model_info = self.model_mapping.get(model_hint, {'provider': 'Unknown', 'type': 'TTS'})
        
        # Calculate cost (TTS usually charged per character)
        cost = (tts_metrics.characters_count / 1000) * model_info.get('cost_per_1k_chars', 0)
        
        # Calculate speaking rate
        words_estimate = tts_metrics.characters_count / 5  # Rough estimate: 5 chars per word
        wpm = (words_estimate / tts_metrics.audio_duration) * 60 if tts_metrics.audio_duration > 0 else 0
        
        return {
            # Your existing metrics (unchanged)
            'characters_count': tts_metrics.characters_count,
            'audio_duration': tts_metrics.audio_duration, 
            'ttfb': tts_metrics.ttfb,
            'timestamp': tts_metrics.timestamp,
            'request_id': tts_metrics.request_id,
            
            # NEW: Model information
            'model_name': model_hint,
            'model_provider': model_info['provider'],
            'model_type': model_info['type'],
            
            # NEW: Cost tracking
            'cost_analysis': {
                'total_cost': cost,
                'cost_per_1k_chars': model_info.get('cost_per_1k_chars', 0),
                'total_characters': tts_metrics.characters_count
            },
            
            # NEW: Speech analysis
            'speech_analysis': {
                'estimated_words_per_minute': wpm,
                'speaking_rate_quality': 'natural' if 140 <= wpm <= 180 else 'fast' if wpm > 180 else 'slow'
            }
        }

# === NEW: Simple Tool Call Tracking ===
@dataclass
class SimpleToolCall:
    """Simple tool call tracking"""
    tool_name: str
    call_id: str
    arguments: Dict[str, Any] = field(default_factory=dict)
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: float = 0.0
    success: bool = True
    error_message: str = ""
    response_size: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'tool_name': self.tool_name,
            'call_id': self.call_id,
            'arguments_count': len(self.arguments),
            'duration_ms': self.duration_ms,
            'success': self.success,
            'error_message': self.error_message,
            'response_size': self.response_size,
            'performance_rating': 'fast' if self.duration_ms < 1000 else 'slow'
        }

class AutoToolTracker:
    """Automatic tool call tracker that extracts from telemetry spans"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.detected_tools: List[SimpleToolCall] = []
    
    def extract_tool_calls_from_telemetry(self, telemetry_spans: List[Dict]) -> List[SimpleToolCall]:
        """Extract tool calls automatically from telemetry spans"""
        extracted_tools = []
        
        for span in telemetry_spans:
            span_name = span.get("name", "")
            attributes = span.get("attributes", {})
            
            # Check if this is a function_tool span
            if span_name == "function_tool" or "lk.function_tool.name" in attributes:
                tool_name = attributes.get("lk.function_tool.name", "unknown_tool")
                
                # Parse arguments
                arguments = {}
                try:
                    args_str = attributes.get("lk.function_tool.arguments", "{}")
                    arguments = json.loads(args_str) if args_str else {}
                except:
                    arguments = {"raw_arguments": args_str}
                
                # Calculate duration
                duration_ms = span.get("duration_ms", 0) or 0
                
                # Check success
                is_error = attributes.get("lk.function_tool.is_error", False)
                success = not is_error
                
                # Get response
                response_data = attributes.get("lk.function_tool.output", "")
                
                # Create tool call record
                tool_call = SimpleToolCall(
                    tool_name=tool_name,
                    call_id=span.get("span_id", "unknown"),
                    arguments=arguments,
                    start_time=span.get("start_time", 0) / 1_000_000_000 if span.get("start_time") else 0,  # Convert nanoseconds
                    end_time=span.get("end_time", 0) / 1_000_000_000 if span.get("end_time") else 0,
                    duration_ms=duration_ms,
                    success=success,
                    error_message=attributes.get("error.message", "") if not success else "",
                    response_size=len(str(response_data)) if response_data else 0
                )
                
                extracted_tools.append(tool_call)
                logger.info(f"🔧 Auto-detected tool: {tool_name} ({duration_ms:.0f}ms, Success: {success})")
        
        self.detected_tools = extracted_tools
        return extracted_tools
    
    def get_tools_for_turn(self, turn_timestamp: float, window_seconds: float = 30.0) -> List[SimpleToolCall]:
        """Get tool calls that happened during a conversation turn"""
        turn_tools = []
        
        for tool in self.detected_tools:
            # Check if tool call happened within the turn window
            if abs(tool.start_time - turn_timestamp) <= window_seconds:
                turn_tools.append(tool)
        
        return turn_tools
    
    def get_session_tool_summary(self) -> Dict[str, Any]:
        """Get summary of all detected tool usage"""
        if not self.detected_tools:
            return {"total_tools": 0}
        
        total_calls = len(self.detected_tools)
        successful_calls = sum(1 for tool in self.detected_tools if tool.success)
        avg_duration = sum(tool.duration_ms for tool in self.detected_tools) / total_calls
        
        # Group by tool name
        by_tool = {}
        for tool in self.detected_tools:
            if tool.tool_name not in by_tool:
                by_tool[tool.tool_name] = {"count": 0, "success": 0, "avg_duration": 0}
            
            by_tool[tool.tool_name]["count"] += 1
            if tool.success:
                by_tool[tool.tool_name]["success"] += 1
        
        # Calculate averages
        for tool_name, stats in by_tool.items():
            tool_calls = [t for t in self.detected_tools if t.tool_name == tool_name]
            stats["avg_duration"] = sum(t.duration_ms for t in tool_calls) / len(tool_calls)
            stats["success_rate"] = stats["success"] / stats["count"]
        
        return {
            "total_tools": total_calls,
            "success_rate": successful_calls / total_calls,
            "avg_duration_ms": avg_duration,
            "tools_by_name": by_tool
        }

# === MODIFIED: Your existing ConversationTurn class ===
@dataclass
class ConversationTurn:
    """Your existing ConversationTurn with MINIMAL additions"""
    turn_id: str
    user_transcript: str = ""
    agent_response: str = ""
    stt_metrics: Optional[Dict[str, Any]] = None
    llm_metrics: Optional[Dict[str, Any]] = None
    tts_metrics: Optional[Dict[str, Any]] = None
    eou_metrics: Optional[Dict[str, Any]] = None
    timestamp: float = field(default_factory=time.time)
    user_turn_complete: bool = False
    agent_turn_complete: bool = False
    
    # NEW: Just adding these fields
    tool_calls: List[SimpleToolCall] = field(default_factory=list)
    model_info: Optional[Dict[str, Any]] = None
    cost_info: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        base_dict = {
            'turn_id': self.turn_id,
            'user_transcript': self.user_transcript,
            'agent_response': self.agent_response,
            'stt_metrics': self.stt_metrics,
            'llm_metrics': self.llm_metrics,
            'tts_metrics': self.tts_metrics,
            'eou_metrics': self.eou_metrics,
            'timestamp': self.timestamp,
            
            # NEW: Tool call information
            'tool_calls': [tool.to_dict() for tool in self.tool_calls],
            'tool_call_count': len(self.tool_calls),
            'tool_success_rate': sum(1 for t in self.tool_calls if t.success) / len(self.tool_calls) if self.tool_calls else 1.0
        }
        
        # NEW: Add model and cost info if available
        if self.model_info:
            base_dict['model_information'] = self.model_info
        if self.cost_info:
            base_dict['cost_breakdown'] = self.cost_info
            
        return base_dict

class CorrectedTranscriptCollector:
    """Your existing collector with enhancements"""
    
    def __init__(self):
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
        
        # NEW: Add auto tool tracker (extracts from telemetry automatically)
        self.auto_tool_tracker = AutoToolTracker(f"session_{int(time.time())}")
        self.model_tracker = ModelInfoTracker() 
        
    def on_conversation_item_added(self, event):
        """Enhanced version of your existing method"""
        logger.info(f"🔍 CONVERSATION: {event.item.role} - {event.item.text_content[:50]}...")
        
        if event.item.role == "user":
            # User input - start new turn or update existing
            if not self.current_turn:
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
            
            self.current_turn.user_transcript = event.item.text_content
            self.current_turn.user_turn_complete = True
            
            # Apply pending STT metrics (STT metrics come AFTER user transcript)
            if self.pending_metrics['stt']:
                # NEW: Enrich the STT metrics before storing
                enriched_stt = self.model_tracker.enrich_stt_metrics(
                    type('STTMetrics', (), self.pending_metrics['stt'])()
                )
                self.current_turn.stt_metrics = enriched_stt
                self.pending_metrics['stt'] = None
                logger.info(f"📊 Applied pending STT metrics to turn {self.current_turn.turn_id}")
            
            # Apply pending EOU metrics
            if self.pending_metrics['eou']:
                self.current_turn.eou_metrics = self.pending_metrics['eou']
                self.pending_metrics['eou'] = None
                logger.info(f"⏱️ Applied pending EOU metrics to turn {self.current_turn.turn_id}")
                
            logger.info(f"👤 User input for turn {self.current_turn.turn_id}: {event.item.text_content[:50]}...")
            
        elif event.item.role == "assistant":
            # Agent response - complete the turn
            if not self.current_turn:
                # Agent speaks without user input (like greetings)
                self.turn_counter += 1
                self.current_turn = ConversationTurn(
                    turn_id=f"turn_{self.turn_counter}",
                    timestamp=time.time()
                )
            
            self.current_turn.agent_response = event.item.text_content
            self.current_turn.agent_turn_complete = True
            
            # Apply pending LLM metrics
            if self.pending_metrics['llm']:
                # NEW: Enrich the LLM metrics before storing
                enriched_llm = self.model_tracker.enrich_llm_metrics(
                    type('LLMMetrics', (), self.pending_metrics['llm'])()
                )
                self.current_turn.llm_metrics = enriched_llm
                self.pending_metrics['llm'] = None
                logger.info(f"🧠 Applied pending LLM metrics to turn {self.current_turn.turn_id}")
            
            # Apply pending TTS metrics
            if self.pending_metrics['tts']:
                # NEW: Enrich the TTS metrics before storing
                enriched_tts = self.model_tracker.enrich_tts_metrics(
                    type('TTSMetrics', (), self.pending_metrics['tts'])()
                )
                self.current_turn.tts_metrics = enriched_tts
                self.pending_metrics['tts'] = None
                logger.info(f"🗣️ Applied pending TTS metrics to turn {self.current_turn.turn_id}")
            
            # NEW: Auto-detect tool calls from telemetry (NO CODE CHANGES NEEDED IN AGENT)
            # This will be populated when we get telemetry data at session end
            self.current_turn.tool_calls = []  # Will be filled from telemetry later
            
            if hasattr(self, 'auto_tool_tracker'):
                # Try to get recent tool calls (this will be enhanced when we get telemetry)
                turn_tools = self.auto_tool_tracker.get_tools_for_turn(self.current_turn.timestamp)
                self.current_turn.tool_calls = turn_tools
                
                if turn_tools:
                    logger.info(f"🔧 Auto-detected {len(turn_tools)} tool calls for turn {self.current_turn.turn_id}")
            
            logger.info(f"🤖 Agent response for turn {self.current_turn.turn_id}: {event.item.text_content[:50]}...")
            
            # NEW: Calculate cost breakdown for this turn
            self._calculate_turn_costs()
            
            # Turn is complete, add to turns list
            self.turns.append(self.current_turn)
            logger.info(f"✅ Completed turn {self.current_turn.turn_id}")
            self.current_turn = None
    
    def on_metrics_collected(self, metrics_event):
        """Enhanced version of your existing method"""
        metrics_obj = metrics_event.metrics
        
        logger.info(f"📈 METRICS: {type(metrics_obj).__name__}")
        
        if isinstance(metrics_obj, STTMetrics):
            # STT metrics - belongs to user input
            stt_data = {
                'audio_duration': metrics_obj.audio_duration,
                'duration': metrics_obj.duration,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            # Try to apply to current turn first
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.stt_metrics:
                # NEW: Enrich before storing
                enriched_stt = self.model_tracker.enrich_stt_metrics(metrics_obj)
                self.current_turn.stt_metrics = enriched_stt
                logger.info(f"📊 Applied STT metrics to current turn {self.current_turn.turn_id}")
            
            # Try to apply to last turn if it has user input but no STT
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].stt_metrics:
                enriched_stt = self.model_tracker.enrich_stt_metrics(metrics_obj)
                self.turns[-1].stt_metrics = enriched_stt
                logger.info(f"📊 Applied STT metrics to last turn {self.turns[-1].turn_id}")
            
            # Otherwise store as pending
            else:
                self.pending_metrics['stt'] = stt_data
                logger.info("📊 Stored STT metrics as pending")
                
        elif isinstance(metrics_obj, LLMMetrics):
            # LLM metrics - belongs to agent processing
            llm_data = {
                'prompt_tokens': metrics_obj.prompt_tokens,
                'completion_tokens': metrics_obj.completion_tokens,
                'ttft': metrics_obj.ttft,
                'tokens_per_second': metrics_obj.tokens_per_second,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            # Apply to current turn or store as pending
            if self.current_turn and not self.current_turn.llm_metrics:
                # NEW: Enrich before storing
                enriched_llm = self.model_tracker.enrich_llm_metrics(metrics_obj)
                self.current_turn.llm_metrics = enriched_llm
                logger.info(f"🧠 Applied LLM metrics to current turn {self.current_turn.turn_id}")
            else:
                self.pending_metrics['llm'] = llm_data
                logger.info("🧠 Stored LLM metrics as pending")
                
        elif isinstance(metrics_obj, TTSMetrics):
            # TTS metrics - belongs to agent speech
            tts_data = {
                'characters_count': metrics_obj.characters_count,
                'audio_duration': metrics_obj.audio_duration,
                'ttfb': metrics_obj.ttfb,
                'timestamp': metrics_obj.timestamp,
                'request_id': metrics_obj.request_id
            }
            
            # Try to apply to current turn first
            if self.current_turn and self.current_turn.agent_response and not self.current_turn.tts_metrics:
                # NEW: Enrich before storing
                enriched_tts = self.model_tracker.enrich_tts_metrics(metrics_obj)
                self.current_turn.tts_metrics = enriched_tts
                logger.info(f"🗣️ Applied TTS metrics to current turn {self.current_turn.turn_id}")
            
            # Try to apply to last turn if it has agent response but no TTS
            elif self.turns and self.turns[-1].agent_response and not self.turns[-1].tts_metrics:
                enriched_tts = self.model_tracker.enrich_tts_metrics(metrics_obj)
                self.turns[-1].tts_metrics = enriched_tts
                logger.info(f"🗣️ Applied TTS metrics to last turn {self.turns[-1].turn_id}")
            
            # Otherwise store as pending
            else:
                self.pending_metrics['tts'] = tts_data
                logger.info("🗣️ Stored TTS metrics as pending")
                
        elif isinstance(metrics_obj, EOUMetrics):
            # EOU metrics - belongs to user turn
            eou_data = {
                'end_of_utterance_delay': metrics_obj.end_of_utterance_delay,
                'transcription_delay': metrics_obj.transcription_delay,
                'timestamp': metrics_obj.timestamp
            }
            
            # Apply to current turn or store as pending
            if self.current_turn and self.current_turn.user_transcript and not self.current_turn.eou_metrics:
                self.current_turn.eou_metrics = eou_data
                logger.info(f"⏱️ Applied EOU metrics to current turn {self.current_turn.turn_id}")
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].eou_metrics:
                self.turns[-1].eou_metrics = eou_data
                logger.info(f"⏱️ Applied EOU metrics to last turn {self.turns[-1].turn_id}")
            else:
                self.pending_metrics['eou'] = eou_data
                logger.info("⏱️ Stored EOU metrics as pending")
    
    # NEW: Calculate costs per turn
    def _calculate_turn_costs(self):
        """Calculate total cost for current turn"""
        if not self.current_turn:
            return
            
        total_cost = 0.0
        cost_breakdown = {}
        
        # STT cost
        if self.current_turn.stt_metrics and 'cost_analysis' in self.current_turn.stt_metrics:
            stt_cost = self.current_turn.stt_metrics['cost_analysis']['total_cost']
            total_cost += stt_cost
            cost_breakdown['stt'] = stt_cost
        
        # LLM cost  
        if self.current_turn.llm_metrics and 'cost_analysis' in self.current_turn.llm_metrics:
            llm_cost = self.current_turn.llm_metrics['cost_analysis']['total_cost']
            total_cost += llm_cost
            cost_breakdown['llm'] = llm_cost
        
        # TTS cost
        if self.current_turn.tts_metrics and 'cost_analysis' in self.current_turn.tts_metrics:
            tts_cost = self.current_turn.tts_metrics['cost_analysis']['total_cost']
            total_cost += tts_cost
            cost_breakdown['tts'] = tts_cost
        
        # NEW: Tool execution cost (time-based)
        if self.current_turn.tool_calls:
            tool_execution_time = sum(tool.duration_ms for tool in self.current_turn.tool_calls)
            cost_breakdown['tools'] = {
                'execution_time_ms': tool_execution_time,
                'tool_count': len(self.current_turn.tool_calls),
                'estimated_cost': 0.0  # You can add actual tool costs later
            }
        
        # Store cost info
        self.current_turn.cost_info = {
            'total_turn_cost': total_cost,
            'cost_breakdown': cost_breakdown,
            'cost_currency': 'USD'
        }
        
        logger.info(f"💰 Turn {self.current_turn.turn_id} cost: ${total_cost:.4f}")
    
    def extract_tools_from_telemetry(self, telemetry_spans: List[Dict]):
        """NEW: Extract tool calls from telemetry spans automatically"""
        if hasattr(self, 'auto_tool_tracker'):
            detected_tools = self.auto_tool_tracker.extract_tool_calls_from_telemetry(telemetry_spans)
            
            # Assign tools to appropriate turns
            for turn in self.turns:
                turn_tools = self.auto_tool_tracker.get_tools_for_turn(turn.timestamp)
                turn.tool_calls = turn_tools
                
                if turn_tools:
                    logger.info(f"🔧 Assigned {len(turn_tools)} tool calls to turn {turn.turn_id}")
    
    def finalize_session(self, telemetry_spans: List[Dict] = None):
        """Your existing method - unchanged"""
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
            
    def finalize_session(self, telemetry_spans: List[Dict] = None):
        """Enhanced finalize with automatic tool detection"""
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
        
        # NEW: Extract tool calls from telemetry spans if provided
        if telemetry_spans:
            self.extract_tools_from_telemetry(telemetry_spans)
            
        # Apply any remaining pending metrics to the last appropriate turn
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
    
    def get_turns_array(self) -> List[Dict[str, Any]]:
        """Your existing method - unchanged"""
        self.finalize_session()
        return [turn.to_dict() for turn in self.turns]
    
    def get_formatted_transcript(self) -> str:
        """Enhanced version of your existing method"""
        self.finalize_session()
        lines = []
        lines.append("=" * 80)
        lines.append("CONVERSATION TRANSCRIPT (ENHANCED WITH MODEL & TOOL INFO)")
        lines.append("=" * 80)
        
        for i, turn in enumerate(self.turns, 1):
            lines.append(f"\n🔄 TURN {i} (ID: {turn.turn_id})")
            lines.append("-" * 40)
            
            if turn.user_transcript:
                lines.append(f"👤 USER: {turn.user_transcript}")
                if turn.stt_metrics:
                    model_name = turn.stt_metrics.get('model_name', 'unknown')
                    duration = turn.stt_metrics.get('duration', 0)
                    rtf = turn.stt_metrics.get('real_time_factor', 0)
                    lines.append(f"   📊 STT ({model_name}): {duration:.2f}s processing, RTF: {rtf:.3f} ✅")
                else:
                    lines.append(f"   📊 STT: MISSING ❌")
                    
                if turn.eou_metrics:
                    lines.append(f"   ⏱️ EOU: {turn.eou_metrics['end_of_utterance_delay']:.2f}s delay")
            else:
                lines.append("👤 USER: [No user input]")
            
            if turn.agent_response:
                lines.append(f"🤖 AGENT: {turn.agent_response}")
                
                # NEW: Show tool calls first
                if turn.tool_calls:
                    lines.append(f"   🔧 TOOLS USED:")
                    for tool in turn.tool_calls:
                        status = "✅" if tool.success else "❌"
                        lines.append(f"      - {tool.tool_name}: {tool.duration_ms:.0f}ms {status}")
                
                if turn.llm_metrics:
                    model_name = turn.llm_metrics.get('model_name', 'unknown')
                    cost = turn.llm_metrics.get('cost_analysis', {}).get('total_cost', 0)
                    quality = turn.llm_metrics.get('performance_quality', 'unknown')
                    lines.append(f"   🧠 LLM ({model_name}): {turn.llm_metrics['prompt_tokens']}+{turn.llm_metrics['completion_tokens']} tokens, TTFT: {turn.llm_metrics['ttft']:.2f}s, Quality: {quality}, Cost: ${cost:.4f} ✅")
                else:
                    lines.append(f"   🧠 LLM: MISSING ❌")
                    
                if turn.tts_metrics:
                    model_name = turn.tts_metrics.get('model_name', 'unknown')
                    wpm = turn.tts_metrics.get('speech_analysis', {}).get('estimated_words_per_minute', 0)
                    lines.append(f"   🗣️ TTS ({model_name}): {turn.tts_metrics['characters_count']} chars, {turn.tts_metrics['audio_duration']:.2f}s, {wpm:.0f} WPM ✅")
                else:
                    lines.append(f"   🗣️ TTS: MISSING ❌")
                
                # NEW: Show turn total cost
                if turn.cost_info:
                    total_cost = turn.cost_info['total_turn_cost']
                    lines.append(f"   💰 TURN COST: ${total_cost:.4f}")
        
        # NEW: Add session summary
        lines.append("\n" + "=" * 80)
        lines.append("SESSION SUMMARY")
        lines.append("=" * 80)
        
        total_turns = len(self.turns)
        total_session_cost = sum(turn.cost_info['total_turn_cost'] for turn in self.turns if turn.cost_info)
        tool_summary = self.tool_tracker.get_session_tool_summary() if hasattr(self, 'tool_tracker') else {}
        
        lines.append(f"📊 Total Turns: {total_turns}")
        lines.append(f"💰 Total Session Cost: ${total_session_cost:.4f}")
        if tool_summary.get('total_tools', 0) > 0:
            lines.append(f"🔧 Total Tools Used: {tool_summary['total_tools']} (Success Rate: {tool_summary.get('success_rate', 0):.1%})")
        
        return "\n".join(lines)

# Your existing helper functions stay exactly the same
def setup_session_event_handlers(session, session_data, usage_collector, userdata):
    """Your existing function with enhanced collector"""
    
    # NEW: Use enhanced collector instead of original
    transcript_collector = CorrectedTranscriptCollector()
    
    # Store it in session_data (your existing pattern)
    session_data["transcript_collector"] = transcript_collector
    
    @session.on("metrics_collected")
    def on_metrics_collected(ev: MetricsCollectedEvent):
        # Your existing metrics handling
        usage_collector.collect(ev.metrics)
        metrics.log_metrics(ev.metrics)
        
        # NEW: Enhanced transcript mapping
        transcript_collector.on_metrics_collected(ev)
        
        if isinstance(ev.metrics, metrics.LLMMetrics):
            logger.info(f"🧠 LLM: {ev.metrics.prompt_tokens} prompt + {ev.metrics.completion_tokens} completion tokens, TTFT: {ev.metrics.ttft:.2f}s")
            
        elif isinstance(ev.metrics, metrics.TTSMetrics):
            logger.info(f"🗣️ TTS: {ev.metrics.characters_count} chars, Duration: {ev.metrics.audio_duration:.2f}s, TTFB: {ev.metrics.ttfb:.2f}s")
            
        elif isinstance(ev.metrics, metrics.STTMetrics):
            logger.info(f"🎙️ STT: {ev.metrics.audio_duration:.2f}s audio processed in {ev.metrics.duration:.2f}s")

    @session.on("conversation_item_added")
    def on_conversation_item_added(event):
        """Your existing conversation tracking"""
        
        # Enhanced transcript mapping
        transcript_collector.on_conversation_item_added(event)
        
        # Your existing conversation tracking
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
            
            # Your existing handoff detection
            if any(phrase in event.item.text_content for phrase in [
                "[Handing off to", "[Handing back to", "handoff_to_", "transfer_to_"
            ]):
                session_data["handoffs"] += 1
                logger.info(f"🔄 Handoff detected - Total: {session_data['handoffs']}")

    @session.on("close")
    def on_session_close(event):
        """Your existing session close handler - unchanged"""
        session_data["call_success"] = event.error is None
        if event.error:
            session_data["errors"].append(f"Session Error: {event.error}")
        
        # Check if lesson was completed
        if userdata and userdata.current_lesson_step == "lesson_completed":
            session_data["lesson_completed"] = True
            
        logger.info(f"📊 Session ended - Success: {session_data['call_success']}, Lesson completed: {session_data['lesson_completed']}")

# Your existing helper functions stay exactly the same
def get_session_transcript(session_data) -> Dict[str, Any]:
    """Your existing function - unchanged"""
    if "transcript_collector" in session_data:
        collector = session_data["transcript_collector"]
        return {
            "turns_array": collector.get_turns_array(),
            "formatted_transcript": collector.get_formatted_transcript(),
            "total_turns": len(collector.turns)
        }
    return {"turns_array": [], "formatted_transcript": "", "total_turns": 0}

def safe_extract_transcript_data(session_data, telemetry_spans=None):
    """Fixed function that accepts telemetry spans"""
    transcript_data = get_session_transcript(session_data)
    
    # NEW: Use telemetry spans for tool extraction if available
    if telemetry_spans and "transcript_collector" in session_data:
        collector = session_data["transcript_collector"]
        if hasattr(collector, 'extract_tools_from_telemetry'):
            collector.extract_tools_from_telemetry(telemetry_spans)
            
    # Remove the non-serializable collector object
    if "transcript_collector" in session_data:
        del session_data["transcript_collector"]
        logger.info("🔧 Removed transcript_collector from session_data")
    
    # Add extracted data to session_data
    session_data["transcript_with_metrics"] = transcript_data["turns_array"]
    session_data["formatted_transcript"] = transcript_data["formatted_transcript"]
    session_data["total_conversation_turns"] = transcript_data["total_turns"]
    
    logger.info(f"✅ Extracted {len(transcript_data['turns_array'])} conversation turns")
    
    return session_data

# Your existing imports and setup functions
def setup_usage_collector():
    """Your existing function - unchanged"""
    return metrics.UsageCollector()

def create_session_data(ctx, call_start_time):
    """Your existing function - unchanged"""
    return {
        "session_id": ctx.room.name,
        "start_time": call_start_time,
        "phone_number": None,
        "handoffs": 0,
        "fpo_name": None,
        "call_duration": 0,
        "call_success": False,
        "lesson_completed": False,
        "handoffs": 0,
        "lesson_day": 1,
        "errors": [],
        "user_messages": [],
        "agent_messages": []
    }