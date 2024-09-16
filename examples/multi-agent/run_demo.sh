#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if AWS CLI is installed
if ! command_exists aws; then
    echo "AWS CLI is not installed. Please install it and configure your credentials."
    exit 1
fi

# Verify AWS configuration
if ! aws sts get-caller-identity &>/dev/null; then
    echo "AWS CLI is not configured properly. Please run 'aws configure' and set up your credentials."
    exit 1
fi

echo "AWS configuration verified successfully."

# Check if Python is installed
if ! command_exists python3; then
    echo "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
fi

# Check if Node.js is installed
if ! command_exists node; then
    echo "Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
pip3 install -r requirements.txt
pip3 install fastapi uvicorn boto3 multi-agent-orchestrator
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install

# # Test Bedrock connection
# echo "Testing Bedrock connection..."
# python3 backend/test_bedrock.py

# # Ask user if they want to continue
# read -p "Do you want to continue with starting the servers? (y/n) " -n 1 -r
# echo
# if [[ ! $REPLY =~ ^[Yy]$ ]]
# then
#     echo "Exiting..."
#     exit 1
# fi

# Start the backend
echo "Starting the backend..."
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

# Start the frontend
echo "Starting the frontend..."
export NODE_OPTIONS=--openssl-legacy-provider
npm start &
FRONTEND_PID=$!

# Wait for user input to stop the servers
echo "Press Enter to stop the servers..."
read

# Stop the servers
kill $BACKEND_PID
kill $FRONTEND_PID

echo "Servers stopped."