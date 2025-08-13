"""Whispey Observe SDK - Voice Analytics for AI Agents"""

__version__ = "1.0.0"
__author__ = "Whispey AI Voice Analytics"

from .whispey import observe_session, send_session_to_whispey, save_telemetry_to_json

# Professional wrapper class
class LivekitObserve:
    def __init__(self, agent_id="whispey-agent", apikey=None, host_url: str | None = None):
        self.agent_id = agent_id
        self.apikey = apikey
        self.host_url = host_url
    
    def start_session(self, session,**kwargs):
        return observe_session(session,self.agent_id,**kwargs)
    
    async def export(self, session_id, recording_url="", save_telemetry_json=True):
        # Save telemetry data to JSON first
        if save_telemetry_json:
            json_file = save_telemetry_to_json(session_id)
            if json_file:
                print(f"📊 Telemetry data saved to: {json_file}")
        
        # Send to Whispey API
        return await send_session_to_whispey(session_id, recording_url, apikey=self.apikey, host_url=self.host_url)
    

     