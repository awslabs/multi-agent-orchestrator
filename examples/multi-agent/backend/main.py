import os
import json
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
from multi_agent_orchestrator import (
    MultiAgentOrchestrator, BedrockLLMAgent, BedrockLLMAgentOptions
)
from duckduckgo_search import DDGS
from typing import List, Optional
import asyncio
import requests

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the orchestrator
orchestrator = MultiAgentOrchestrator()

# Initialize Bedrock client
bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1'  # Replace with your preferred region
)

# Initialize Lambda client
lambda_client = boto3.client('lambda', region_name='us-east-1')  # Replace with your preferred region

AGENTS_FILE = 'agents.json'

def load_agents():
    if os.path.exists(AGENTS_FILE):
        with open(AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_agents(agents):
    with open(AGENTS_FILE, 'w') as f:
        json.dump(agents, f)

# Web search function
async def web_search(query: str, num_results: int = 3) -> List[str]:
    with DDGS() as ddgs:
        results = [r for r in ddgs.text(query, max_results=num_results)]
    return [f"{r['title']}: {r['body']}" for r in results]

# Custom tool for web search
class WebSearchTool:
    def __init__(self):
        self.name = "web_search"
        self.description = "Search the web for information"

    async def run(self, query: str) -> str:
        return json.dumps(await web_search(query))

# Weather tool
class WeatherTool:
    def __init__(self):
        self.name = "weather"
        self.description = "Get weather information for a location"

    async def run(self, location: str) -> str:
        api_key = os.getenv("OPENWEATHERMAP_API_KEY")
        url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={api_key}&units=metric"
        response = requests.get(url)
        data = response.json()
        if response.status_code == 200:
            weather = data["weather"][0]["description"]
            temp = data["main"]["temp"]
            return f"The weather in {location} is {weather} with a temperature of {temp}°C"
        else:
            return f"Error: Unable to fetch weather data for {location}"

# Custom LambdaAgent implementation
class LambdaAgent:
    def __init__(self, name: str, description: str, lambda_function_name: str):
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.lambda_function_name = lambda_function_name

    async def process(self, message: str):
        try:
            response = lambda_client.invoke(
                FunctionName=self.lambda_function_name,
                InvocationType='RequestResponse',
                Payload=json.dumps({'message': message})
            )
            return json.loads(response['Payload'].read().decode('utf-8'))
        except Exception as e:
            return f"Error invoking Lambda function: {str(e)}"

# Load existing agents
agents = load_agents()
for agent_data in agents:
    if agent_data['type'] == 'BedrockLLMAgent':
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=agent_data['name'],
            description=agent_data['description'],
            model_id=agent_data['model_id'],
            streaming=True
        ))
    elif agent_data['type'] == 'LambdaAgent':
        new_agent = LambdaAgent(
            name=agent_data['name'],
            description=agent_data['description'],
            lambda_function_name=agent_data['lambda_function_name']
        )
    orchestrator.add_agent(new_agent)

class Agent(BaseModel):
    id: Optional[str]
    name: str
    description: str
    type: str
    model_id: Optional[str]
    lambda_function_name: Optional[str]
    chain_agents: Optional[List[str]]
    enable_web_search: Optional[bool] = False

class ChatRequest(BaseModel):
    message: str
    agent_id: str

class LambdaFunction(BaseModel):
    name: str
    arn: str

@app.get("/agents", response_model=List[Agent])
async def get_agents():
    return agents

