import requests
from requests.exceptions import RequestException
from typing import Any
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole


weather_tool_description = [{
    "toolSpec": {
        "name": "Weather_Tool",
        "description": "Get the current weather for a given location, based on its WGS84 coordinates.",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {
                    "latitude": {
                        "type": "string",
                        "description": "Geographical WGS84 latitude of the location.",
                    },
                    "longitude": {
                        "type": "string",
                        "description": "Geographical WGS84 longitude of the location.",
                    },
                },
                "required": ["latitude", "longitude"],
            }
        },
    }
}]

weather_tool_prompt = """
You are a weather assistant that provides current weather data for user-specified locations using only
the Weather_Tool, which expects latitude and longitude. Infer the coordinates from the location yourself.
If the user provides coordinates, infer the approximate location and refer to it in your response.
To use the tool, you strictly apply the provided tool specification.

- Explain your step-by-step process, and give brief updates before each step.
- Only use the Weather_Tool for data. Never guess or make up information.
- Repeat the tool use for subsequent requests if necessary.
- If the tool errors, apologize, explain weather is unavailable, and suggest other options.
- Report temperatures in °C (°F) and wind in km/h (mph). Keep weather reports concise. Sparingly use
  emojis where appropriate.
- Only respond to weather queries. Remind off-topic users of your purpose.
- Never claim to search online, access external data, or use tools besides Weather_Tool.
- Complete the entire process until you have all required data before sending the complete response.
"""


async def weather_tool_handler(response: ConversationMessage, conversation: list[dict[str, Any]]) -> ConversationMessage:
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
                tool_response = await fetch_weather_data(tool_use_block["input"])
                tool_results.append({
                    "toolResult": {
                        "toolUseId": tool_use_block["toolUseId"],
                        "content": [{"json": {"result": tool_response}}],
                    }
                })

    # Embed the tool results in a new user message
    message = ConversationMessage(
            role=ParticipantRole.USER.value,
            content=tool_results)

    return message


async def fetch_weather_data(input_data):
    """
    Fetches weather data for the given latitude and longitude using the Open-Meteo API.
    Returns the weather data or an error message if the request fails.

    :param input_data: The input data containing the latitude and longitude.
    :return: The weather data or an error message.
    """

    endpoint = "https://api.open-meteo.com/v1/forecast"
    latitude = input_data.get("latitude")
    longitude = input_data.get("longitude", "")
    params = {"latitude": latitude, "longitude": longitude, "current_weather": True}

    try:
        response = requests.get(endpoint, params=params)
        weather_data = {"weather_data": response.json()}
        response.raise_for_status()
        return weather_data
    except RequestException as e:
        return e.response.json()
    except Exception as e:
        return {"error": type(e), "message": str(e)}