from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent,
    BedrockLLMAgentOptions,
    AgentStreamResponse,
)

from multi_agent_orchestrator.classifiers import BedrockClassifier, BedrockClassifierOptions

orchestrator = None

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

def setup_orchestrator():
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

    tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Tech agent",
        streaming=True,
        description="Expert in Technology and AWS services",
        save_chat=False,
    ))

    health = BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Health agent",
        streaming=True,
        description="Expert health",
        save_chat=False,
    ))

    orchestrator.add_agent(tech_agent)
    orchestrator.add_agent(health)

    return orchestrator


async def response_generator(query, user_id, session_id):

    response = await orchestrator.route_request(query, user_id, session_id, None, True)

    if response.streaming:
        async for chunk in response.output:
            if isinstance(chunk, AgentStreamResponse):
                yield chunk.text


@app.post("/stream_chat/")
async def stream_chat(body: Body):
    return StreamingResponse(response_generator(body.content, body.user_id, body.session_id), media_type="text/event-stream")


orchestrator = setup_orchestrator()