#!/usr/bin/env python3
"""
Quick test script to verify HealthBench evaluation works with OpenAI API
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add eval path
sys.path.append('eval')

def test_openai_connection():
    """Test basic OpenAI API connection"""
    try:
        import openai
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("❌ OPENAI_API_KEY not found")
            return False
        
        print(f"✅ API Key found: {api_key[:10]}...{api_key[-4:]}")
        
        client = openai.OpenAI()
        
        print("🧪 Testing OpenAI API connection...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5,
            timeout=10
        )
        
        print(f"✅ OpenAI API works: {response.choices[0].message.content}")
        return True
        
    except Exception as e:
        print(f"❌ OpenAI API test failed: {e}")
        return False

def test_healthbench_simple():
    """Test HealthBench evaluation with simple conversation"""
    try:
        from simple_healthbench_eval import evaluate_simple_conversation
        
        print("\n🧪 Testing HealthBench evaluation...")
        
        result = evaluate_simple_conversation(
            user_message="I have a headache. What should I do?",
            assistant_response="For a headache, you can try rest, hydration, and over-the-counter pain relievers like acetaminophen or ibuprofen. If headaches persist or worsen, consult a healthcare provider.",
            grader_model="gpt-4o-mini"
        )
        
        print("📊 HealthBench Results:")
        print(f"  Success: {result.get('evaluation_successful')}")
        print(f"  Score: {result.get('score')}")
        print(f"  Examples: {result.get('num_examples_evaluated')}")
        
        if result.get('error'):
            print(f"  Error: {result.get('error')}")
        
        return result.get('evaluation_successful', False)
        
    except Exception as e:
        print(f"❌ HealthBench test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🔍 HealthBench API Test")
    print("=" * 40)
    
    # Test 1: OpenAI connection
    api_works = test_openai_connection()
    
    if api_works:
        # Test 2: HealthBench evaluation
        healthbench_works = test_healthbench_simple()
        
        if healthbench_works:
            print("\n✅ All tests passed! HealthBench evaluation should work.")
        else:
            print("\n❌ HealthBench evaluation failed.")
    else:
        print("\n❌ OpenAI API connection failed. Check your API key.")
    
    print("\nNext steps:")
    print("1. If OpenAI API works but HealthBench fails, check dependencies")
    print("2. If both work, the issue might be in the Whispey integration")
    print("3. Try running your agent again with the improved error handling")
