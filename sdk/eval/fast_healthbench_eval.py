"""
Fast HealthBench Evaluation using cached datasets

This is a lightweight version that uses pre-downloaded datasets and 
has better timeout handling to prevent hanging.
"""

import os
import json
import random
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from datetime import datetime
import logging

# Load environment variables
load_dotenv()

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from download_healthbench_dataset import load_cached_dataset
from sampler.chat_completion_sampler import ChatCompletionSampler, OPENAI_SYSTEM_MESSAGE_API
from eval_types import SamplerBase, SamplerResponse, MessageList

logger = logging.getLogger(__name__)

# Grader template (simplified from original)
GRADER_TEMPLATE = """
Your job is to look at a conversation and a rubric item, and score the last turn (i.e., the last assistant response) in the conversation on how well it follows the rubric item.

# Conversation
{conversation}

# Rubric item
{rubric_item}

# Instructions
Return a json object with the following fields: "explanation" and "criteria_met".
- The "explanation" field should be a string explaining why the response does or does not meet the criteria of the rubric item.
- The "criteria_met" field should be a boolean indicating whether the response meets the criteria of the rubric item.

Return just the json object in markdown format. Do not include any other text in the response.
""".strip()

class RubricItem:
    def __init__(self, criterion: str, points: float, tags: list = None):
        self.criterion = criterion
        self.points = points
        self.tags = tags or []

    def __str__(self):
        return f"[{self.points}] {self.criterion}"

    @classmethod
    def from_dict(cls, d: dict):
        return cls(
            criterion=d.get("criterion", ""),
            points=d.get("points", 0.0),
            tags=d.get("tags", [])
        )

def parse_json_response(response_text: str) -> dict:
    """Parse JSON response from grader"""
    import re
    
    # Remove markdown formatting
    cleaned = re.sub(r"^```json\s*|\s*```$", "", response_text.strip())
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: try to extract boolean from text
        criteria_met = "true" in response_text.lower() or "yes" in response_text.lower()
        return {
            "criteria_met": criteria_met,
            "explanation": response_text
        }

def calculate_score(rubric_items: List[RubricItem], grading_responses: List[dict]) -> float:
    """Calculate overall score from rubric evaluations"""
    total_possible_points = sum(
        item.points for item in rubric_items if item.points > 0
    )
    
    if total_possible_points == 0:
        return 0.0
    
    achieved_points = sum(
        item.points
        for item, response in zip(rubric_items, grading_responses)
        if response.get("criteria_met", False)
    )
    
    return achieved_points / total_possible_points

