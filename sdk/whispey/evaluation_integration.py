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
        """Run HealthBench evaluation with timeout protection"""
        
        if not EVAL_AVAILABLE:
            console.print("[red]HealthBench evaluation not available. Install required dependencies.[/red]")
            return {"error": "HealthBench not available"}
        
        if evaluation_type != "healthbench":
            console.print(f"[yellow]Only 'healthbench' evaluation is supported. Got: {evaluation_type}[/yellow]")
            return {"error": f"Unsupported evaluation type: {evaluation_type}"}
        
        try:
            # Show evaluation progress
            console.print(Panel(
                "[#1e40af]Running HealthBench evaluation...[/#1e40af]",
                title="[#1e40af]Whispey Evaluation[/#1e40af]",
                border_style="#1e40af"
            ))
            
            # Create sampler
            sampler = ConversationSampler(conversation_data)
            
            # Create HealthBench evaluator with minimal configuration for faster execution
            grader = ChatCompletionSampler(
                model="gpt-4o-mini",
                system_message=OPENAI_SYSTEM_MESSAGE_API
            )
            
            # Use minimal configuration to prevent hanging
            eval_instance = HealthBenchEval(
                grader_model=grader, 
                num_examples=1,  # Only evaluate 1 example
                n_threads=1,     # Single thread to prevent resource issues
                n_repeats=1      # Single repeat
            )
            
            # Check if we have valid conversation data
            transcript = conversation_data.get('transcript', [])
            response_text = conversation_data.get('response_text', '')
            
            logger.info(f"📊 Evaluation data check - Transcript turns: {len(transcript)}, Response text length: {len(response_text)}")
            
            if not transcript:
                logger.warning("No transcript data for evaluation")
                return {"overall_score": 0.0, "error": "No transcript data", "evaluation_type": "healthbench"}
            
            # If no response text, try to extract from transcript
            if not response_text and transcript:
                logger.info("No response text provided, extracting from transcript")
                for turn in reversed(transcript):
                    logger.info(f"🔍 Checking turn: role={turn.get('role')}, content_keys={[k for k in turn.keys() if 'content' in k.lower()]}")
                    if turn.get('role') == 'assistant':
                        response_text = turn.get('content') or turn.get('text_content') or turn.get('text') or turn.get('message')
                        if response_text:
                            logger.info(f"Extracted response text from transcript: {response_text[:100]}...")
                            break
                        else:
                            logger.warning(f"Found assistant turn but no content: {turn}")
            
            if not response_text:
                logger.warning("No response text found for evaluation")
                return {"overall_score": 0.0, "error": "No response text found", "evaluation_type": "healthbench"}
            
            # Convert conversation to MessageList format
            transcript = conversation_data.get('transcript', [])
            message_list = self._convert_to_message_list(transcript)
            
            # Run evaluation with timeout protection using threading
            import threading
            import time
            
            result = None
            exception = None
            
            def run_evaluation():
                nonlocal result, exception
                try:
                    # Run evaluation using the __call__ method
                    result = eval_instance(sampler)
                except Exception as e:
                    exception = e
            
            # Start evaluation in a separate thread
            eval_thread = threading.Thread(target=run_evaluation)
            eval_thread.daemon = True
            eval_thread.start()
            
            # Wait for completion with timeout (30 seconds)
            eval_thread.join(timeout=30)
            
            if eval_thread.is_alive():
                logger.warning("HealthBench evaluation timed out after 30 seconds")
                console.print("[yellow]HealthBench evaluation timed out[/yellow]")
                return {"overall_score": 0.0, "error": "Evaluation timeout", "evaluation_type": "healthbench"}
            
            if exception:
                logger.error(f"HealthBench evaluation failed: {exception}")
                return {"overall_score": 0.0, "error": str(exception), "evaluation_type": "healthbench"}
            
            if result is None:
                logger.error("HealthBench evaluation returned no result")
                return {"overall_score": 0.0, "error": "No evaluation result", "evaluation_type": "healthbench"}
            
            # Convert result to metadata format
            metadata = self._convert_result_to_metadata(result)
            
            # Show results
            console.print(Panel(
                f"[green]HealthBench evaluation completed![/green]\n"
                f"Overall Score: {metadata.get('overall_score', 'N/A')}",
                title="[#1e40af]Evaluation Results[/#1e40af]",
                border_style="#1e40af"
            ))
            
            return metadata
            
        except Exception as e:
            logger.error(f"HealthBench evaluation failed: {e}")
            console.print(f"[red]HealthBench evaluation failed: {e}[/red]")
            return {"error": str(e), "overall_score": 0.0, "evaluation_type": "healthbench"}
    
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
        if not EVAL_AVAILABLE:
            return {"overall_score": 0, "criteria_scores": {}, "evaluation_type": "healthbench"}
        
        # Handle EvalResult object
        if hasattr(result, 'score') and hasattr(result, 'metrics'):
            metadata = {
                "overall_score": result.score if result.score is not None else 0,
                "criteria_scores": result.metrics if result.metrics else {},
                "evaluation_type": "healthbench",
                "htmls_count": len(result.htmls) if hasattr(result, 'htmls') else 0,
                "conversations_count": len(result.convos) if hasattr(result, 'convos') else 0
            }
        else:
            # Fallback for other result types
            metadata = {
                "overall_score": 0,
                "criteria_scores": {},
                "evaluation_type": "healthbench"
            }
        
        return metadata

# Global instance
evaluation_runner = WhispeyEvaluationRunner()