from orchestrator import BedrockLLMAgent, BedrockLLMAgentOptions, AgentCallbacks
from ollamaAgent import OllamaAgent, OllamaAgentOptions
import asyncio

import chainlit as cl

class ChainlitAgentCallbacks(AgentCallbacks):
    def on_llm_new_token(self, token: str) -> None:
        asyncio.run(cl.user_session.get("current_msg").stream_token(token))

def create_sonnet_3_agent():
    return BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Cloud 3 Sonnet",
        streaming=True,
        description=f"""Most reliable model, could be bit slow but thorough. 10x more expensive than Claude 3 Haiku. suitable for all types of tasks""",
        model_id="anthropic.claude-3-sonnet-20240229-v1:0",
        callbacks=ChainlitAgentCallbacks()
    ))

def create_haiku_agent():
    return BedrockLLMAgent(BedrockLLMAgentOptions(
        name="Cloud 3 Haiku",
        streaming=True,
        description=f"""Cheaper, faster and reliable model. suitable for all types of tasks""",
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        callbacks=ChainlitAgentCallbacks()
    ))

def create_llama_agent():
    return OllamaAgent(OllamaAgentOptions(
       name="Ollama Local Agent",
        model_id="llama3.2:latest",
        description=f"""Could be less reliable, private model. but no cost in using it. suitable for all types of tasks""",
        streaming=True,
        callbacks=ChainlitAgentCallbacks()
    ))
