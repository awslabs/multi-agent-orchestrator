---
title: AI-Powered E-commerce Support Simulator
description: How to deploy the demo AI-Powered E-commerce Support Simulator
---

This project demonstrates the practical application of AI agents and human-in-the-loop interactions in an e-commerce support context. It showcases how AI can handle customer queries efficiently while seamlessly integrating human support when needed.

## Overview

The AI-Powered E-commerce Support Simulator is designed to showcase a sophisticated customer support system that combines AI agents with human support. It demonstrates how AI can handle routine queries automatically while routing complex issues to human agents, providing a comprehensive support experience.

## Features

- AI-powered response generation for common queries
- Intelligent routing of complex issues to human support
- Real-time chat functionality
- Email-style communication option

## UI Modes

### Chat Mode

The Chat Mode provides a real-time conversation interface, simulating instant messaging between customers and the support system. It features:

- Separate chat windows for customer and support perspectives
- Real-time message updates
- Automatic scrolling to the latest message

![Chat Mode Screenshot](/multi-agent-orchestrator/chat_mode.png)

### Email Mode

The Email Mode simulates asynchronous email communication. It includes:

- Email composition interfaces for both customer and support
- Pre-defined email templates for common scenarios
- Response viewing areas for both parties

![Chat Mode Screenshot](/multi-agent-orchestrator/email_mode.png)

## Mock Data

The project includes a `mock_data.json` file for testing and demonstration purposes. This file contains sample data that simulates various customer scenarios, product information, and order details.

To view and use the mock data:

1. Navigate to the `public` directory in the project.
2. Open the `mock_data.json` file to view its contents.
3. Use the provided data to test different support scenarios and observe how the system handles various queries.

## AI and Human Interaction

This simulator demonstrates the seamless integration of AI agents and human support:

- Automated Handling: AI agents automatically process and respond to common or straightforward queries.
- Human Routing: Complex or sensitive issues are identified and routed to human support agents.
- Customer Notification: When a query is routed to human support, the customer receives an automatic confirmation.
- Support Interface: The support side of the interface allows human agents to see which messages require their attention and respond accordingly.
- Handoff Visibility: Users can observe when a query is handled by AI and when it's transferred to a human agent.

This simulator serves as a practical example of how AI and human support can be integrated effectively in a customer service environment. It demonstrates the potential for enhancing efficiency while maintaining the ability to provide personalized, human touch when necessary.# AI-Powered E-commerce Support Simulator

A demonstration of how AI agents and human support can work together in an e-commerce customer service environment. This project showcases intelligent query routing, multi-agent collaboration, and seamless human integration for complex support scenarios.

## 🎯 Key Features

- Multi-agent AI orchestration
- Real-time and asynchronous communication modes
- Integration with human support workflow
- Tool-augmented AI interactions
- Production-ready AWS architecture
- Mock data for realistic scenarios

## 🏗️ Architecture

### Agent Architecture

![Agents](/multi-agent-orchestrator/ai_e-commerce_support_system.jpg)

The system employs three specialized agents:

#### 1. Order Management Agent (Claude 3 Sonnet)
- 🎯 **Purpose**: Handles order-related inquiries
- 🛠️ **Tools**:
  - `orderlookup`: Retrieves order details
  - `shipmenttracker`: Tracks shipping status
  - `returnprocessor`: Manages returns
- ✨ **Capabilities**:
  - Real-time order tracking
  - Return processing
  - Refund handling

#### 2. Product Information Agent (Claude 3 Haiku)
- 🎯 **Purpose**: Product information and specifications
- 🧠 **Knowledge Base**: Integrated product database
- ✨ **Capabilities**:
  - Product specifications
  - Compatibility checking
  - Availability information

#### 3. Human Agent
- 🎯 **Purpose**: Complex case handling and oversight
- ✨ **Capabilities**:
  - Complex complaint resolution
  - Critical decision oversight
  - AI response verification

### AWS Infrastructure

![Infrastructure](/multi-agent-orchestrator/ai-powered_e-commerce_support_simulator.png)

#### Core Components
- 🌐 **Frontend**: React + CloudFront
- 🔌 **API**: AppSync GraphQL
- 📨 **Messaging**: SQS queues
- ⚡ **Processing**: Lambda functions
- 💾 **Storage**: DynamoDB + S3
- 🔐 **Auth**: Cognito

## 💬 Communication Modes

### Real-Time Chat
![Chat Mode](/multi-agent-orchestrator/chat_mode.png)
- Instant messaging interface
- Real-time response streaming
- Automatic routing

### Email-Style
![Email Mode](/multi-agent-orchestrator/email_mode.png)
- Asynchronous communication
- Template-based responses
- Structured conversations

## 🛠️ Mock System Integration

### Mock Data Structure
The `mock_data.json` provides realistic test data:
```json
{
  "orders": {...},
  "products": {...},
  "shipping": {...}
}
```

### Tool Integration
- Order management tools use mock database
- Shipment tracking simulates real-time updates
- Return processing demonstrates workflow

## 🚀 Deployment Guide

### Prerequisites
- AWS account with permissions
- AWS CLI configured
- Node.js and npm
- AWS CDK CLI

### Quick Start
```bash
# Clone repository
git clone https://github.com/awslabs/multi-agent-orchestrator.git
cd multi-agent-orchestrator/examples/ecommerce-support-simulator

# Install and deploy
npm install
cdk bootstrap
cdk deploy

# Create user
aws cognito-idp admin-create-user \
    --user-pool-id your-region_xxxxxxx \
    --username your@email.com \
    --user-attributes Name=email,Value=your@email.com \
    --temporary-password "MyChallengingPassword" \
    --message-action SUPPRESS \
    --region your-region
```

## 🔍 Demo Scenarios

1. **Order Management**
   - Order status inquiries
   - Shipment tracking
   - Return requests

2. **Product Support**
   - Product specifications
   - Compatibility checks
   - Availability queries

3. **Complex Cases**
   - Multi-step resolutions
   - Human escalation
   - Critical decisions

## 🧹 Cleanup
```bash
cdk destroy
```

## 🔧 Troubleshooting

Common issues and solutions:
1. **Deployment Failures**
   - Verify AWS credentials
   - Check permissions
   - Review CloudFormation logs

2. **Runtime Issues**
   - Validate mock data format
   - Check queue configurations
   - Verify Lambda logs

## ⚠️ Disclaimer

This demo application is intended solely for demonstration purposes. It is not designed for handling, storing, or processing any kind of Personally Identifiable Information (PII) or personal data. Users are strongly advised not to enter, upload, or use any PII or personal data within this application. Any use of PII or personal data is at the user's own risk and the developers of this application shall not be held responsible for any data breaches, misuse, or any other related issues. Please ensure that all data used in this demo is non-sensitive and anonymized.

For production usage, it is crucial to implement proper security measures to protect PII and personal data. This includes obtaining proper permissions from users, utilizing encryption for data both in transit and at rest, and adhering to industry standards and regulations to maximize security. Failure to do so may result in data breaches and other serious security issues.
## 📚 Additional Resources

- [Multi-Agent Orchestrator Documentation](https://github.com/awslabs/multi-agent-orchestrator)
- [AWS AppSync Documentation](https://docs.aws.amazon.com/appsync)
- [Claude API Documentation](https://docs.anthropic.com/claude/reference)


Ready to build your own multi-agent chat application? Check out the complete [source code](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/ecommerce-support-simulator) in our GitHub repository.