@app.post("/agents", response_model=Agent)
async def create_agent(agent: Agent):
    if agent.type == "BedrockLLMAgent":
        if not agent.model_id:
            raise HTTPException(status_code=400, detail="model_id is required for BedrockLLMAgent")
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=agent.name,
            description=agent.description,
            model_id=agent.model_id,
            streaming=True
        ))
    elif agent.type == "LambdaAgent":
        if not agent.lambda_function_name:
            raise HTTPException(status_code=400, detail="lambda_function_name is required for LambdaAgent")
        new_agent = LambdaAgent(
            name=agent.name,
            description=agent.description,
            lambda_function_name=agent.lambda_function_name
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid agent type")

    orchestrator.add_agent(new_agent)
    agent_data = agent.dict()
    agent_data['id'] = new_agent.id
    agents.append(agent_data)
    save_agents(agents)
    return agent_data

@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    global agents, orchestrator
    agents = [a for a in agents if a['id'] != agent_id]
    save_agents(agents)
    
    # Recreate the orchestrator with the updated agents
    orchestrator = MultiAgentOrchestrator()
    for agent_data in agents:
        if agent_data['type'] == 'BedrockLLMAgent':
            new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
                name=agent_data['name'],
                description=agent_data['description'],
                model_id=agent_data['model_id'],
                streaming=True
            ))
        elif agent_data['type'] == 'LambdaAgent':
            new_agent = LambdaAgent(
                name=agent_data['name'],
                description=agent_data['description'],
                lambda_function_name=agent_data['lambda_function_name']
            )
        orchestrator.add_agent(new_agent)
    
    return {"message": "Agent deleted successfully"}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        agent = next((a for a in agents if a['id'] == request.agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        print(f"Processing request for agent: {agent['name']} (Type: {agent['type']})")
        
        context = request.message
        if agent.get('enable_web_search', False):
            search_results = await web_search(request.message)
            context = f"Web search results:\n{json.dumps(search_results, indent=2)}\n\nUser query: {request.message}"

        if agent['type'] == 'LambdaAgent':
            print("Using LambdaAgent")
            try:
                print(f"Invoking Lambda function: {agent['lambda_function_name']}")
                lambda_response = lambda_client.invoke(
                    FunctionName=agent['lambda_function_name'],
                    InvocationType='RequestResponse',
                    Payload=json.dumps({'message': request.message})
                )
                lambda_result = json.loads(lambda_response['Payload'].read().decode('utf-8'))
                print(f"Lambda function response: {lambda_result}")
                context = f"Lambda function output: {json.dumps(lambda_result)}\n\nUser query: {request.message}"
            except Exception as e:
                print(f"Error invoking Lambda function: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error invoking Lambda function: {str(e)}")

        # Process with Bedrock LLM for all agent types
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 500,
            "messages": [
                {
                    "role": "user",
                    "content": f"You are an AI assistant named {agent['name']}. {agent['description']}\n\n{context}"
                }
            ],
            "temperature": 0.7,
            "top_p": 1,
        }

        try:
            print(f"Invoking Bedrock model: {agent['model_id']}")
            print(f"Payload: {json.dumps(payload, indent=2)}")
            response = bedrock_runtime.invoke_model(
                modelId=agent['model_id'],
                body=json.dumps(payload)
            )
            response_body = json.loads(response['body'].read())
            print(f"Bedrock response: {json.dumps(response_body, indent=2)}")
            return {"response": response_body['content'][0]['text']}
        except Exception as e:
            print(f"Error invoking Bedrock model: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error invoking Bedrock model: {str(e)}")
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error in chat endpoint: {str(e)}")

@app.get("/lambda-functions", response_model=List[LambdaFunction])
async def get_lambda_functions():
    try:
        paginator = lambda_client.get_paginator('list_functions')
        lambda_functions = []
        for page in paginator.paginate():
            for function in page['Functions']:
                lambda_functions.append(LambdaFunction(
                    name=function['FunctionName'],
                    arn=function['FunctionArn']
                ))
        return lambda_functions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test-bedrock")
async def test_bedrock():
    try:
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, Claude. How are you today?"
                }
            ],
            "temperature": 0.5,
            "top_p": 1,
        }

        response = bedrock_runtime.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=json.dumps(payload)
        )
        response_body = json.loads(response['body'].read())
        return {"response": response_body['content'][0]['text']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)