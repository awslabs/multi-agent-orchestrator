# Classification Testing Guide
## Overview
This guide explains how to set up and run classification tests for the Multi-Agent Orchestrator. These tests verify that user inputs are correctly routed to the appropriate agents with the expected confidence levels.

## Required Files
You need three JSON configuration files in the `python/src/tests/integration/classifier/` directory:

### 1. orchestrator_config.json
Configures the classifier settings and model parameters.

```json
{
    "classifier": {
        "type": "bedrock",
        "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
        "parameters": {
            "temperature": 0.0,
            "top_p": 1.0,
            "max_tokens": 1024
        }
    }
}
```

- `type`: Currently only supports "bedrock"
- `model_id`: The Bedrock model to use for classification
- `parameters`: Model-specific parameters for inference

### 2. agents.json
Defines the available agents and their capabilities.

```json
{
    "agents": [
        {
            "name": "booking_agent",
            "description": "Handles flight and hotel bookings, travel itineraries, and vacation planning",
            "model_id": "anthropic.claude-3-sonnet-20240229-v1:0"
        },
        {
            "name": "payment_agent",
            "description": "Handles payment processing, refunds, and billing inquiries",
            "model_id": "anthropic.claude-3-sonnet-20240229-v1:0"
        }
    ]
}
```

- name: Unique identifier for the agent
- description: Detailed description of agent's capabilities (important for routing)
- model_id: The model this agent uses

### 3. user_input.json
Contains the test cases to evaluate.

```json
{
    "cases": [
        {
            "input": ["I want to book a flight to London"],
            "expected": "booking_agent"
        },
        {
            "input": ["I need to make a payment", "How much do I owe?"],
            "expected": "payment_agent",
            "min_confidence": "0.90"
        }
    ]
}
```

- input: Array of messages (supports multi-turn conversations)
- expected: The agent name that should handle this input
- min_confidence: (Optional) Required confidence level as a float number

## Running Classifier Integration Tests

1. Create the directory structure:
```bash
mkdir -p python/src/tests/integration/classifier
```
2. Place the configuration files in the directory:
```bash
python/src/tests/integration/classifier/
├── orchestrator_config.json
├── agents.json
└── user_input.json
```

3. Run the tests:
```bash
pytest python/src/tests/integration/classifier/
```

## Test Output
The test will generate a report showing:

- Current system configuration
- Results for each test case
- Routing decisions
- Confidence levels
- Success/failure status
- Overall success rate
- Confidence level distribution

Example output:

```bash
Classifier Integration Test Results
========================================
Test 1:
Input: I want to book a flight to London
Expected Agent: booking_agent
Routed To: booking_agent
Confidence: HIGH
Status: ✅ PASSED
--------------------

Summary:
Tests Passed: 1/1
Success Rate: 100.0%

```