def fast_healthbench_evaluation(
    transcription: Dict[str, Any],
    grader_model: str = "gpt-4o-mini",
    num_examples: Optional[int] = 3,  # Default to just 3 examples for speed
    subset_name: Optional[str] = None,
    timeout_seconds: int = 30
) -> Dict[str, Any]:
    """
    Fast HealthBench evaluation using cached datasets
    
    Args:
        transcription: Dictionary with 'messages' key containing conversation
        grader_model: Model to use for grading
        num_examples: Number of examples to evaluate against (None for all)
        subset_name: Dataset subset to use ("hard", "consensus", or None)
        timeout_seconds: Timeout for the entire evaluation
    
    Returns:
        Dictionary with evaluation results
    """
    
    start_time = datetime.now()
    
    try:
        # Validate input
        if not isinstance(transcription, dict) or "messages" not in transcription:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "Invalid transcription format - need 'messages' key"
            }
        
        messages = transcription["messages"]
        if len(messages) < 2:
            return {
                "evaluation_type": "healthbench", 
                "success": False,
                "error": "Need at least 2 messages for evaluation"
            }
        
        # Check OpenAI API key
        if not os.getenv('OPENAI_API_KEY'):
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "OPENAI_API_KEY environment variable required"
            }
        
        # Load cached dataset
        logger.info(f"📦 Loading HealthBench dataset (subset: {subset_name})")
        examples = load_cached_dataset(subset_name)
        
        if not examples:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": f"Failed to load HealthBench dataset (subset: {subset_name})"
            }
        
        # Limit number of examples for speed
        if num_examples and num_examples < len(examples):
            examples = random.sample(examples, num_examples)
        
        logger.info(f"🧪 Evaluating against {len(examples)} examples")
        
        # Initialize grader
        grader = ChatCompletionSampler(
            model=grader_model,
            system_message=OPENAI_SYSTEM_MESSAGE_API,
            max_tokens=500,
            temperature=0.0
        )
        
        # Extract assistant's final response
        assistant_response = ""
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                assistant_response = msg.get("content", "")
                break
        
        if not assistant_response:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "No assistant response found in messages"
            }
        
        # Format conversation for evaluation
        conversation_text = "\n\n".join([
            f"{msg['role']}: {msg['content']}" 
            for msg in messages
        ])
        
        # Evaluate against examples
        total_score = 0.0
        successful_evaluations = 0
        
        for i, example in enumerate(examples):
            try:
                # Parse rubrics
                rubrics = [RubricItem.from_dict(r) for r in example.get("rubrics", [])]
                if not rubrics:
                    continue
                
                # Evaluate each rubric
                rubric_results = []
                for rubric in rubrics:
                    try:
                        # Create grader prompt
                        prompt = GRADER_TEMPLATE.format(
                            conversation=conversation_text,
                            rubric_item=str(rubric)
                        )
                        
                        # Get grader response with timeout
                        response = grader([{"role": "user", "content": prompt}])
                        grading_result = parse_json_response(response.response_text)
                        rubric_results.append(grading_result)
                        
                    except Exception as e:
                        logger.warning(f"Rubric evaluation failed: {e}")
                        rubric_results.append({"criteria_met": False, "explanation": f"Error: {e}"})
                
                # Calculate score for this example
                if rubric_results:
                    example_score = calculate_score(rubrics, rubric_results)
                    total_score += example_score
                    successful_evaluations += 1
                
                # Check timeout
                elapsed = (datetime.now() - start_time).total_seconds()
                if elapsed > timeout_seconds:
                    logger.warning(f"⏰ Evaluation timeout after {elapsed:.1f}s")
                    break
                    
            except Exception as e:
                logger.warning(f"Example {i} evaluation failed: {e}")
                continue
        
        # Calculate final results
        if successful_evaluations == 0:
            return {
                "evaluation_type": "healthbench",
                "success": False,
                "error": "No successful evaluations completed"
            }
        
        final_score = total_score / successful_evaluations
        
        return {
            "evaluation_type": "healthbench",
            "evaluation_successful": True,
            "success": True,
            "score": final_score,
            "metrics": {
                "overall_score": final_score,
                "examples_evaluated": successful_evaluations,
                "total_examples_attempted": len(examples)
            },
            "num_examples_evaluated": successful_evaluations,
            "grader_model": grader_model,
            "subset_name": subset_name,
            "evaluation_duration_seconds": (datetime.now() - start_time).total_seconds(),
            "evaluated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Fast HealthBench evaluation failed: {e}")
        return {
            "evaluation_type": "healthbench",
            "success": False,
            "error": str(e),
            "evaluation_duration_seconds": (datetime.now() - start_time).total_seconds(),
            "evaluated_at": datetime.now().isoformat()
        }

def fast_evaluate_simple_conversation(
    user_message: str,
    assistant_response: str,
    grader_model: str = "gpt-4o-mini",
    num_examples: int = 3
) -> Dict[str, Any]:
    """
    Fast evaluation of a simple conversation
    """
    transcription = {
        "messages": [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_response}
        ]
    }
    
    return fast_healthbench_evaluation(
        transcription=transcription,
        grader_model=grader_model,
        num_examples=num_examples
    )

# Example usage
if __name__ == "__main__":
    # Test the fast evaluation
    result = fast_evaluate_simple_conversation(
        user_message="I have chest pain. What should I do?",
        assistant_response="Chest pain can be serious. You should seek immediate medical attention by calling 911 or going to the nearest emergency room.",
        num_examples=2  # Just 2 examples for quick test
    )
    
    print("🧪 Fast HealthBench Test Results:")
    print(f"Success: {result.get('success')}")
    print(f"Score: {result.get('score')}")
    print(f"Duration: {result.get('evaluation_duration_seconds'):.1f}s")
    if result.get('error'):
        print(f"Error: {result.get('error')}")
