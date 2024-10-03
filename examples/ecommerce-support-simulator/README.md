# AI-Powered E-commerce Support Simulator

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

![Chat Mode Screenshot](./img/chat_mode.png)

### Email Mode

The Email Mode simulates asynchronous email communication. It includes:

- Email composition interfaces for both customer and support
- Pre-defined email templates for common scenarios
- Response viewing areas for both parties

![Chat Mode Screenshot](./img/email_mode.png)

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

## Getting Started

[TODO]

This simulator serves as a practical example of how AI and human support can be integrated effectively in a customer service environment. It demonstrates the potential for enhancing efficiency while maintaining the ability to provide personalized, human touch when necessary.