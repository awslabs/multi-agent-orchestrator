# AI-Powered E-commerce Support Simulator

A demonstration of how AI agents and human support can work together in an e-commerce customer service environment. This project showcases intelligent query routing, multi-agent collaboration, and seamless human integration for complex support scenarios.

## 🎯 Key Features

- Multi-agent AI orchestration with specialized models
- Real-time and asynchronous communication modes
- Seamless integration with human support workflow
- Tool-augmented AI interactions
- Production-ready AWS architecture
- Mock data for realistic scenarios

## 💻 Interface & Communication Modes

The system provides two distinct interaction modes to accommodate different support scenarios and user preferences:

### Real-Time Chat Interface
![Chat Mode](./img/chat_mode.png)

The chat interface provides immediate, conversational support:
- Instant messaging-style communication
- Live message streaming
- Real-time agent responses
- Automatic message routing
- Separate chat windows for customer and support perspectives

### Email-Style Communication
![Email Mode](./img/email_mode.png)

The email interface supports structured, asynchronous communication:
- Email composition interfaces for both customer and support
- Pre-defined templates for common scenarios
- Response viewing areas for both parties
- Asynchronous message handling
- Template support for standardized responses

### Key Features Across Both Modes

Both interfaces demonstrate:
1. **AI Capabilities**: Natural language understanding, context retention, appropriate tool usage
2. **Human Integration**: Seamless handoffs, verification workflows, complex case handling
3. **Tool Usage**: Order lookup, shipment tracking, return processing
4. **System Intelligence**: Query classification, routing decisions, escalation handling

## 🏗️ System Architecture

### Agent Architecture

![Agents](./img/ai_e-commerce_support_system.png)

The system employs multiple specialized AI agents, each designed for specific tasks:

#### 1. Order Management Agent
- **Model**: Anthropic Claude 3 Sonnet
- **Purpose**: Handles all order-related inquiries
- **Custom Tools**:
  - `orderlookup`: Retrieves detailed order information
  - `shipmenttracker`: Provides real-time shipping status
  - `returnprocessor`: Initiates and manages return requests
- **Key Features**:
  - Accesses order database
  - Tracks shipments in real-time
  - Processes return requests
  - Handles refund inquiries

#### 2. Product Information Agent
- **Model**: Anthropic Claude 3 Haiku
- **Purpose**: Provides detailed product information and specifications
- **Key Features**:
  - Integrates with product knowledge base
  - Provides availability information
  - Handles specification inquiries

#### 3. Human Agent (Custom Implementation)
- **Type**: Custom agent implementation
- **Purpose**: Handles complex cases and verifies AI responses
- **Key Features**:
  - Handles complex customer complaints
  - Provides human oversight for critical decisions

### AWS Infrastructure

![Infrastructure](./img/ai-powered_e-commerce_support_simulator.png)

The system is built on AWS with the following key components:

- **Frontend**: React-based web application served via CloudFront
- **API Layer**: AppSync GraphQL API
- **Message Routing**: SQS queues for reliable message delivery
- **Processing**: Lambda functions for message handling
- **Storage**: 
  - DynamoDB for conversation history
  - S3 for static assets
- **Authentication**: Cognito user pools and identity pools
- **Monitoring**: Built-in logging and debugging capabilities

### Mock Data
The system includes a comprehensive `mock_data.json` file that provides sample order information

## 📋 Deployment

Before deploying the demo web app, ensure you have the following:

1. An AWS account with appropriate permissions
2. AWS CLI installed and configured with your credentials
3. Node.js and npm installed on your local machine
4. AWS CDK CLI installed (`npm install -g aws-cdk`)

## 🚀 Deployment Steps

Follow these steps to deploy the demo chat web application:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/awslabs/multi-agent-orchestrator.git
   cd multi-agent-orchestrator/examples/ecommerce-support-simulator
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Bootstrap AWS CDK**:
   ```bash
   cdk bootstrap
   ```

4. **Deploy the Application**:
   ```bash
   cdk deploy
   ```

5. **Create a user in Amazon Cognito user pool**:
   ```bash
   aws cognito-idp admin-create-user \
       --user-pool-id your-region_xxxxxxx  \
       --username your@email.com \
       --user-attributes Name=email,Value=your@email.com \
       --temporary-password "MyChallengingPassword" \
       --message-action SUPPRESS \
       --region your-region
   ```

## 🌐 Accessing the Demo Web App

Once deployment is complete:
1. Open the URL provided in the CDK outputs in your web browser
2. Log in with the created credentials

## 🧹 Cleaning Up

To avoid incurring unnecessary AWS charges:
```bash
cdk destroy
```

## 🔧 Troubleshooting

If you encounter issues during deployment:

1. Ensure your AWS credentials are correctly configured
2. Check that you have the necessary permissions in your AWS account
3. Verify that all dependencies are correctly installed
4. Review the AWS CloudFormation console for detailed error messages if the deployment fails

## ⚠️ Disclaimer

This demo application is intended solely for demonstration purposes. It is not designed for handling, storing, or processing any kind of Personally Identifiable Information (PII) or personal data. Users are strongly advised not to enter, upload, or use any PII or personal data within this application. Any use of PII or personal data is at the user's own risk and the developers of this application shall not be held responsible for any data breaches, misuse, or any other related issues. Please ensure that all data used in this demo is non-sensitive and anonymized.

For production usage, it is crucial to implement proper security measures to protect PII and personal data. This includes obtaining proper permissions from users, utilizing encryption for data both in transit and at rest, and adhering to industry standards and regulations to maximize security. Failure to do so may result in data breaches and other serious security issues.