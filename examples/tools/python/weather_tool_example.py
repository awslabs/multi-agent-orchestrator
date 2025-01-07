from typing import Any
import asyncio
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent, BedrockLLMAgentOptions,
    AnthropicAgent, AnthropicAgentOptions,
    Agent
    )
from multi_agent_orchestrator.utils.tool import AgentTools, AgentTool
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole

def get_weather(city:str):
    """
        Fetches weather data for the given city using the Open-Meteo API.
        Returns the weather data or an error message if the request fails.

        :param city:  The name of the city to get weather for
        :return:  A formatted weather report for the specified city
    """
    return f'It is sunny in {city}!'

# Create a tool definition with clear name and description
weather_tool_with_func:AgentTools = AgentTools(tools=[AgentTool(
    name='get_weather',
    description="Get the current weather for a given city. Expects city name as input.",
    func=get_weather
)])

weather_tool_with_properties:AgentTools = AgentTools(tools=[AgentTool(
        name='get_weather',
        description="Get the current weather for a given city. Expects city name as input.",
        func=get_weather,
        properties={
            "city": {
                "type": "string",
                "description": "The name of the city to get weather for"
            }
        },
        required=["city"]
     )])


async def bedrock_weather_tool_handler(
        response: ConversationMessage,
        conversation: list[dict[str, Any]]
    ) -> ConversationMessage:
        """
        Handles tool execution requests from the agent and processes the results.

        This handler:
        1. Extracts tool use requests from the agent's response
        2. Executes the requested tools with provided parameters
        3. Formats the results for the agent to understand

        Parameters:
            response: The agent's response containing tool use requests
            conversation: The current conversation history

        Returns:
            A formatted message containing tool execution results
        """
        response_content_blocks = response.content
        tool_results = []

        if not response_content_blocks:
            raise ValueError("No content blocks in response")

        for content_block in response_content_blocks:
            # Handle regular text content if present
            if "text" in content_block:
                continue

            # Process tool use requests
            if "toolUse" in content_block:
                tool_use_block = content_block["toolUse"]
                tool_use_name = tool_use_block.get("name")

                if tool_use_name == "get_weather":
                    tool_response = get_weather(tool_use_block["input"].get('city'))
                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_use_block["toolUseId"],
                            "content": [{"json": {"result": tool_response}}],
                        }
                    })

        return ConversationMessage(
            role=ParticipantRole.USER.value,
            content=tool_results
        )

async def anthropic_weather_tool_handler(response: Any, conversation: list[dict[str, Any]]):
    response_content_blocks = response.content

    # Initialize an empty list of tool results
    tool_results = []

    if not response_content_blocks:
        raise ValueError("No content blocks in response")

    for content_block in response_content_blocks:
        if "text" == content_block.type:
            # Handle text content if needed
            pass

        if "tool_use" == content_block.type:

            tool_use_name = content_block.name
            input = content_block.input
            id = content_block.id

            if tool_use_name == "get_weather":
                response = get_weather(input.get('city'))
                tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": id,
                        "content": (response)
                })

    # Embed the tool results in a new user message
    message = {'role':ParticipantRole.USER.value,
            'content':tool_results
            }
    return message


# Configure and create the agent with our weather tool
weather_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name='weather-agent',
    description='Agent specialized in providing weather information for cities',
    tool_config={
        'tool': weather_tool_with_func.to_bedrock_format(),
        'toolMaxRecursions': 5,  # Maximum number of tool calls in one conversation
        'useToolHandler': bedrock_weather_tool_handler
    }
))

async def get_weather_info(agent:Agent):
        # Create a unique user and session ID for tracking conversations
        user_id = 'user123'
        session_id = 'session456'

        # Send a weather query to the agent
        response = await agent.process_request(
            "what's the weather in Paris?",
            user_id,
            session_id,
            []  # Empty conversation history for this example
        )

        # Extract and print the response
        print(response.content[0].get('text'))

# Run the async function
asyncio.run(get_weather_info(weather_agent))

weather_agent = AnthropicAgent(AnthropicAgentOptions(
     api_key='api-key',
    name='weather-agent',
    description='Agent specialized in providing weather information for cities',
    tool_config={
        'tool': weather_tool_with_properties.to_claude_format(),
        'toolMaxRecursions': 5,  # Maximum number of tool calls in one conversation
        'useToolHandler': anthropic_weather_tool_handler
    }
))

# Run the async function
asyncio.run(get_weather_info(weather_agent))


# with default Tools hanlder
weather_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name='weather-agent',
    description='Agent specialized in providing weather information for cities',
    tool_config={
        'tool': weather_tool_with_properties,
        'toolMaxRecursions': 5,  # Maximum number of tool calls in one conversation
    }
))

# Run the async function
asyncio.run(get_weather_info(weather_agent))