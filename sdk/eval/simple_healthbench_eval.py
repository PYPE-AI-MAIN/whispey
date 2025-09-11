"""
Simple HealthBench Evaluation Function

This module provides a simple function to evaluate transcriptions using the HealthBench evaluation framework.
The function takes a transcription in a specific format and calculates the health_bench evaluation score.

Usage:
    from simple_healthbench_eval import evaluate_transcription_healthbench
    
    # Transcription format expected:
    transcription = {
        "messages": [
            {"role": "user", "content": "What should I do if I have chest pain?"},
            {"role": "assistant", "content": "If you're experiencing chest pain, you should seek immediate medical attention..."}
        ]
    }
    
    result = evaluate_transcription_healthbench(transcription)
    print(f"HealthBench Score: {result['score']}")
"""

import os
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from healthbench_eval import HealthBenchEval, RubricItem
from sampler.chat_completion_sampler import ChatCompletionSampler, OPENAI_SYSTEM_MESSAGE_API
from eval_types import SamplerBase, SamplerResponse, MessageList
from download_healthbench_dataset import load_cached_dataset


class TranscriptionSampler(SamplerBase):
    """
    A custom sampler that uses pre-existing transcription responses instead of calling an API.
    This allows us to evaluate transcriptions that have already been generated.
    """
    
    def __init__(self, transcription_response: str):
        self.transcription_response = transcription_response
    
    def __call__(self, message_list: MessageList) -> SamplerResponse:
        return SamplerResponse(
            response_text=self.transcription_response,
            response_metadata={"usage": None},
            actual_queried_message_list=message_list,
        )


def check_openai_api_key() -> bool:
    """
    Check if OpenAI API key is available in environment variables.
    
    Returns:
        bool: True if API key is available, False otherwise
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not found in environment variables.")
        print("Please set your OpenAI API key in a .env file or environment variable.")
        return False
    return True


def evaluate_transcription_healthbench(
    transcription: Dict[str, Any],
    grader_model: str = "gpt-4o-mini",
    num_examples: Optional[int] = None,
    subset_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluate a transcription using HealthBench evaluation framework.
    
    Args:
        transcription (Dict[str, Any]): The transcription data containing messages.
            Expected format:
            {
                "messages": [
                    {"role": "user", "content": "user message"},
                    {"role": "assistant", "content": "assistant response"}
                ]
            }
        grader_model (str): The model to use for grading (default: "gpt-4o-mini")
        num_examples (Optional[int]): Limit the number of examples to evaluate
        subset_name (Optional[str]): Use specific subset ("hard", "consensus", or None for full set)
    
    Returns:
        Dict[str, Any]: Evaluation results containing score and metrics
        
    Raises:
        ValueError: If OpenAI API key is not available or transcription format is invalid
        Exception: If evaluation fails
    """
    
    # Check if OpenAI API key is available
    if not check_openai_api_key():
        raise ValueError("OpenAI API key is required for HealthBench evaluation")
    
    # Validate transcription format
    if not isinstance(transcription, dict) or "messages" not in transcription:
        raise ValueError("Transcription must be a dictionary with 'messages' key")
    
    messages = transcription["messages"]
    if not isinstance(messages, list) or len(messages) < 2:
        raise ValueError("Transcription messages must be a list with at least 2 messages")
    
    # Extract the assistant's response (last message should be from assistant)
    assistant_response = None
    for message in reversed(messages):
        if message.get("role") == "assistant":
            assistant_response = message.get("content", "")
            break
    
    if not assistant_response:
        raise ValueError("No assistant response found in transcription messages")
    
    try:
        # Initialize the grader model
        grader_sampler = ChatCompletionSampler(
            model=grader_model,
            system_message=OPENAI_SYSTEM_MESSAGE_API,
            max_tokens=2048,
        )
        
        # Initialize the HealthBench evaluator
        health_eval = HealthBenchEval(
            grader_model=grader_sampler,
            num_examples=num_examples,
            subset_name=subset_name,
            n_threads=1  # Use single thread for simple evaluation
        )
        
        # Create a custom sampler with the transcription response
        transcription_sampler = TranscriptionSampler(assistant_response)
        
        # Run the evaluation
        result = health_eval(transcription_sampler)
        
        # Format the results
        evaluation_results = {
            "score": result.score,
            "metrics": result.metrics,
            "num_examples_evaluated": len(result.convos) if result.convos else 0,
            "evaluation_successful": True
        }
        
        return evaluation_results
        
    except Exception as e:
        print(f"Error during HealthBench evaluation: {str(e)}")
        return {
            "score": None,
            "metrics": None,
            "num_examples_evaluated": 0,
            "evaluation_successful": False,
            "error": str(e)
        }


def evaluate_simple_conversation(
    user_message: str,
    assistant_response: str,
    grader_model: str = "gpt-4o-mini"
) -> Dict[str, Any]:
    """
    Convenience function to evaluate a simple user-assistant conversation.
    
    Args:
        user_message (str): The user's message/question
        assistant_response (str): The assistant's response
        grader_model (str): The model to use for grading
    
    Returns:
        Dict[str, Any]: Evaluation results
    """
    transcription = {
        "messages": [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_response}
        ]
    }
    
    return evaluate_transcription_healthbench(transcription, grader_model)


# Example usage
if __name__ == "__main__":
    # Example transcription
    sample_transcription = {
        "messages": [
            {
                "role": "user", 
                "content": "I've been having chest pain for the past hour. What should I do?"
            },
            {
                "role": "assistant", 
                "content": "Chest pain can be a serious symptom that requires immediate medical attention. You should call emergency services (911) right away or go to the nearest emergency room immediately. Chest pain could indicate a heart attack, pulmonary embolism, or other serious conditions that need urgent treatment. Don't drive yourself - call an ambulance or have someone drive you. While waiting for help, try to stay calm and avoid physical exertion."
            }
        ]
    }
    
    # Check API key before running
    if check_openai_api_key():
        print("Evaluating sample transcription...")
        result = evaluate_transcription_healthbench(sample_transcription, num_examples=5)
        
        if result["evaluation_successful"]:
            print(f"HealthBench Score: {result['score']}")
            print(f"Number of examples evaluated: {result['num_examples_evaluated']}")
            if result['metrics']:
                print("Additional metrics:")
                for key, value in result['metrics'].items():
                    print(f"  {key}: {value}")
        else:
            print(f"Evaluation failed: {result.get('error', 'Unknown error')}")
    else:
        print("Cannot run example - OpenAI API key not found")
