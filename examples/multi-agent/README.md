# Multi-Agent AI Orchestrator Demo

This project demonstrates the use of the multi-agent-orchestrator library with AWS Bedrock and a React frontend.

## Prerequisites

- Node.js and npm
- Python 3.12+
- AWS CLI configured with appropriate permissions for Amazon Bedrock

## Setup

1. Clone the repository:
   ```
   cd multi-agent-orchestrator-demo
   ```

2. Set up the frontend:
   ```
   npm install
   ```

3. Set up the backend:
   ```
   cd backend
   pip install -r requirements.txt
   ```

4. Configure AWS CLI:
   ```
   aws configure
   ```
   Enter your AWS Access Key ID, Secret Access Key, and preferred region.

## Running the Application

You can now run the entire demo using a single script:

```bash
chmod +x run_demo.sh
./run_demo.sh
```

## Usage

- The application will automatically test the connection to AWS Bedrock on startup.
- Use the Agent Editor to add, edit, or delete agents.
- Use the Chat interface to interact with the multi-agent system.

## Troubleshooting

- If you encounter issues with AWS Bedrock, ensure your AWS CLI is properly configured and you have the necessary permissions.
- Check the console logs in both the frontend and backend for any error messages.