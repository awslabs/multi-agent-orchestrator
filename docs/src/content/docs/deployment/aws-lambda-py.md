---
title: AWS Lambda Python 
description: How to deploy the Multi-Agent Orchestrator System to AWS Lambda using Python
---

This guide walks you through deploying the Multi-Agent Orchestrator System to AWS Lambda using Python. It includes support for both streaming and non-streaming responses, allowing you to run your multi-agent setup in a serverless environment.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI installed and configured
- Python 3.8 or later installed
- Basic familiarity with AWS Lambda, API Gateway, and Boto3

## Deployment Steps

1. **Install Required Libraries**

   Create a new directory for your project and navigate to it:

   ```bash
   mkdir multi-agent-lambda && cd multi-agent-lambda
   ```

   Create a virtual environment and activate it:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

   Install the required packages:

   ```bash
   pip install multi-agent-orchestrator boto3
   ```

   After installation, create a requirements.txt file:

   ```bash
   pip freeze > requirements.txt
   ```

2. **Prepare Your Code**

   Create a new file, e.g., `lambda_function.py`, and add the following code:

   ```python
   import json
   from typing import Dict, Any
   from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
   from multi_agent_orchestrator.agents import (
       BedrockLLMAgent,
       BedrockLLMAgentOptions
   )

   # Initialize orchestrator
   orchestrator = MultiAgentOrchestrator(OrchestratorConfig(
       LOG_AGENT_CHAT=True,
       LOG_CLASSIFIER_CHAT=True,
       LOG_CLASSIFIER_RAW_OUTPUT=True,
       LOG_CLASSIFIER_OUTPUT=True,
       LOG_EXECUTION_TIMES=True
   ))

   # Add agents
   tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
     name="Tech Agent",
     streaming=True,
     description="Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
     model_id="anthropic.claude-3-sonnet-20240229-v1:0",
     inference_config={
         "temperature": 0.1
     }
   ))

   health_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
     name="Health Agent",
     description="Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts."
   ))

   orchestrator.add_agent(tech_agent)
   orchestrator.add_agent(health_agent)

   def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
       # Parse the incoming event
       body = json.loads(event.get('body', '{}'))
       query = body.get('query')
       user_id = body.get('userId')
       session_id = body.get('sessionId')

       # Route the request
       response = orchestrator.route_request(query, user_id, session_id)

       # Format the response
       formatted_response = {
           "statusCode": 200,
           "headers": {
               "Content-Type": "application/json"
           },
           "body": json.dumps({
               "metadata": response.metadata.__dict__,
               "streaming": response.streaming
           }),
           "isBase64Encoded": False
       }

       if response.streaming:
           # For streaming responses, collect all chunks
           chunks = [chunk for chunk in response.output]
           formatted_response["body"] = json.dumps({
               "metadata": response.metadata.__dict__,
               "chunks": chunks,
               "streaming": True
           })
       else:
           # For non-streaming responses, include the full output
           formatted_response["body"] = json.dumps({
               "metadata": response.metadata.__dict__,
               "output": response.output.content,
               "streaming": False
           })

       return formatted_response
   ```

3. **Package Your Code**

   Create a deployment package by zipping your `lambda_function.py` file and the `site-packages` directory from your virtual environment:

   ```bash
   pip install --target ./package multi-agent-orchestrator boto3
   cd package
   zip -r ../deployment-package.zip .
   cd ..
   zip -g deployment-package.zip lambda_function.py
   ```

4. **Deploy Your Code**

   Upload the `deployment-package.zip` file to your Lambda function using the AWS Management Console or AWS CLI.

5. **Configure IAM Permissions**

   Ensure your Lambda function's execution role has permissions to:
   - Invoke Amazon Bedrock models
   - Write to CloudWatch Logs

6. **Configure Lambda Function**

   - Set the runtime to Python 3.8 or later.
   - Set the handler to `lambda_function.lambda_handler`.

7. **Test Your Deployment**

   Use the AWS CLI to invoke your Lambda function:

   ```bash
   aws lambda invoke --function-name your-function-name --payload '{"body": "{\"query\": \"What is artificial intelligence?\", \"userId\": \"user123\", \"sessionId\": \"session456\"}"}' output.json
   ```

   Check the `output.json` file for the response.


## Considerations

- Be aware of Lambda execution time limits for long-running conversations.
- Monitor your Lambda function's performance and adjust the timeout and memory settings as needed.
- Consider implementing error handling and retry logic in your client application.
- For true real-time streaming, you may need to use API Gateway with WebSocket support. The current implementation collects all chunks before sending the response.

By following these steps, you'll have your Multi-Agent Orchestrator System running in AWS Lambda using Python, ready to handle both streaming and non-streaming responses in a serverless architecture.