---
title: FastAPI Streaming
description: How to deploy use FastAPI Streaming with Multi-Agent Orchestrator
---

This example demonstrates how to implement streaming responses with the Multi-Agent Orchestrator using FastAPI. It shows how to build a simple API that streams responses from multiple AI agents in real-time.

## Features
- Real-time streaming responses using FastAPI's `StreamingResponse`
- Custom streaming handler implementation
- Multiple agent support (Tech and Health agents)
- Queue-based token streaming
- CORS-enabled API endpoint

## Quick Start
```bash
# Install dependencies
pip install "fastapi[all]" multi-agent-orchestrator

# Run the server
uvicorn app:app --reload
```

## API Endpoint

```bash
POST /stream_chat/
```

Request body:
```json
{
    "content": "your question here",
    "user_id": "user123",
    "session_id": "session456"
}
```

## Implementation Highlights
- Uses FastAPI's event streaming capabilities
- Custom callback handler for real-time token streaming
- Thread-safe queue implementation for token management
- Configurable orchestrator with multiple specialized agents
- Error handling and proper stream closure

## Example Usage
```python
import requests

response = requests.post(
    'http://localhost:8000/stream_chat/',
    json={
        'content': 'What are the latest AI trends?',
        'user_id': 'user123',
        'session_id': 'session456'
    },
    stream=True
)

for chunk in response.iter_content():
    print(chunk.decode(), end='', flush=True)
```

Ready to build your own multi-agent chat application? Check out the complete [source code](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/fast-api-streaming) in our GitHub repository.
