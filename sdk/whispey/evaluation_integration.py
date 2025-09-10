"""
Simple HealthBench Integration for Whispey SDK
"""

import sys
import os
import logging
from typing import Dict, Any, Optional
from rich.console import Console
from rich.panel import Panel

# Add eval directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'eval'))

try:
    from healthbench_eval import HealthBenchEval
    from eval_types import Eval, EvalResult, SingleEvalResult, MessageList
    from sampler.chat_completion_sampler import ChatCompletionSampler, OPENAI_SYSTEM_MESSAGE_API
    EVAL_AVAILABLE = True
except ImportError as e:
    logging.warning(f"HealthBench evaluation not available: {e}")
    EVAL_AVAILABLE = False
    MessageList = list

logger = logging.getLogger("whispey.evaluation")
console = Console()

class ConversationSampler:
    """Simple sampler for HealthBench evaluation"""
    
    def __init__(self, conversation_data: Dict[str, Any]):
        self.conversation_data = conversation_data
        self.response_text = conversation_data.get('response_text', '')

    def __call__(self, message_list):
        """Return response for evaluation"""
        if EVAL_AVAILABLE:
            from eval_types import SamplerResponse
            return SamplerResponse(
                response_text=self.response_text,
                actual_queried_message_list=message_list,
                response_metadata={"usage": None}
            )
        else:
            return type('SamplerResponse', (), {
                'response_text': self.response_text,
                'actual_queried_message_list': message_list,
                'response_metadata': {"usage": None}
            })()

class WhispeyEvaluationRunner:
    """Simple HealthBench evaluation runner"""
    
    def run_evaluation(self, evaluation_type: str, conversation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run HealthBench evaluation"""
        
        if not EVAL_AVAILABLE:
            console.print("[red]HealthBench evaluation not available. Install required dependencies.[/red]")
            return {"error": "HealthBench not available"}
        
        if evaluation_type != "healthbench":
            console.print(f"[yellow]Only 'healthbench' evaluation is supported. Got: {evaluation_type}[/yellow]")
            return {"error": f"Unsupported evaluation type: {evaluation_type}"}
        
        try:
            # Show evaluation progress
            console.print(Panel(
                "[purple]Running HealthBench evaluation...[/purple]",
                title="[purple]Whispey Evaluation[/purple]",
                border_style="purple"
            ))
            
            # Create sampler
            sampler = ConversationSampler(conversation_data)
            
            # Create HealthBench evaluator
            grader = ChatCompletionSampler(
                model="gpt-4o-mini",
                system_message=OPENAI_SYSTEM_MESSAGE_API
            )
            
            eval_instance = HealthBenchEval(grader_model=grader, num_examples=1)
            
            # Convert conversation to MessageList format
            transcript = conversation_data.get('transcript', [])
            message_list = self._convert_to_message_list(transcript)
            
            # Run evaluation using grade_sample method
            result = eval_instance.grade_sample(message_list, sampler)
            
            # Convert result to metadata format
            metadata = self._convert_result_to_metadata(result)
            
            # Show results
            console.print(Panel(
                f"[green]HealthBench evaluation completed![/green]\n"
                f"Overall Score: {metadata.get('overall_score', 'N/A')}",
                title="[purple]Evaluation Results[/purple]",
                border_style="purple"
            ))
            
            return metadata
            
        except Exception as e:
            logger.error(f"HealthBench evaluation failed: {e}")
            console.print(f"[red]HealthBench evaluation failed: {e}[/red]")
            return {"error": str(e)}
    
    def _convert_to_message_list(self, transcript: list) -> MessageList:
        """Convert transcript to MessageList format"""
        if not EVAL_AVAILABLE:
            return []
        
        message_list = []
        for item in transcript:
            if isinstance(item, dict):
                role = item.get('role', 'user')
                content = item.get('content', '')
                message_list.append({"role": role, "content": content})
        return message_list
    
    def _convert_result_to_metadata(self, result) -> Dict[str, Any]:
        """Convert evaluation result to metadata format"""
        if not EVAL_AVAILABLE or not hasattr(result, 'metrics'):
            return {"overall_score": 0, "criteria_scores": {}}
        
        metadata = {
            "overall_score": result.metrics.get("overall_score", 0),
            "criteria_scores": {},
            "evaluation_type": "healthbench"
        }
        
        # Add individual criteria scores
        for key, value in result.metrics.items():
            if key != "overall_score":
                metadata["criteria_scores"][key] = value
        
        return metadata

# Global instance
evaluation_runner = WhispeyEvaluationRunner()