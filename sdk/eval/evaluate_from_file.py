#!/usr/bin/env python3
"""
Evaluate conversations from a JSON file
Usage: python evaluate_from_file.py <conversation_file.json>
"""

import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from custom_conversation_evaluator import evaluate_single_conversation, print_evaluation_results

def load_conversations_from_file(filename):
    """Load conversations from a JSON file"""
    with open(filename, 'r') as f:
        data = json.load(f)
    
    # Handle different file formats
    if isinstance(data, list):
        # If it's a list of conversations
        if isinstance(data[0], list):
            return data  # List of conversations
        else:
            return [data]  # Single conversation
    elif isinstance(data, dict):
        if 'conversation' in data:
            return [data['conversation']]
        elif 'messages' in data:
            return [data['messages']]
        else:
            # Assume the dict itself is a conversation
            return [data]
    else:
        raise ValueError("Unsupported file format")

def main():
    if len(sys.argv) != 2:
        print("Usage: python evaluate_from_file.py <conversation_file.json>")
        print("\nExample conversation file format:")
        print("""
[
  {
    "role": "user",
    "content": "I have a headache, what should I do?"
  },
  {
    "role": "assistant", 
    "content": "I understand you have a headache. While I can provide general information, I recommend consulting a healthcare professional for proper medical advice..."
  }
]
        """)
        return
    
    filename = sys.argv[1]
    
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
    
    try:
        conversations = load_conversations_from_file(filename)
        print(f"📁 Loaded {len(conversations)} conversation(s) from {filename}")
        
        for i, conversation in enumerate(conversations, 1):
            print(f"\n{'='*60}")
            print(f"CONVERSATION {i} of {len(conversations)}")
            print(f"{'='*60}")
            
            print(f"\n📝 Conversation:")
            for msg in conversation:
                print(f"{msg['role'].title()}: {msg['content']}")
            
            print(f"\n🔍 Evaluating conversation {i}...")
            
            try:
                results = evaluate_single_conversation(conversation)
                print_evaluation_results(results)
                
                # Save individual results
                timestamp = f"conv_{i}_{len(conversations)}"
                result_filename = f"evaluation_{timestamp}.json"
                
                with open(result_filename, 'w') as f:
                    json.dump({
                        "conversation": conversation,
                        "evaluation_results": results,
                        "conversation_number": i
                    }, f, indent=2)
                
                print(f"\n💾 Results saved to: {result_filename}")
                
            except Exception as e:
                print(f"Error evaluating conversation {i}: {e}")
                continue
    
    except Exception as e:
        print(f"Error loading file: {e}")

if __name__ == "__main__":
    main()
