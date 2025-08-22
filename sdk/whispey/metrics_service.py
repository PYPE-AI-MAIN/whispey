# sdk/whispey/metrics_service.py
import time
from livekit.agents import metrics

def setup_usage_collector():
    """Setup metrics collection"""
    return metrics.UsageCollector()

def create_session_data(ctx, call_start_time):
    """Create initial session data structure"""
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
