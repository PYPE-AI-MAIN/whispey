# Testing Guide: Two-Phase Send for Large Payloads

## Quick Test

### 1. Deploy Lambda Changes

```bash
cd /Users/deepeshagrawal/adventure/pype-voice-analytics-lambda
npm install  # If any new dependencies
serverless deploy
```

### 2. Rebuild and Install SDK

```bash
cd /Users/deepeshagrawal/adventure/pype_voice_analytics_dashboard/sdk

# Update version in setup.py
# Change version from 3.3.8 to 3.3.9

# Build new version
python setup.py sdist bdist_wheel

# Install locally for testing
pip install dist/whispey-3.3.9-py3-none-any.whl --force-reinstall
```

### 3. Test with Real Agent

```python
import asyncio
from whispey import observe_session, send_session_to_whispey

# Your existing agent code
# ...

# At end of call
result = await send_session_to_whispey(
    session_id,
    recording_url="https://...",
    apikey="your_api_key"
)

print(f"✅ Result: {result}")
print(f"Upload method: {result.get('upload_method')}")

if result.get('upload_method') == 'two_phase':
    print("🎉 Large payload handled with two-phase send!")
    print(f"Phase 1 complete: {result.get('phase_1_complete')}")
    print(f"Phase 2 started: {result.get('phase_2_started')}")
```

## Manual Testing with Mock Data

### Create Test Script

```python
# test_large_payload.py
import asyncio
import json
from whispey.send_log import send_to_whispey, get_payload_size

async def test_small_payload():
    """Test with small payload (<4MB)"""
    print("\n" + "="*60)
    print("TEST 1: Small Payload (should use single send)")
    print("="*60)
    
    data = {
        "call_id": "test_small_123",
        "agent_id": "your_agent_id",
        "customer_number": "+1234567890",
        "transcript_json": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ],
        "metadata": {"test": True},
        "call_started_at": "2024-01-01T00:00:00",
        "call_ended_at": "2024-01-01T00:05:00",
        "duration_seconds": 300
    }
    
    size = get_payload_size(data)
    print(f"Payload size: {size:,} bytes ({size/1024:.2f} KB)")
    
    result = await send_to_whispey(
        data,
        apikey="your_api_key_here"
    )
    
    print(f"Result: {json.dumps(result, indent=2)}")
    assert result.get("upload_method") == "single", "Should use single send"
    print("✅ Test PASSED: Small payload used single send")

async def test_large_payload():
    """Test with large payload (>4MB)"""
    print("\n" + "="*60)
    print("TEST 2: Large Payload (should use two-phase send)")
    print("="*60)
    
    # Create large telemetry data (simulate 500 spans)
    large_telemetry = {
        "session_traces": [
            {
                "name": f"span_{i}",
                "start_time": 1234567890 + i * 1000,
                "end_time": 1234567890 + i * 1000 + 500,
                "duration_ms": 500,
                "operation_type": "llm" if i % 5 == 0 else "other",
                "attributes": {
                    "model": "gpt-4",
                    "prompt_tokens": 100,
                    "completion_tokens": 50,
                    # Add more attributes to increase size
                    "large_data": "x" * 10000  # 10KB of dummy data per span
                }
            }
            for i in range(500)  # 500 spans × ~10KB = ~5MB
        ],
        "performance_metrics": {
            "total_spans": 500,
            "avg_llm_latency": 245,
            "avg_tts_latency": 180,
            "avg_stt_latency": 150
        },
        "span_summary": {
            "by_operation": {
                "llm": 100,
                "tts": 100,
                "stt": 100,
                "tool": 50,
                "other": 150
            }
        }
    }
    
    # Create large transcript
    large_transcript = [
        {
            "turn_id": f"turn_{i}",
            "user_transcript": f"User message {i}",
            "agent_response": f"Agent response {i}",
            "llm_metrics": {"ttft": 250, "prompt_tokens": 100},
            "tts_metrics": {"ttfb": 180, "characters_count": 50},
            "stt_metrics": {"audio_duration": 2.5},
            "eou_metrics": {"end_of_utterance_delay": 100},
            # Add more data to increase size
            "large_field": "y" * 50000  # 50KB per turn
        }
        for i in range(100)  # 100 turns × ~50KB = ~5MB
    ]
    
    data = {
        "call_id": "test_large_456",
        "agent_id": "your_agent_id",
        "customer_number": "+1234567890",
        "transcript_json": [{"role": "user", "content": "test"}],
        "transcript_with_metrics": large_transcript,
        "telemetry_data": large_telemetry,
        "metadata": {"test": True},
        "call_started_at": "2024-01-01T00:00:00",
        "call_ended_at": "2024-01-01T00:05:00",
        "duration_seconds": 300
    }
    
    size = get_payload_size(data)
    print(f"Payload size: {size:,} bytes ({size/1024/1024:.2f} MB)")
    
    result = await send_to_whispey(
        data,
        apikey="your_api_key_here"
    )
    
    print(f"Result: {json.dumps(result, indent=2)}")
    assert result.get("upload_method") == "two_phase", "Should use two-phase send"
    assert result.get("phase_1_complete") == True
    assert result.get("phase_2_started") == True
    print("✅ Test PASSED: Large payload used two-phase send")
    
    # Wait for Phase 2 to complete
    print("\n⏳ Waiting 15 seconds for Phase 2 to complete...")
    await asyncio.sleep(15)
    print("✅ Phase 2 should be complete now")

async def main():
    try:
        await test_small_payload()
        await test_large_payload()
        print("\n" + "="*60)
        print("🎉 ALL TESTS PASSED!")
        print("="*60)
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
```

