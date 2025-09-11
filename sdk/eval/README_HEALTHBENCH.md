# HealthBench Evaluation Integration

This module provides HealthBench evaluation capabilities integrated with the Whispey SDK for voice analytics.

## Overview

HealthBench is a comprehensive evaluation framework for healthcare conversations. This integration allows you to automatically evaluate the quality of healthcare-related conversations captured through the Whispey SDK.

## Features

- **Automatic Evaluation**: Evaluate conversations automatically when `eval="healthbench"` is specified
- **Professional Integration**: Seamlessly integrated with Whispey's professional SDK
- **Configurable Parameters**: Customize evaluation settings (grader model, number of examples, subset)
- **Comprehensive Results**: Detailed evaluation metrics included in session metadata

## Requirements

```bash
# Install required dependencies
pip install -r requirements.txt
```

Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key (required for HealthBench evaluation)

## Quick Start

### 1. Basic Usage with Whispey

```python
import os
from whispey import LivekitObserve

# Make sure OpenAI API key is set
os.environ['OPENAI_API_KEY'] = 'your-openai-api-key'

# Initialize Whispey
whispey = LivekitObserve(
    agent_id="healthcare-agent",
    apikey="your-whispey-api-key"
)

# Start session with HealthBench evaluation enabled
session_id = whispey.start_session(
    session,
    eval="healthbench",  # Enable HealthBench evaluation
    eval_grader_model="gpt-4o-mini",  # Optional: specify grader model
    eval_num_examples=10  # Optional: limit number of examples
)

# The evaluation will run automatically when the session ends
# Results will be included in metadata sent to Whispey
```

### 2. Direct Evaluation Usage

```python
from simple_healthbench_eval import evaluate_simple_conversation

# Evaluate a simple conversation
result = evaluate_simple_conversation(
    user_message="I have chest pain. What should I do?",
    assistant_response="You should seek immediate medical attention by calling 911 or going to the nearest emergency room."
)

print(f"HealthBench Score: {result['score']}")
```

## Configuration Options

When using with Whispey, you can pass these parameters to `start_session()`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `eval` | str | None | Set to `"healthbench"` to enable evaluation |
| `eval_grader_model` | str | `"gpt-4o-mini"` | Model to use for grading |
| `eval_num_examples` | int | None | Limit number of examples to evaluate |
| `eval_subset_name` | str | None | Use specific subset ("hard", "consensus") |

### Example with Full Configuration

```python
session_id = whispey.start_session(
    session,
    eval="healthbench",
    eval_grader_model="gpt-4o",  # Use more powerful model
    eval_num_examples=5,         # Evaluate against 5 examples
    eval_subset_name="hard",     # Use the "hard" subset
    
    # Additional metadata
    patient_id="patient-123",
    appointment_type="consultation",
    specialty="cardiology"
)
```

## Evaluation Results

The evaluation results are automatically included in the session metadata:

```python
{
    "metadata": {
        "evaluation": {
            "evaluation_type": "healthbench",
            "evaluation_successful": true,
            "score": 0.85,
            "metrics": {
                "overall_score": 0.85,
                "accuracy": 0.90,
                "safety": 0.95
            },
            "num_examples_evaluated": 10,
            "grader_model": "gpt-4o-mini",
            "transcript_turns": 6,
            "evaluated_at": "2024-01-15T10:30:00"
        }
    }
}
```

## Transcript Format Requirements

The evaluation works with various transcript formats. The system will automatically convert:

- **Role-based format**: `{"role": "user", "content": "message"}`
- **Speaker-based format**: `{"speaker": "patient", "text": "message"}`
- **Message format**: `{"message": "text", "role": "assistant"}`

The system normalizes speaker roles:
- `user`, `human`, `customer`, `patient` → `user`
- `assistant`, `agent`, `ai`, `doctor` → `assistant`

## Error Handling

The evaluation includes comprehensive error handling:

```python
{
    "evaluation": {
        "evaluation_type": "healthbench",
        "success": false,
        "error": "OpenAI API key not found - required for HealthBench evaluation"
    }
}
```

Common errors:
- Missing OpenAI API key
- Insufficient transcript data (need at least 2 messages)
- Network connectivity issues
- Invalid transcript format

## Running Examples

```bash
# Run the comprehensive example
cd sdk/eval
python example_whispey_healthbench.py

# Make sure to set your OpenAI API key first
export OPENAI_API_KEY="your-api-key"
```

## File Structure

```
sdk/eval/
├── simple_healthbench_eval.py      # Core evaluation function
├── example_whispey_healthbench.py  # Usage examples
├── README_HEALTHBENCH.md          # This documentation
└── healthbench_eval.py            # Original HealthBench implementation
```

## Integration Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Whispey SDK   │───▶│  Session Data    │───▶│  HealthBench    │
│                 │    │  (Transcript)    │    │  Evaluation     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐             │
                       │   Evaluation     │◀────────────┘
                       │   Results in     │
                       │   Metadata       │
                       └──────────────────┘
```

## Best Practices

1. **API Key Security**: Store your OpenAI API key securely using environment variables
2. **Rate Limiting**: Be mindful of OpenAI API rate limits when evaluating large datasets
3. **Error Handling**: Always check evaluation results for errors before using scores
4. **Model Selection**: Use `gpt-4o` for higher quality evaluation, `gpt-4o-mini` for cost efficiency
5. **Subset Selection**: Use appropriate subsets based on your use case complexity

## Troubleshooting

### Common Issues

1. **"HealthBench evaluation not available"**
   - Solution: Install missing dependencies with `pip install -r requirements.txt`

2. **"OpenAI API key not found"**
   - Solution: Set `OPENAI_API_KEY` environment variable

3. **"Insufficient transcript data"**
   - Solution: Ensure your conversation has at least user and assistant messages

4. **"No transcript data available for evaluation"**
   - Solution: Check that your session is capturing transcript data correctly

### Debug Mode

Enable debug logging to troubleshoot issues:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Support

For issues specific to HealthBench evaluation integration, check:
1. Environment variables are set correctly
2. Dependencies are installed
3. Transcript data is being captured
4. OpenAI API is accessible

For general Whispey SDK support, refer to the main Whispey documentation.
