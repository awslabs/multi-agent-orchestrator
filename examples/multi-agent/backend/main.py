import os
import json
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File
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
import shutil

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
KNOWLEDGE_BASE_DIR = 'knowledge_base'

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
    knowledge_base: Optional[str] = None

class LambdaFunction(BaseModel):
    name: str
    arn: str

class KnowledgeBase(BaseModel):
    id: str
    name: str
    description: str
    files: List[str] = []

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

@app.put("/agents/{agent_id}", response_model=Agent)
async def update_agent(agent_id: str, updated_agent: Agent):
    global agents, orchestrator
    agent_index = next((index for (index, a) in enumerate(agents) if a['id'] == agent_id), None)
    if agent_index is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agents[agent_index] = updated_agent.dict()
    save_agents(agents)
    
    # Update the agent in the orchestrator
    if updated_agent.type == 'BedrockLLMAgent':
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=updated_agent.name,
            description=updated_agent.description,
            model_id=updated_agent.model_id,
            streaming=True
        ))
    elif updated_agent.type == 'LambdaAgent':
        new_agent = LambdaAgent(
            name=updated_agent.name,
            description=updated_agent.description,
            lambda_function_name=updated_agent.lambda_function_name
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid agent type")
    
    orchestrator.remove_agent(agent_id)
    orchestrator.add_agent(new_agent)
    
    return updated_agent

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

@app.get("/knowledge-bases", response_model=List[KnowledgeBase])
async def get_knowledge_bases():
    try:
        if not os.path.exists(KNOWLEDGE_BASE_DIR):
            os.makedirs(KNOWLEDGE_BASE_DIR)
        knowledge_bases = []
        for kb_dir in os.listdir(KNOWLEDGE_BASE_DIR):
            kb_path = os.path.join(KNOWLEDGE_BASE_DIR, kb_dir)
            if os.path.isdir(kb_path):
                with open(os.path.join(kb_path, 'info.json'), 'r') as f:
                    kb_info = json.load(f)
                kb_info['files'] = [f for f in os.listdir(kb_path) if f != 'info.json']
                knowledge_bases.append(KnowledgeBase(**kb_info))
        return knowledge_bases
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/knowledge-bases", response_model=KnowledgeBase)
async def create_knowledge_base(kb: KnowledgeBase):
    try:
        kb.id = str(uuid.uuid4())
        kb_path = os.path.join(KNOWLEDGE_BASE_DIR, kb.id)
        os.makedirs(kb_path)
        with open(os.path.join(kb_path, 'info.json'), 'w') as f:
            json.dump(kb.dict(), f)
        return kb
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/knowledge-bases/{kb_id}")
async def delete_knowledge_base(kb_id: str):
    try:
        kb_path = os.path.join(KNOWLEDGE_BASE_DIR, kb_id)
        if os.path.exists(kb_path):
            shutil.rmtree(kb_path)
        return {"message": "Knowledge base deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/knowledge-bases/{kb_id}/upload")
async def upload_file(kb_id: str, file: UploadFile = File(...)):
    try:
        kb_path = os.path.join(KNOWLEDGE_BASE_DIR, kb_id)
        if not os.path.exists(kb_path):
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        file_path = os.path.join(kb_path, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"message": "File uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chain-agents", response_model=Agent)
async def create_chain_agent(agent: Agent):
    if agent.type != "ChainAgent" or not agent.chain_agents or len(agent.chain_agents) != 2:
        raise HTTPException(status_code=400, detail="Invalid chain agent configuration")

    new_agent = {
        "id": str(uuid.uuid4()),
        "name": agent.name,
        "description": agent.description,
        "type": "ChainAgent",
        "chain_agents": agent.chain_agents
    }

    agents.append(new_agent)
    save_agents(agents)
    return new_agent

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        agent = next((a for a in agents if a['id'] == request.agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        if agent['type'] == 'ChainAgent':
            return await process_chain_agent(agent, request.message)
        
        context = request.message
        if request.knowledge_base:
            kb_path = os.path.join(KNOWLEDGE_BASE_DIR, request.knowledge_base)
            if os.path.exists(kb_path):
                with open(kb_path, 'r') as kb_file:
                    kb_content = kb_file.read()
                context = f"Knowledge Base: {kb_content}\n\nUser query: {request.message}"
        
        print(f"Processing request for agent: {agent['name']} (Type: {agent['type']})")
        
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

async def process_chain_agent(agent: dict, message: str):
    first_agent = next((a for a in agents if a['id'] == agent['chain_agents'][0]), None)
    second_agent = next((a for a in agents if a['id'] == agent['chain_agents'][1]), None)

    if not first_agent or not second_agent:
        raise HTTPException(status_code=404, detail="One or more agents in the chain not found")

    # Process with the first agent
    first_response = await process_agent(first_agent, message)

    # Process with the second agent
    final_response = await process_agent(second_agent, first_response)

    return {"response": final_response}

async def process_agent(agent: dict, message: str):
    if agent['type'] == 'BedrockLLMAgent':
        return await process_bedrock_agent(agent, message)
    elif agent['type'] == 'LambdaAgent':
        return await process_lambda_agent(agent, message)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported agent type: {agent['type']}")

async def process_bedrock_agent(agent: dict, message: str):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 500,
        "messages": [
            {
                "role": "user",
                "content": f"You are an AI assistant named {agent['name']}. {agent['description']}\n\n{message}"
            }
        ],
        "temperature": 0.7,
        "top_p": 1,
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=agent['model_id'],
            body=json.dumps(payload)
        )
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error invoking Bedrock model: {str(e)}")

async def process_lambda_agent(agent: dict, message: str):
    try:
        lambda_response = lambda_client.invoke(
            FunctionName=agent['lambda_function_name'],
            InvocationType='RequestResponse',
            Payload=json.dumps({'message': message})
        )
        lambda_result = json.loads(lambda_response['Payload'].read().decode('utf-8'))
        return lambda_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error invoking Lambda function: {str(e)}")

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