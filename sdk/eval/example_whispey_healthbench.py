#!/usr/bin/env python3
"""
Example: Using HealthBench Evaluation with Whispey

This example demonstrates how to use the HealthBench evaluation feature
integrated into the Whispey SDK.

Usage:
    python example_whispey_healthbench.py

Make sure to set your OPENAI_API_KEY environment variable before running.
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the SDK path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from whispey import LivekitObserve

async def example_healthbench_evaluation():
    """
    Example showing how to use HealthBench evaluation with Whispey
    """
    
    # Check if OpenAI API key is available
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ OPENAI_API_KEY environment variable is required")
        print("Please set your OpenAI API key in a .env file or environment variable")
        return
    
    print("🚀 HealthBench Evaluation with Whispey Example")
    print("=" * 50)
    
    # Initialize Whispey with your agent configuration
    whispey = LivekitObserve(
        agent_id="healthbench-demo-agent",
        apikey="your-whispey-api-key",  # Replace with your actual API key
        host_url="your-whispey-host-url"  # Replace with your actual host URL
    )
    
    # Mock session object for demonstration
    class MockSession:
        def __init__(self):
            self.handlers = {}
        
        def on(self, event):
            def decorator(func):
                self.handlers[event] = func
                return func
            return decorator
        
        def start(self, agent):
            pass
    
    # Create a mock session
    session = MockSession()
    
    print("📋 Starting session with HealthBench evaluation enabled...")
    
    # Start session with HealthBench evaluation enabled
    session_id = whispey.start_session(
        session,
        eval="healthbench",  # Enable HealthBench evaluation
        eval_grader_model="gpt-4o-mini",  # Optional: specify grader model
        eval_num_examples=5,  # Optional: limit number of examples
        # eval_subset_name="hard",  # Optional: use specific subset
        
        # Additional metadata you might want to include
        patient_id="demo-patient-123",
        appointment_type="consultation",
        specialty="general_medicine"
    )
    
    print(f"✅ Session started with ID: {session_id}")
    
    # Simulate some conversation data (in real usage, this would come from your agent)
    # This is just for demonstration - normally the transcript would be captured automatically
    mock_transcript = [
        {
            "role": "user",
            "content": "I've been having chest pain for the past hour. What should I do?"
        },
        {
            "role": "assistant", 
            "content": "Chest pain can be a serious symptom that requires immediate medical attention. You should call emergency services (911) right away or go to the nearest emergency room immediately. Chest pain could indicate a heart attack, pulmonary embolism, or other serious conditions that need urgent treatment. Don't drive yourself - call an ambulance or have someone drive you. While waiting for help, try to stay calm and avoid physical exertion."
        },
        {
            "role": "user",
            "content": "Should I take any medication while I wait?"
        },
        {
            "role": "assistant",
            "content": "Do not take any medication unless specifically instructed by emergency services or a healthcare provider. If you have been prescribed nitroglycerin for a known heart condition, you may take it as prescribed. If you're not allergic and don't have contraindications, you could chew an aspirin (325mg) as it may help in case of a heart attack, but only if emergency services advise you to do so. The most important thing is to get professional medical help immediately."
        }
    ]
    
    # In a real scenario, you would let the session run and collect transcript data naturally
    # For this demo, we'll simulate ending the session
    print("🔚 Ending session and triggering evaluation...")
    
    # Get the session data (this would include the evaluation results)
    from whispey.whispey import get_session_whispey_data
    session_data = get_session_whispey_data(session_id)
    
    # Check if evaluation was run
    evaluation_result = session_data.get("metadata", {}).get("evaluation")
    
    if evaluation_result:
        print("\n📊 HealthBench Evaluation Results:")
        print("-" * 40)
        print(f"Evaluation Type: {evaluation_result.get('evaluation_type')}")
        print(f"Success: {evaluation_result.get('evaluation_successful', evaluation_result.get('success'))}")
        
        if evaluation_result.get('evaluation_successful') or evaluation_result.get('success'):
            print(f"Score: {evaluation_result.get('score')}")
            print(f"Number of Examples: {evaluation_result.get('num_examples_evaluated')}")
            print(f"Grader Model: {evaluation_result.get('grader_model')}")
            print(f"Evaluated At: {evaluation_result.get('evaluated_at')}")
            
            if evaluation_result.get('metrics'):
                print("\nDetailed Metrics:")
                for key, value in evaluation_result['metrics'].items():
                    print(f"  {key}: {value}")
        else:
            print(f"Error: {evaluation_result.get('error')}")
    else:
        print("⚠️ No evaluation results found - make sure transcript data is available")
    
    print(f"\n📤 Session data ready to send to Whispey API")
    print(f"Session ID: {session_id}")
    
    # In a real application, you would send this to Whispey:
    # result = await whispey.send_session_to_whispey(
    #     session_id, 
    #     recording_url="https://example.com/recording.wav"
    # )


def example_simple_evaluation():
    """
    Example showing direct use of the HealthBench evaluation function
    """
    print("\n" + "=" * 50)
    print("🧪 Direct HealthBench Evaluation Example")
    print("=" * 50)
    
    # Import the evaluation function directly
    sys.path.append('.')
    from simple_healthbench_eval import evaluate_simple_conversation, check_openai_api_key
    
    if not check_openai_api_key():
        print("❌ OpenAI API key not found")
        return
    
    print("Running direct HealthBench evaluation...")
    
    # Example conversation
    user_message = "I've been having severe headaches for the past week. What could be causing this?"
    assistant_response = """Severe headaches lasting a week can have various causes and should be evaluated by a healthcare provider. Some possible causes include:

1. Tension headaches from stress or poor posture
2. Migraine headaches
3. Sinus infections
4. High blood pressure
5. Dehydration
6. More serious conditions that require immediate attention

I recommend you schedule an appointment with your primary care physician as soon as possible. If you experience sudden severe headache, vision changes, fever, neck stiffness, or confusion, seek emergency medical care immediately as these could be signs of a serious condition."""
    
    # Run evaluation
    result = evaluate_simple_conversation(user_message, assistant_response)
    
    print("\n📊 Direct Evaluation Results:")
    print("-" * 30)
    if result["evaluation_successful"]:
        print(f"Score: {result['score']}")
        print(f"Examples Evaluated: {result['num_examples_evaluated']}")
    else:
        print(f"Error: {result.get('error')}")


if __name__ == "__main__":
    print("HealthBench Evaluation Examples")
    print("=" * 50)
    
    # Run the Whispey integration example
    asyncio.run(example_healthbench_evaluation())
    
    # Run the direct evaluation example
    example_simple_evaluation()
    
    print("\n✅ Examples completed!")
    print("\nTo use in your own code:")
    print("1. Set OPENAI_API_KEY environment variable")
    print("2. Initialize LivekitObserve with eval='healthbench'")
    print("3. The evaluation will run automatically when the session ends")
    print("4. Results will be included in the metadata sent to Whispey")
