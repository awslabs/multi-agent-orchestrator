---
title: Demo Web App Deployment
description: How to deploy the demo chat web application for the Multi-Agent Orchestrator System
---

## 📘 Overview

The Multi-Agent Orchestrator System includes a demo chat web application that showcases the capabilities of the system. This application is built using AWS CDK (Cloud Development Kit) and can be easily deployed to your AWS account.

## 📋 Prerequisites

Before deploying the demo web app, ensure you have the following:

1. An AWS account with appropriate permissions
2. AWS CLI installed and configured with your credentials
3. Node.js and npm installed on your local machine
4. AWS CDK CLI installed (`npm install -g aws-cdk`)

## 🚀 Deployment Steps

Follow these steps to deploy the demo chat web application:

1. **Clone the Repository** (if you haven't already):
   ```
   git clone https://github.com/your-repo/multi-agent-orchestrator.git
   cd multi-agent-orchestrator
   ```

2. **Navigate to the Demo Web App Directory**:
   ```
   cd examples/chat-demo-app
   ```

3. **Install Dependencies**:
   ```
   npm install
   ```

4. **Bootstrap AWS CDK** (if you haven't used CDK in this AWS account/region before):
   ```
   cdk bootstrap
   ```

5. **Review and Customize the Stack** (optional):
   Open `chat-demo-app/cdk.json` and review the configuration. You can customize aspects of the deployment by enabling or disabling additional agents.

   ```
   "context": {
    "enableLexAgent": true,
    "enableAmazonBedrockAgent": true,
   ...
   ```

   **enableLexAgent:** Enable the sample Airlines Bot (See AWS Blogpost [here](https://aws.amazon.com/blogs/machine-learning/automate-the-customer-service-experience-for-flight-reservations-using-amazon-lex/))
   **enableAmazonBedrockAgent:** Enable the sample Amazon Bedrock Agent with prefined knowledge base about restaurant's menu (See knowledge base documents [here](TODO:provide the link to github))


6. **Deploy the Application**:
   ```
   cdk deploy
   ```

7. **Confirm Deployment**:
   CDK will show you a summary of the changes and ask for confirmation. Type 'y' and press Enter to proceed.

8. **Note the Outputs**:
   After deployment, CDK will display outputs including the URL of your deployed web app and the user pool ID. 
   Save the URL and the user pool Id.

9. **Create a user in Amazon Cognito user pool**:
```
aws cognito-idp admin-create-user \
    --user-pool-id your-region_xxxxxxx  \
    --username your@email.com \
    --user-attributes Name=email,Value=your@email.com \
    --temporary-password "MyChallengingPassword" \
    --message-action SUPPRESS \
    --region your-region
````

## 🌐 Accessing the Demo Web App

Once deployment is complete, you can access the demo chat web application by:

1. Opening the URL provided in the CDK outputs in your web browser.
2. Logging in with the temporary credentials provided (if applicable).


## ✅ Testing the Deployment

To ensure the deployment was successful:

1. Open the web app URL in your browser.
2. Try sending a few messages to test the multi-agent system.
3. Verify that you receive appropriate responses from different agents.

## 🧹 Cleaning Up

To avoid incurring unnecessary AWS charges, remember to tear down the deployment when you're done:

```
cdk destroy
```

Confirm the deletion when prompted.

## 🛠️ Troubleshooting

If you encounter issues during deployment:

1. Ensure your AWS credentials are correctly configured.
2. Check that you have the necessary permissions in your AWS account.
3. Verify that all dependencies are correctly installed.
4. Review the AWS CloudFormation console for detailed error messages if the deployment fails.

## ➡️ Next Steps

After successfully deploying the demo web app, you can:

1. Customize the web interface in the source code.
2. Modify the agent configurations to test different scenarios.
3. Integrate additional AWS services to enhance the application's capabilities.

By deploying this demo web app, you can interact with your Multi-Agent Orchestrator System in a user-friendly interface, showcasing its capabilities and helping you understand how it performs in a real-world scenario.

## ⚠️ Disclamer
This demo application is intended solely for demonstration purposes. It is not designed for handling, storing, or processing any kind of Personally Identifiable Information (PII) or personal data. Users are strongly advised not to enter, upload, or use any PII or personal data within this application. Any use of PII or personal data is at the user's own risk and the developers of this application shall not be held responsible for any data breaches, misuse, or any other related issues. Please ensure that all data used in this demo is non-sensitive and anonymized.

For production usage, it is crucial to implement proper security measures to protect PII and personal data. This includes obtaining proper permissions from users, utilizing encryption for data both in transit and at rest, and adhering to industry standards and regulations to maximize security. Failure to do so may result in data breaches and other serious security issues.