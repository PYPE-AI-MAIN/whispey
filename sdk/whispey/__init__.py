"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "2.1.0"
__author__ = "Whispey AI Voice Analytics"

import re
import logging
from typing import List, Optional
from .whispey import observe_session, send_session_to_whispey

logger = logging.getLogger("whispey-sdk")

# Professional wrapper class
class LivekitObserve:
    def __init__(self, agent_id="whispey-agent", apikey=None, host_url=None, enable_bug_reports=True):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
        self.enable_bug_reports = enable_bug_reports
        
        # Default bug report configuration
        self.bug_report_patterns = [
            r'\bbug\s+report\b', 
            r'\breport\s+bug\b', 
            r'\bissue\s+report\b',
            r'\breport\s+issue\b',
            r'\bfound\s+a\s+bug\b'
        ]
        self.bug_report_response = "Thanks for reporting that. How can I help you?"
    
    def configure_bug_reports(self, patterns: List[str] = None, response: str = None, enabled: bool = None):
        """Configure bug report patterns and response
        
        Args:
            patterns: List of regex patterns to detect bug reports
            response: Response message when bug report is detected
            enabled: Enable/disable bug report detection
        """
        if patterns is not None:
            self.bug_report_patterns = patterns
        if response is not None:
            self.bug_report_response = response
        if enabled is not None:
            self.enable_bug_reports = enabled
    
    def _is_bug_report(self, text: str) -> bool:
        """Check if user input is a bug report"""
        if not self.enable_bug_reports or not text:
            return False
        return any(re.search(pattern, text.lower()) for pattern in self.bug_report_patterns)
    
    def start_session(self, session, **kwargs):
        """Start session with optional bug report functionality"""
        bug_detector = self if self.enable_bug_reports else None
        session_id = observe_session(session, self.agent_id, self.host_url, bug_detector=bug_detector, **kwargs)
        
        # If bug reports enabled, wrap the session with bug report handling
        if self.enable_bug_reports:
            self._setup_bug_report_handling(session, session_id)
        
        return session_id
    
    def _setup_bug_report_handling(self, session, session_id):
        """Setup bug report handling on the session"""
        
        # Hook into when agent is set
        original_start = session.start
        
        async def wrapped_start(*args, **kwargs):
            # Extract agent from args/kwargs
            agent = kwargs.get('agent') or (args[0] if args else None)
            
            if agent:
                # Wrap agent's on_user_turn_completed method
                original_method = getattr(agent, 'on_user_turn_completed', None)
                
                async def bug_aware_on_user_turn_completed(turn_ctx, new_message):
                    """Enhanced on_user_turn_completed with bug report detection"""
                    
                    # Check for bug report
                    if self._is_bug_report(new_message.text_content):
                        logger.info(f"🐛 Bug report intercepted by Whispey SDK: {new_message.text_content}")
                        
                        # Acknowledge bug report
                        await session.say(self.bug_report_response)
                        
                        # Stop this message from going to LLM
                        try:
                            from livekit.agents.voice import StopResponse
                            raise StopResponse()
                        except ImportError:
                            # Fallback if StopResponse not available
                            logger.warning("StopResponse not available, bug report may reach LLM")
                            return
                    
                    # Call original method if it exists
                    if original_method:
                        await original_method(turn_ctx, new_message)
                    # If no original method, the default Agent behavior will continue
                
                # Replace the method on the agent instance
                agent.on_user_turn_completed = bug_aware_on_user_turn_completed
                
                logger.info(f"✅ Bug report handling enabled for session {session_id}")
            
            # Call original start method
            return await original_start(*args, **kwargs)
        
        # Replace session.start method
        session.start = wrapped_start
    
    async def export(self, session_id, recording_url="", save_telemetry_json=False):
        """Export session data to Whispey with optional telemetry save"""
        return await send_session_to_whispey(
            session_id, 
            recording_url, 
            apikey=self.apikey, 
            api_url=self.host_url
        )

# Backwards compatibility - keep original functions available
__all__ = ['LivekitObserve', 'observe_session', 'send_session_to_whispey']