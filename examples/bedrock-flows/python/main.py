import asyncio
import uuid
import sys
from typing import Any, List
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.classifiers import ClassifierResult
from multi_agent_orchestrator.agents import AgentResponse, Agent, BedrockFlowsAgent, BedrockFlowsAgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole

async def handle_request(_orchestrator: MultiAgentOrchestrator,agent:Agent, _user_input:str, _user_id:str, _session_id:str):
    classifier_result = ClassifierResult(selected_agent=agent, confidence=1.0)
    response:AgentResponse = await _orchestrator.agent_process_request(
        _user_input,
        _user_id,
        _session_id,
        classifier_result)

    print(response.output.content[0].get('text'))


def flow_input_encoder(agent:Agent, input: str, **kwargs) -> Any:
    global flow_tech_agent
    if agent == flow_tech_agent:
        chat_history:List[ConversationMessage] = kwargs.get('chat_history', [])

        chat_history_string = '\n'.join(f"{message.role}:{message.content[0].get('text')}" for message in chat_history)

        return {
                "question": input,
                "history":chat_history_string
            }
    else:
        return input

def flow_output_decode(agent:Agent, response: Any, **kwargs) -> Any:
    global flow_tech_agent
    if agent == flow_tech_agent:
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': response}]
        )
    else:
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': response}]
        )

if __name__ == "__main__":

    # Initialize the orchestrator with some options
    orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
        LOG_AGENT_CHAT=True,
        LOG_CLASSIFIER_CHAT=True,
        LOG_CLASSIFIER_RAW_OUTPUT=True,
        LOG_CLASSIFIER_OUTPUT=True,
        LOG_EXECUTION_TIMES=True,
        MAX_RETRIES=3,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=False,
        MAX_MESSAGE_PAIRS_PER_AGENT=10
    ))

    flow_tech_agent = BedrockFlowsAgent(BedrockFlowsAgentOptions(
        name="tech-agent",
        description="Specializes in handling tech questions about AWS services",
        flowIdentifier='BEDROCK-FLOW-ID',
        flowAliasIdentifier='BEDROCK-FLOW-ALIAS-ID',
        enableTrace=False,
        flow_input_encoder=flow_input_encoder,
        flow_output_decoder=flow_output_decode
    ))
    orchestrator.add_agent(flow_tech_agent)

    USER_ID = "user123"
    SESSION_ID = str(uuid.uuid4())

    print("Welcome to the interactive Multi-Agent system. Type 'quit' to exit.")

    while True:
        # Get user input
        user_input = input("\nYou: ").strip()

        if user_input.lower() == 'quit':
            print("Exiting the program. Goodbye!")
            sys.exit()

        # Run the async function
        asyncio.run(handle_request(orchestrator, flow_tech_agent, user_input, USER_ID, SESSION_ID))