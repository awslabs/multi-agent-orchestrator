---
title: AWS Lambda Python with Multi-Agent Orchestrator
description: How to set up the Multi-Agent Orchestrator System for AWS Lambda using Python
---

The Multi-Agent Orchestrator framework can be used inside an AWS Lambda function like any other library. This guide outlines the process of setting up the Multi-Agent Orchestrator System for use with AWS Lambda using Python.

## Prerequisites

- AWS account with appropriate permissions
- Python 3.12 or later installed
- Basic familiarity with AWS Lambda and Python

## Installation and Setup

1. **Create a New Project Directory**

   ```bash
   mkdir multi-agent-lambda && cd multi-agent-lambda
   ```

2. **Create and Activate a Virtual Environment**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

3. **Install the Multi-Agent Orchestrator Framework**

   ```bash
   pip install multi-agent-orchestrator boto3
   ```

4. **Create Requirements File**

   ```bash
   pip freeze > requirements.txt
   ```

## Lambda Function Structure

Create a new file named `lambda_function.py` in your project directory. Here's a high-level overview of what your Lambda function should include:

```python
import json
from typing import Dict, Any
from multi_agent_orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import BedrockLLMAgent, BedrockLLMAgentOptions

# Initialize orchestrator
orchestrator = MultiAgentOrchestrator(OrchestratorConfig(
    # Configuration options
))

# Add agents
tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    # Agent configuration
))

orchestrator.add_agent(tech_agent)

async def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    try:
        user_input = event.get('query')
        user_id = event.get('userId')
        session_id = event.get('sessionId')
        response = await orchestrator.route_request(user_input, user_id, session_id)
        return response
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal Server Error"})
        }
```

Customize the orchestrator configuration and agent setup according to your specific requirements.

## Deployment

Use your preferred method to deploy the Lambda function (e.g., AWS CDK, Terraform, Serverless Framework, AWS SAM, or manual deployment through AWS Console).

## IAM Permissions

Ensure your Lambda function's execution role has permissions to:
- Invoke Amazon Bedrock models
- Write to CloudWatch Logs

