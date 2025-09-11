#!/usr/bin/env python3
"""
Simple script to evaluate your own conversations
Usage: python evaluate_my_conversation.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from custom_conversation_evaluator import evaluate_single_conversation, print_evaluation_results

def main():
    print("🏥 HealthBench Conversation Evaluator")
    print("=" * 50)
    print("Enter your conversation below. Type 'DONE' when finished.")
    print("Format: role:content (e.g., 'user:I have a headache')")
    print()
    
    conversation = []
    
    while True:
        line = input("Enter message (role:content) or 'DONE': ").strip()
        
        if line.upper() == 'DONE':
            break
            
        if ':' not in line:
            print("Please use format: role:content")
            continue
            
        role, content = line.split(':', 1)
        role = role.strip().lower()
        content = content.strip()
        
        if role not in ['user', 'assistant', 'system']:
            print("Role must be 'user', 'assistant', or 'system'")
            continue
            
        conversation.append({"role": role, "content": content})
        print(f"Added: {role.title()}: {content[:50]}{'...' if len(content) > 50 else ''}")
    
    if not conversation:
        print("No conversation entered. Exiting.")
        return
    
    print(f"\n📝 Your conversation ({len(conversation)} messages):")
    print("-" * 50)
    for msg in conversation:
        print(f"{msg['role'].title()}: {msg['content']}")
    
    print("\n🔍 Evaluating conversation...")
    
    try:
        results = evaluate_single_conversation(conversation)
        print_evaluation_results(results)
        
        # Save results to file
        import json
        from datetime import datetime
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"conversation_evaluation_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump({
                "conversation": conversation,
                "evaluation_results": results,
                "timestamp": timestamp
            }, f, indent=2)
        
        print(f"\n💾 Results saved to: {filename}")
        
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure you have set your OPENAI_API_KEY environment variable")

if __name__ == "__main__":
    main()