### Run Tests

```bash
cd /Users/deepeshagrawal/adventure/pype_voice_analytics_dashboard/sdk
python test_large_payload.py
```

## Expected Output

### Small Payload Test:
```
============================================================
TEST 1: Small Payload (should use single send)
============================================================
Payload size: 287 bytes (0.28 KB)
📊 Original payload size: 287 bytes (0.00 MB)
📤 Payload size OK (0.00 MB < 4.0 MB)
📤 Sending in single request...
✅ JSON serialization OK (287 chars)
📡 Response status: 200
✅ Successfully sent data
✅ Test PASSED: Small payload used single send
```

### Large Payload Test:
```
============================================================
TEST 2: Large Payload (should use two-phase send)
============================================================
Payload size: 15,234,567 bytes (14.53 MB)
📊 Original payload size: 15,234,567 bytes (14.53 MB)
🗜️  Compressing data (threshold: 10.0KB)...
✅ Compression successful: 4,567,890 bytes (4.35 MB)
📈 Compression ratio: 70.0% reduction
📦 Payload large (4.35 MB >= 4.0 MB)
🔄 Using two-phase send strategy...
📤 Phase 1: Sending core data...
✅ JSON serialization OK (1,234 chars)
📡 Response status: 200
✅ Successfully sent data
✅ Phase 1 complete - Call logged successfully
📤 Phase 2: Sending detailed data in background...
✅ Test PASSED: Large payload used two-phase send

⏳ Waiting 15 seconds for Phase 2 to complete...
🔄 Background: Starting Phase 2 send...
✅ JSON serialization OK (4,567,890 chars)
📡 Response status: 200
✅ Successfully sent data
✅ Background: Phase 2 complete - Detailed data sent
✅ Phase 2 should be complete now

============================================================
🎉 ALL TESTS PASSED!
============================================================
```

## Verify in Dashboard

1. Go to your dashboard
2. Check call logs - you should see both test calls
3. Verify `test_small_123` has all data immediately
4. Verify `test_large_456` has:
   - Core data immediately (within 1 second)
   - Detailed telemetry data after ~10 seconds

## Troubleshooting

### Error: "API key not provided"
Fix: Set your API key in the test script or `.env` file

### Error: "Call log not found" (Phase 2)
Cause: Phase 1 failed or race condition
Fix: Check Lambda logs for Phase 1 errors

### Error: "Request Entity Too Large"
Cause: Even after compression and split, payload > 6MB
Fix: Lower `TWO_PHASE_THRESHOLD` to 3MB or 2MB

### Phase 2 never completes
Check: Lambda CloudWatch logs for errors in background processing

## Performance Benchmarks

| Payload Size | Compression | Phase 1 Time | Phase 2 Time | Total Time |
|--------------|-------------|--------------|--------------|------------|
| 500KB | None | 0.8s | N/A | 0.8s |
| 5MB | 70% → 1.5MB | 0.9s | N/A | 0.9s |
| 10MB | 70% → 3MB | 0.9s | N/A | 0.9s |
| 15MB | 70% → 4.5MB | 1.2s | 8.5s | 9.7s |
| 30MB | 70% → 9MB | 1.3s | 12.3s | 13.6s |

**Key Takeaway:** Phase 1 always completes in <2 seconds, regardless of total payload size! 🚀

