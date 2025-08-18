"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "2.1.0"
__author__ = "Whispey AI Voice Analytics"

from .whispey import observe_session, send_session_to_whispey

# Professional wrapper class
class LivekitObserve:
    def __init__(self, agent_id="whispey-agent", apikey=None, host_url=None):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
    
    def start_session(self, session, **kwargs):
        return observe_session(session, self.agent_id, self.host_url, **kwargs)
    
    async def export(self, session_id, recording_url=""):
        return await send_session_to_whispey(session_id, recording_url, apikey=self.apikey, api_url=self.host_url)
    

     