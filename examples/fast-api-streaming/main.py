import asyncio
from typing import AsyncIterable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, AgentResponse, OrchestratorConfig
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent,
    AgentResponse,
    AgentCallbacks,
    BedrockLLMAgentOptions,
)

from multi_agent_orchestrator.classifiers import BedrockClassifier, BedrockClassifierOptions, AnthropicClassifier, AnthropicClassifierOptions

from typing import Dict, List, Any

import uuid
import asyncio
import argparse
from queue import Queue, Empty
from threading import Thread

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Body(BaseModel):
    content: str
    user_id: str
    session_id: str

class MyCustomHandler(AgentCallbacks):
    def __init__(self, queue) -> None:
        super().__init__()
        self._queue = queue
        self._stop_signal = None
        print("Custom handler Initialized")

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self._queue.put_nowait(token)

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> None:
        print("generation started")

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        print("\n\ngeneration concluded")

        self._queue.put_nowait(self._stop_signal)

def setup_orchestrator(streamer_queue):
    # Initialize the orchestrator
    orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
        LOG_AGENT_CHAT=True,
        LOG_CLASSIFIER_CHAT=True,
        LOG_CLASSIFIER_RAW_OUTPUT=True,
        LOG_CLASSIFIER_OUTPUT=True,
        LOG_EXECUTION_TIMES=True,
        MAX_RETRIES=3,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
        NO_SELECTED_AGENT_MESSAGE="Please rephrase",
        MAX_MESSAGE_PAIRS_PER_AGENT=10
        ),
        classifier =  BedrockClassifier(BedrockClassifierOptions())
    )

    my_handler = MyCustomHandler(streamer_queue)

    tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Tech agent",
        streaming=True,
        description="Expert in Technology and AWS services",
        save_chat=False,
        callbacks=my_handler
    ))

    health = BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Health agent",
        streaming=True,
        description="Expert health",
        save_chat=False,
        callbacks=my_handler
    ))

    orchestrator.add_agent(tech_agent)
    orchestrator.add_agent(health)

    return orchestrator


async def start_generation(query, user_id, session_id, streamer_queue):
    try:
        # Create a new orchestrator for this query
        orchestrator = setup_orchestrator(streamer_queue)

        response = await orchestrator.route_request(query, user_id, session_id)
        if isinstance(response, AgentResponse) and response.streaming is False:
            if isinstance(response.output, str):
                streamer_queue.put_nowait(response.output)
            elif isinstance(response.output, ConversationMessage):
                streamer_queue.put_nowait(response.output.content[0].get('text'))
    except Exception as e:
        print(f"Error in start_generation: {e}")
    finally:
        streamer_queue.put_nowait(None)  # Signal the end of the response

async def response_generator(query, user_id, session_id):
    streamer_queue = asyncio.Queue()

    # Start the generation process in a separate thread
    Thread(target=lambda: asyncio.run(start_generation(query, user_id, session_id, streamer_queue))).start()

    print("Waiting for the response...")
    while True:
        try:
            try:
                value = streamer_queue.get_nowait()  # or q.get_nowait()
                if value is None:
                    break
                yield value
                streamer_queue.task_done()
            except asyncio.QueueEmpty:
                pass
        except Exception as e:
            print(f"Error in response_generator: {str(e)}")
            break

@app.post("/stream_chat/")
async def stream_chat(body: Body):
    return StreamingResponse(response_generator(body.content, body.user_id, body.session_id), media_type="text/event-stream")