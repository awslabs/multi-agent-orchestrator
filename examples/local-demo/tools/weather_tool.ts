// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ConversationMessage, ParticipantRole } from "multi-agent-orchestrator";

export const  weatherToolDescription = [
    {
      toolSpec: {
            name: "Weather_Tool",
            description: "Get the current weather for a given location, based on its WGS84 coordinates.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        latitude: {
                            type: "string",
                            description: "Geographical WGS84 latitude of the location.",
                        },
                        longitude: {
                            type: "string",
                            description: "Geographical WGS84 longitude of the location.",
                        },
                    },
                    required: ["latitude", "longitude"],
                }
            },
        }
    }
];

export const WEATHER_PROMPT = `
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
`

interface InputData {
    latitude: number;
    longitude: number;
}

interface WeatherData {
    weather_data?: any;
    error?: string;
    message?: string;
}

export async function weatherToolHanlder(response:ConversationMessage, conversation: ConversationMessage[]): Promise<ConversationMessage>{

    const responseContentBlocks = response.content as any[];

    // Initialize an empty list of tool results
    let toolResults:any = []

    if (!responseContentBlocks) {
      throw new Error("No content blocks in response");
    }
    for (const contentBlock of responseContentBlocks) {
        if ("text" in contentBlock) {
        }
        if ("toolUse" in contentBlock) {
            const toolUseBlock = contentBlock.toolUse;
            const toolUseName = toolUseBlock.name;

            if (toolUseName === "Weather_Tool") {
                const response = await fetchWeatherData({latitude: toolUseBlock.input.latitude, longitude: toolUseBlock.input.longitude});
                toolResults.push({
                    "toolResult": {
                        "toolUseId": toolUseBlock.toolUseId,
                        "content": [{ json: { result: response } }],
                    }
                });
            }
        }
    }
    // Embed the tool results in a new user message
    const message:ConversationMessage = {role: ParticipantRole.USER, content: toolResults};

    return message;
}

async function fetchWeatherData(inputData: InputData): Promise<WeatherData> {
    const endpoint = "https://api.open-meteo.com/v1/forecast";
    const { latitude, longitude } = inputData;
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude?.toString() || "",
      current_weather: "true",
    });

    try {
      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json() as any;
      if (!response.ok) {
        return { error: 'Request failed', message: data.message || 'An error occurred' };
      }

      return { weather_data: data };
    } catch (error: any) {
      return { error: error.name, message: error.message };
    }
  }