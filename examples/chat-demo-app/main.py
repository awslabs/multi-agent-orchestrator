import os
import asyncio
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator
from multi_agent_orchestrator.agents import BedrockLLMAgent, LexBotAgent, BedrockLLMAgentOptions, LexBotAgentOptions, AgentCallbacks, SalesforceAgentforceAgent, SalesforceAgentforceAgentOptions

orchestrator = MultiAgentOrchestrator()

class BedrockLLMAgentCallbacks(AgentCallbacks):
    def on_llm_new_token(self, token: str) -> None:
        # handle response streaming here
        print(token, end='', flush=True)

tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
  name="Tech Agent",
  streaming=True,
  description="Specializes in technology areas including software development, hardware, AI, \
  cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs \
  related to technology products and services.",
  model_id="anthropic.claude-3-sonnet-20240229-v1:0",
  callbacks=BedrockLLMAgentCallbacks()
))
orchestrator.add_agent(tech_agent)


# Add a Lex Bot Agent for handling travel-related queries
orchestrator.add_agent(
    LexBotAgent(LexBotAgentOptions(
        name="Travel Agent",
        description="Helps users book and manage their flight reservations",
        bot_id=os.environ.get('LEX_BOT_ID'),
        bot_alias_id=os.environ.get('LEX_BOT_ALIAS_ID'),
        locale_id="en_US",
    ))
)

# Add a Salesforce Agentforce Agent for handling Salesforce-related queries
orchestrator.add_agent(
    SalesforceAgentforceAgent(SalesforceAgentforceAgentOptions(
        name="Salesforce Agent",
        description="Handles queries related to Salesforce",
        client_id=os.environ.get('SALESFORCE_CLIENT_ID'),
        client_secret=os.environ.get('SALESFORCE_CLIENT_SECRET'),
        domain_url=os.environ.get('SALESFORCE_DOMAIN_URL'),
        agent_id=os.environ.get('SALESFORCE_AGENT_ID'),
        locale_id="en_US",
    ))
)

async def main():
    # Example usage
    response = await orchestrator.route_request(
        "I want to book a flight",
        'user123',
        'session456'
    )

    # Handle the response (streaming or non-streaming)
    if response.streaming:
        print("\n** RESPONSE STREAMING ** \n")
        # Send metadata immediately
        print(f"> Agent ID: {response.metadata.agent_id}")
        print(f"> Agent Name: {response.metadata.agent_name}")
        print(f"> User Input: {response.metadata.user_input}")
        print(f"> User ID: {response.metadata.user_id}")
        print(f"> Session ID: {response.metadata.session_id}")
        print(f"> Additional Parameters: {response.metadata.additional_params}")
        print("\n> Response: ")

        # Stream the content
        async for chunk in response.output:
            if isinstance(chunk, str):
                print(chunk, end='', flush=True)
            else:
                print(f"Received unexpected chunk type: {type(chunk)}", file=sys.stderr)

    else:
        # Handle non-streaming response (AgentProcessingResult)
        print("\n** RESPONSE ** \n")
        print(f"> Agent ID: {response.metadata.agent_id}")
        print(f"> Agent Name: {response.metadata.agent_name}")
        print(f"> User Input: {response.metadata.user_input}")
        print(f"> User ID: {response.metadata.user_id}")
        print(f"> Session ID: {response.metadata.session_id}")
        print(f"> Additional Parameters: {response.metadata.additional_params}")
        print(f"\n> Response: {response.output.content}")

if __name__ == "__main__":
    asyncio.run(main())
