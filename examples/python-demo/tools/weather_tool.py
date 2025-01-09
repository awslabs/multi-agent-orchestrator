import requests
from requests.exceptions import RequestException
from typing import List, Dict, Any
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import AgentTool, AgentTools
import json

async def fetch_weather_data(latitude:str, longitude:str):
    """
    Fetches weather data for the given latitude and longitude using the Open-Meteo API.
    Returns the weather data or an error message if the request fails.

    :param latitude: the latitude of the location
    :param longitude: the longitude of the location
    :return: The weather data or an error message.
    """
    endpoint = "https://api.open-meteo.com/v1/forecast"
    latitude = latitude
    longitude = longitude
    params = {"latitude": latitude, "longitude": longitude, "current_weather": True}
    try:
        response = requests.get(endpoint, params=params)
        weather_data = {"weather_data": response.json()}
        response.raise_for_status()
        return json.dumps(weather_data)
    except RequestException as e:
        return json.dumps(e.response.json())
    except Exception as e:
        return {"error": type(e), "message": str(e)}


weather_tools:AgentTools = AgentTools(tools=[AgentTool(name="Weather_Tool",
                            description="Get the current weather for a given location, based on its WGS84 coordinates.",
                            func=fetch_weather_data
                            )])

weather_tool_prompt = """
You are a weather assistant that provides current weather data for user-specified locations using only
the Weather_Tool, which expects latitude and longitude. Infer the coordinates from the location yourself.
If the user provides coordinates, infer the approximate location and refer to it in your response.
To use the tool, you strictly apply the provided tool specification.

- Only use the Weather_Tool for data. Never guess or make up information.
- Repeat the tool use for subsequent requests if necessary.
- If the tool errors, apologize, explain weather is unavailable, and suggest other options.
- Report temperatures in °C (°F) and wind in km/h (mph). Keep weather reports concise. Sparingly use
  emojis where appropriate.
- Only respond to weather queries. Remind off-topic users of your purpose.
- Never claim to search online, access external data, or use tools besides Weather_Tool.
- Complete the entire process until you have all required data before sending the complete response.
"""


async def anthropic_weather_tool_handler(response: Any, conversation: List[Dict[str, Any]]):
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

            if tool_use_name == "Weather_Tool":
                response = await fetch_weather_data(input.get('latitude'), input.get('longitude'))
                tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": id,
                        "content": response
                })

    # Embed the tool results in a new user message
    message = {'role':ParticipantRole.USER.value,
            'content':tool_results
            }
    return message


async def bedrock_weather_tool_handler(response: ConversationMessage, conversation: List[Dict[str, Any]]) -> ConversationMessage:
    response_content_blocks = response.content

    # Initialize an empty list of tool results
    tool_results = []

    if not response_content_blocks:
        raise ValueError("No content blocks in response")

    for content_block in response_content_blocks:
        if "text" in content_block:
            # Handle text content if needed
            pass

        if "toolUse" in content_block:
            tool_use_block = content_block["toolUse"]
            tool_use_name = tool_use_block.get("name")

            if tool_use_name == "Weather_Tool":
                tool_response = await fetch_weather_data(tool_use_block["input"].get('latitude'), tool_use_block["input"].get('longitude'))
                tool_results.append({
                    "toolResult": {
                        "toolUseId": tool_use_block["toolUseId"],
                        "content": [{"text": tool_response}],
                    }
                })

    # Embed the tool results in a new user message
    message = ConversationMessage(
            role=ParticipantRole.USER.value,
            content=tool_results)

    return message

