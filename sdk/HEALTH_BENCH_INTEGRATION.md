# HealthBench Evaluation Integration

## Overview

HealthBench evaluation is now integrated into the Whispey SDK, allowing you to automatically evaluate conversations against medical/healthcare quality standards using the original OpenAI HealthBench framework.

## Usage

### Basic Integration

Simply add the `eval` parameter to your `LivekitObserve` initialization:

```python
from whispey import LivekitObserve

# Initialize with HealthBench evaluation
pype = LivekitObserve(
    agent_id="your_agent_id",
    apikey="your_api_key",
    eval="healthbench"  # Enable HealthBench evaluation
)

# Start session (evaluation runs automatically)
session_id = pype.start_session(session, phone_number="+1234567890")

# Export session data (includes evaluation results)
await pype.export(session_id)
```

### Available Evaluation Types

- **`"healthbench"`** - Standard HealthBench evaluation
- **`"healthbench_hard"`** - HealthBench hard subset (more challenging cases)
- **`"healthbench_consensus"`** - HealthBench consensus subset (high agreement cases)

### Example with Bug Reporting

```python
pype = LivekitObserve(
    agent_id="your_agent_id",
    apikey="your_api_key",
    eval="healthbench",  # Enable HealthBench evaluation
    bug_reports={
        "bug_start_command": ["fault report", "report issue"],
        "bug_end_command": ["fault report over", "report over"],
        "response": "Okay, please tell me the issue?",
        "collection_prompt": "Okay",
    }
)
```

## Evaluation Results

HealthBench evaluation results are automatically stored in the `evaluation` key of the conversation metadata. The results include:

### Overall Metrics
- **Overall Score**: Percentage score based on rubric criteria
- **Total Points**: Points earned vs. possible points
- **Criteria Count**: Number of evaluation criteria

### Detailed Results
- **Individual Criteria**: Each criterion with pass/fail status
- **Explanations**: Detailed explanations for each criterion
- **Rubric Summary**: Complete rubric used for evaluation

### Example Output Structure
```json
{
  "metadata": {
    "evaluation": {
      "evaluation_type": "healthbench",
      "overall_score": 0.75,
      "total_possible_points": 100.0,
      "total_earned_points": 75.0,
      "criteria_count": 5,
      "criteria_results": [
        {
          "name": "medical_accuracy",
          "criteria_met": true,
          "explanation": "Response demonstrates medical accuracy",
          "points_earned": 20.0
        }
      ],
      "rubric_summary": [...],
      "detailed_results": {...}
    }
  }
}
```

## How It Works

1. **Automatic Evaluation**: When a session ends, the conversation is automatically evaluated against HealthBench criteria
2. **LLM-Based Grading**: Uses GPT-4.1 to grade responses against medical quality standards
3. **Rich Output**: Evaluation status is displayed with purple-colored HealthBench indicators
4. **Dashboard Integration**: Results appear in your Whispey dashboard under the evaluation metadata

## Technical Details

- **Evaluation Framework**: Uses the original OpenAI HealthBench evaluation system
- **Grading Model**: GPT-4.1-2025-04-14 for consistent, high-quality evaluation
- **Integration**: Seamlessly integrated into the existing `LivekitObserve` class
- **Performance**: Evaluation runs asynchronously and doesn't block conversation flow

## Requirements

- **Rich Library**: For colored console output (automatically installed)
- **OpenAI API**: For the grading model (uses your existing API key)
- **HealthBench Dataset**: Automatically downloaded from OpenAI's public datasets

## Benefits

- **Quality Assurance**: Automatically evaluate medical conversation quality
- **Compliance**: Ensure conversations meet healthcare standards
- **Analytics**: Track conversation quality over time
- **Improvement**: Identify areas for agent improvement
- **Reporting**: Generate quality reports for stakeholders

## Notes

- Evaluation runs automatically when sessions end
- Results are stored in conversation metadata
- No additional configuration required beyond enabling the evaluation type
- Compatible with all existing Whispey features (bug reporting, telemetry, etc.)
