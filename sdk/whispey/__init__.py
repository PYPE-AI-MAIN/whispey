"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "1.0.0"
__author__ = "Whispey AI Voice Analytics"

from .whispey import observe_session, send_session_to_whispey

# Professional wrapper class
class LivekitObserve:
    def __init__(self, agent_id="whispey-agent"):
        self.agent_id = agent_id
    
    def start_session(self, session,**kwargs):
        return observe_session(session,self.agent_id,**kwargs)
    
    async def export(self, session_id, recording_url=""):
        return await send_session_to_whispey(session_id, recording_url)