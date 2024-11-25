import asyncio
from typing import Any, AsyncIterable

from multi_agent_orchestrator.agents import (
    Agent,
    AgentOptions,
)
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils.logger import Logger


# Extend AgentOptions for ParallelAgent class:
class ParallelAgentOptions(AgentOptions):
    def __init__(
        self,
        agents: list[Agent],
        default_output: str = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.agents = agents
        self.default_output = default_output


# Create a new custom agent that allows for parallel processing:
class ParallelAgent(Agent):
    def __init__(self, options: ParallelAgentOptions):
        super().__init__(options)
        self.agents = options.agents
        self.default_output = (
            options.default_output or "No output generated from the ParallelAgent."
        )
        if len(self.agents) == 0:
            raise ValueError("ParallelAgent requires at least 1 agent to initiate!")

    async def _get_llm_response(
        self,
        agent: Agent,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: list[ConversationMessage],
        additional_params: dict[str, str] = None,
    ) -> str:
        # Get response from LLM agent:
        final_response: ConversationMessage | AsyncIterable[Any]

        try:
            response = await agent.process_request(
                input_text, user_id, session_id, chat_history, additional_params
            )
            if self.is_conversation_message(response):
                if response.content and "text" in response.content[0]:
                    final_response = response
                else:
                    Logger.warn(f"Agent {agent.name} returned no text content.")
                    return self.create_default_response()
            elif self.is_async_iterable(response):
                Logger.warn("Streaming is not allowed for ParallelAgents!")
                return self.create_default_response()
            else:
                Logger.warn(f"Agent {agent.name} returned an invalid response type.")
                return self.create_default_response()

        except Exception as error:
            Logger.error(
                f"Error processing request with agent {agent.name}: {str(error)}"
            )
            raise f"Error processing request with agent {agent.name}: {str(error)}"

        return final_response

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: list[ConversationMessage],
        additional_params: dict[str, str] = None,
    ) -> ConversationMessage:
        # Create tasks for all LLMs to run in parallel:
        tasks = []
        for agent in self.agents:
            tasks.append(
                self._get_llm_response(
                    agent,
                    input_text,
                    user_id,
                    session_id,
                    chat_history,
                    additional_params,
                )
            )

        # Run all tasks concurrently and wait for results:
        responses = await asyncio.gather(*tasks)

        # Create dictionary of responses:
        response_dict = {
            agent.name: response.content[0]["text"]
            for agent, response in zip(self.agents, responses)
            if response  # Only include non-empty responses!
        }

        # Convert dictionary to string representation:
        combined_response = str(response_dict)

        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": combined_response}],
        )

    @staticmethod
    def is_async_iterable(obj: any) -> bool:
        return hasattr(obj, "__aiter__")

    @staticmethod
    def is_conversation_message(response: any) -> bool:
        return (
            isinstance(response, ConversationMessage)
            and hasattr(response, "role")
            and hasattr(response, "content")
            and isinstance(response.content, list)
        )

    def create_default_response(self) -> ConversationMessage:
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": self.default_output}],
        )
