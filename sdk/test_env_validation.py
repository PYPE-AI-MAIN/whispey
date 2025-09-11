#!/usr/bin/env python3
"""
Test script to demonstrate the environment validation feature
"""

import os
import sys

# Add the current directory to the path so we can import whispey
sys.path.insert(0, '.')

def test_without_openai_key():
    """Test the validation when OPENAI_API_KEY is not set"""
    print("🧪 Testing without OPENAI_API_KEY...")
    
    # Remove OPENAI_API_KEY if it exists
    if 'OPENAI_API_KEY' in os.environ:
        del os.environ['OPENAI_API_KEY']
    
    try:
        from whispey import LivekitObserve
        pype = LivekitObserve(agent_id="test-agent")
        print("✅ LivekitObserve initialized successfully (with warning)")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_with_openai_key():
    """Test the validation when OPENAI_API_KEY is set"""
    print("\n🧪 Testing with OPENAI_API_KEY...")
    
    # Set a dummy OPENAI_API_KEY
    os.environ['OPENAI_API_KEY'] = 'test-key-12345'
    
    try:
        from whispey import LivekitObserve
        pype = LivekitObserve(agent_id="test-agent")
        print("✅ LivekitObserve initialized successfully (with success message)")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🔍 Testing Whispey SDK Environment Validation")
    print("=" * 50)
    
    test_without_openai_key()
    test_with_openai_key()
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")
