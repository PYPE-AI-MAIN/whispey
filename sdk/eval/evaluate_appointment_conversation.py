#!/usr/bin/env python3
"""
Script to evaluate appointment booking conversations
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from custom_conversation_evaluator import evaluate_single_conversation, print_evaluation_results
from healthbench_eval import RubricItem

def parse_conversation_trace(trace_text):
    """
    Parse the conversation trace into the proper format for evaluation
    """
    lines = trace_text.strip().split('\n')
    conversation = []
    
    for line in lines:
        if '→' in line:  # User input
            # Extract user message after the arrow
            user_msg = line.split('→', 1)[1].strip()
            conversation.append({"role": "user", "content": user_msg})
        elif '←' in line:  # Assistant response
            # Extract assistant message after the arrow
            assistant_msg = line.split('←', 1)[1].strip()
            conversation.append({"role": "assistant", "content": assistant_msg})
    
    return conversation

def create_appointment_booking_rubrics():
    """
    Create custom rubrics specific to appointment booking conversations
    """
    return [
        RubricItem(
            criterion="The system successfully collects all necessary information for booking an appointment (patient name, doctor, date, time)",
            points=5.0,
            tags=["information_gathering", "completeness"]
        ),
        RubricItem(
            criterion="The system handles unclear or incorrect user inputs gracefully and asks for clarification when needed",
            points=4.0,
            tags=["error_handling", "user_experience"]
        ),
        RubricItem(
            criterion="The system provides clear, helpful responses and maintains a professional, empathetic tone",
            points=3.0,
            tags=["communication", "empathy"]
        ),
        RubricItem(
            criterion="The system efficiently guides the user through the booking process without unnecessary steps",
            points=3.0,
            tags=["efficiency", "workflow"]
        ),
        RubricItem(
            criterion="The system accurately processes and confirms appointment details before finalizing",
            points=4.0,
            tags=["accuracy", "confirmation"]
        ),
        RubricItem(
            criterion="The system handles multiple patients with similar names appropriately",
            points=3.0,
            tags=["data_management", "patient_identification"]
        )
    ]

def evaluate_appointment_conversation(conversation_trace):
    """
    Evaluate an appointment booking conversation
    """
    # Parse the conversation
    conversation = parse_conversation_trace(conversation_trace)
    
    # Create appointment-specific rubrics
    rubrics = create_appointment_booking_rubrics()
    
    # Evaluate the conversation
    results = evaluate_single_conversation(conversation, rubrics)
    
    return results, conversation

def main():
    print("🏥 Appointment Booking Conversation Evaluator")
    print("=" * 60)
    
    # Your conversation trace
    conversation_trace = """Turn-turn_1
Session: 039aae60
📞 iTdg
←नमस्ते! This is स्पर्श Hospital. How can I help you today?
Turn-turn_2
Session: 039aae60
📞 iTdg
→I want to book an appointment with Dr. Ishwar.
←Which day suits you? Monday to Saturday?
Turn-turn_3
Session: 039aae60
📞 iTdg
→Tomorrow.
←Looking for Doctor Ishwar on Saturday, September 06, 2025...
Turn-turn_4
Session: 039aae60
📞 iTdg
←Checking availability for Doctor Ishwar Amalazari on Saturda...
Turn-turn_5
Session: 039aae60
📞 iTdg
←Morning or afternoon? You can say a time like ten thirty or ...
Turn-turn_6
Session: 039aae60
📞 iTdg
→Morning.
←Morning slots from ten thirty AM to twelve noon. Any specifi...
Turn-turn_7
Session: 039aae60
📞 iTdg
→10:30 AM.
←Ten thirty AM. Okay. What is the patient's name?
Turn-turn_8
Session: 039aae60
📞 iTdg
→Dipesh Agarwal.
←I found multiple patients with this number. Is this for Dipe...
Turn-turn_9
Session: 039aae60
📞 iTdg
→Testing user.
←I didn't catch that. Please say the full name - Dipesh Agarw...
Turn-turn_10
Session: 039aae60
📞 iTdg
→Okay, Dipesh Narwal.
←I didn't catch that. Please say the full name - Dipesh Agarw...
Turn-turn_11
Session: 039aae60
📞 iTdg
←I didn't catch that. Please say the full name - Dipesh Agarw...
Turn-turn_12
Session: 039aae60
📞 iTdg
→First month.
←I didn't catch that. Please say the full name - Dipesh Agarw...
Turn-turn_13
Session: 039aae60
📞 iTdg
→S. Kesh Aggarwal.
←I didn't catch that. Please say the full name - Dipesh Agarw..."""
    
    print("\n📝 PARSED CONVERSATION:")
    print("-" * 60)
    
    try:
        # Parse and evaluate
        results, parsed_conversation = evaluate_appointment_conversation(conversation_trace)
        
        # Display parsed conversation
        for i, msg in enumerate(parsed_conversation, 1):
            role_emoji = "👤" if msg['role'] == 'user' else "🤖"
            print(f"{i:2d}. {role_emoji} {msg['role'].title()}: {msg['content']}")
        
        print("\n" + "=" * 60)
        
        # Print evaluation results
        print_evaluation_results(results)
        
        # Additional analysis
        print(f"\n🔍 ADDITIONAL ANALYSIS:")
        print("-" * 60)
        
        # Count conversation turns
        user_turns = len([m for m in parsed_conversation if m['role'] == 'user'])
        assistant_turns = len([m for m in parsed_conversation if m['role'] == 'assistant'])
        
        print(f"Total conversation turns: {user_turns + assistant_turns}")
        print(f"User turns: {user_turns}")
        print(f"Assistant turns: {assistant_turns}")
        
        # Identify issues
        print(f"\n⚠️  POTENTIAL ISSUES IDENTIFIED:")
        issues = []
        
        # Check for repeated responses
        assistant_responses = [m['content'] for m in parsed_conversation if m['role'] == 'assistant']
        if len(set(assistant_responses)) < len(assistant_responses):
            issues.append("System repeated the same response multiple times")
        
        # Check for unclear user inputs
        user_responses = [m['content'] for m in parsed_conversation if m['role'] == 'user']
        unclear_responses = [r for r in user_responses if len(r.split()) < 2 or r.lower() in ['testing user', 'first month']]
        if unclear_responses:
            issues.append(f"User provided unclear responses: {unclear_responses}")
        
        # Check if appointment was completed
        last_assistant_msg = assistant_responses[-1] if assistant_responses else ""
        if "didn't catch that" in last_assistant_msg.lower():
            issues.append("Conversation ended without successful appointment booking")
        
        if issues:
            for i, issue in enumerate(issues, 1):
                print(f"{i}. {issue}")
        else:
            print("No major issues identified")
        
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure you have set your OPENAI_API_KEY environment variable")

if __name__ == "__main__":
    main()

