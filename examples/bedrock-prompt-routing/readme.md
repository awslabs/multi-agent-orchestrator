# Bedrock Prompt Routing Example

This guide demonstrates how to implement and utilize [Amazon Bedrock Prompt Routing](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html) functionality with your `BedrockClassifier` or `BedrockLLMAgent`. Prompt routing helps optimize model selection based on your input patterns, improving both performance and cost-effectiveness.

## Prerequisites
Before running this example, ensure you have:

- An active AWS account with Bedrock access
- Python installed on your system (version 3.11 or higher recommended)
- The AWS SDK for Python (Boto3) installed
- Appropriate IAM permissions configured for Bedrock access

## Installation

First, install the required dependencies by running:

```bash
pip install boto3 multi-agent-orchestrator
```

export your AWS_ACCOUNT_ID variable by running:
```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

## Running the Example

```bash
python main.py
```

