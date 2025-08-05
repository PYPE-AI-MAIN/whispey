import time
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.agents.metrics import STTMetrics, LLMMetrics, TTSMetrics, EOUMetrics


logger = logging.getLogger("kannada-tutor")

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
    agent_turn_complete: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'turn_id': self.turn_id,
            'user_transcript': self.user_transcript,
            'agent_response': self.agent_response,
            'stt_metrics': self.stt_metrics,
            'llm_metrics': self.llm_metrics,
            'tts_metrics': self.tts_metrics,
            'eou_metrics': self.eou_metrics,
            'timestamp': self.timestamp
        }

class CorrectedTranscriptCollector:
    """Corrected collector that properly maps STT→user, TTS→agent"""
    
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
        
    def on_conversation_item_added(self, event):
        """Called when conversation item is added to history"""
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
                self.current_turn.stt_metrics = self.pending_metrics['stt']
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
                self.current_turn.llm_metrics = self.pending_metrics['llm']
                self.pending_metrics['llm'] = None
                logger.info(f"🧠 Applied pending LLM metrics to turn {self.current_turn.turn_id}")
            
            # Apply pending TTS metrics (TTS metrics come AFTER agent response)
            if self.pending_metrics['tts']:
                self.current_turn.tts_metrics = self.pending_metrics['tts']
                self.pending_metrics['tts'] = None
                logger.info(f"🗣️ Applied pending TTS metrics to turn {self.current_turn.turn_id}")
            
            logger.info(f"🤖 Agent response for turn {self.current_turn.turn_id}: {event.item.text_content[:50]}...")
            
            # Turn is complete, add to turns list
            self.turns.append(self.current_turn)
            logger.info(f"✅ Completed turn {self.current_turn.turn_id}")
            self.current_turn = None
    
    def on_metrics_collected(self, metrics_event):
        """Called when metrics are collected - maps metrics intelligently"""
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
                self.current_turn.stt_metrics = stt_data
                logger.info(f"📊 Applied STT metrics to current turn {self.current_turn.turn_id}")
            
            # Try to apply to last turn if it has user input but no STT
            elif self.turns and self.turns[-1].user_transcript and not self.turns[-1].stt_metrics:
                self.turns[-1].stt_metrics = stt_data
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
                self.current_turn.llm_metrics = llm_data
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
                self.current_turn.tts_metrics = tts_data
                logger.info(f"🗣️ Applied TTS metrics to current turn {self.current_turn.turn_id}")
            
            # Try to apply to last turn if it has agent response but no TTS
            elif self.turns and self.turns[-1].agent_response and not self.turns[-1].tts_metrics:
                self.turns[-1].tts_metrics = tts_data
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
    
    def finalize_session(self):
        """Apply any remaining pending metrics"""
        if self.current_turn:
            self.turns.append(self.current_turn)
            self.current_turn = None
            
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
        """Get the array of conversation turns with transcripts and metrics"""
        self.finalize_session()
        return [turn.to_dict() for turn in self.turns]
    
    def get_formatted_transcript(self) -> str:
        """Get formatted transcript"""
        self.finalize_session()
        lines = []
        lines.append("=" * 80)
        lines.append("CONVERSATION TRANSCRIPT (CORRECTED MAPPING)")
        lines.append("=" * 80)
        
        for i, turn in enumerate(self.turns, 1):
            lines.append(f"\n🔄 TURN {i} (ID: {turn.turn_id})")
            lines.append("-" * 40)
            
            if turn.user_transcript:
                lines.append(f"👤 USER: {turn.user_transcript}")
                if turn.stt_metrics:
                    lines.append(f"   📊 STT: {turn.stt_metrics['audio_duration']:.2f}s audio ✅")
                else:
                    lines.append(f"   📊 STT: MISSING ❌")
                    
                if turn.eou_metrics:
                    lines.append(f"   ⏱️ EOU: {turn.eou_metrics['end_of_utterance_delay']:.2f}s delay")
            else:
                lines.append("👤 USER: [No user input]")
            
            if turn.agent_response:
                lines.append(f"🤖 AGENT: {turn.agent_response}")
                if turn.llm_metrics:
                    lines.append(f"   🧠 LLM: {turn.llm_metrics['prompt_tokens']}+{turn.llm_metrics['completion_tokens']} tokens, TTFT: {turn.llm_metrics['ttft']:.2f}s ✅")
                else:
                    lines.append(f"   🧠 LLM: MISSING ❌")
                    
                if turn.tts_metrics:
                    lines.append(f"   🗣️ TTS: {turn.tts_metrics['characters_count']} chars, {turn.tts_metrics['audio_duration']:.2f}s ✅")
                else:
                    lines.append(f"   🗣️ TTS: MISSING ❌")
        
        return "\n".join(lines)

def setup_session_event_handlers(session, session_data, usage_collector, userdata):
    """Setup all session event handlers WITH CORRECTED transcript collector"""
    
    # 🚀 CREATE CORRECTED TRANSCRIPT COLLECTOR
    transcript_collector = CorrectedTranscriptCollector()
    
    # 🔧 STORE IT IN SESSION_DATA SO YOU CAN ACCESS IT LATER
    session_data["transcript_collector"] = transcript_collector
    
    @session.on("metrics_collected")
    def on_metrics_collected(ev: MetricsCollectedEvent):
        # Your existing metrics handling
        usage_collector.collect(ev.metrics)
        metrics.log_metrics(ev.metrics)
        
        # 🎯 ADD CORRECTED TRANSCRIPT MAPPING
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
        
        # 🎯 ADD CORRECTED TRANSCRIPT MAPPING
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
            
            # ✅ FIXED: Better handoff detection
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
        
        # Check if lesson was completed
        if userdata and userdata.current_lesson_step == "lesson_completed":
            session_data["lesson_completed"] = True
            
        logger.info(f"📊 Session ended - Success: {session_data['call_success']}, Lesson completed: {session_data['lesson_completed']}")

# 🎯 HELPER FUNCTIONS
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