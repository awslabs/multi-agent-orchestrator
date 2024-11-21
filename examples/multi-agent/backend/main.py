import os
import json
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import boto3
from botocore.config import Config
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from botocore.exceptions import ClientError

# Multi-agent-orchestrator imports
from multi_agent_orchestrator.agents.agent import Agent, AgentOptions
from multi_agent_orchestrator.agents.bedrock_llm_agent import BedrockLLMAgent, BedrockLLMAgentOptions
from multi_agent_orchestrator.agents.lambda_agent import LambdaAgent, LambdaAgentOptions
from multi_agent_orchestrator.agents.chain_agent import ChainAgent, ChainAgentOptions
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator

# Other imports
from duckduckgo_search import DDGS
from typing import List, Optional, Dict, Union, Any
import requests
import shutil
import time
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from duckduckgo_search.exceptions import RatelimitException
from collections import defaultdict
import traceback


# Define ChainAgentStep
class ChainAgentStep(BaseModel):
    agent_id: str
    input: str = "previous_output"

app = FastAPI()

# Add this CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.1.52:3000"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a custom boto3 session using the default credentials
session = boto3.Session()

# Create a custom configuration
config = Config(
    region_name=session.region_name or 'us-east-1',
    signature_version='v4',
    retries={
        'max_attempts': 3,
        'mode': 'adaptive',
    },
    max_pool_connections=10,
    connect_timeout=5,
    read_timeout=30
)

# Initialize AWS clients using the session and config
bedrock_runtime = session.client('bedrock-runtime', config=config)
lambda_client = session.client('lambda', config=config)

# Initialize the orchestrator
orchestrator = MultiAgentOrchestrator()

AGENTS_FILE = 'agents.json'
CHAIN_AGENTS_FILE = 'chain-agents.json'
KNOWLEDGE_BASE_DIR = 'knowledge_base'

def load_agents():
    if os.path.exists(AGENTS_FILE):
        with open(AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_agents(agents):
    with open(AGENTS_FILE, 'w') as f:
        json.dump(agents, f)

def load_chain_agents():
    if os.path.exists(CHAIN_AGENTS_FILE):
        with open(CHAIN_AGENTS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_chain_agents(chain_agents):
    with open(CHAIN_AGENTS_FILE, 'w') as f:
        json.dump(chain_agents, f, indent=2)

# Add this after the function definitions and before loading the agents
if not os.path.exists(CHAIN_AGENTS_FILE):
    save_chain_agents([])
    print(f"Created empty {CHAIN_AGENTS_FILE}")

# Load agents and chain agents
agents = load_agents()
chain_agents = load_chain_agents()

# Function to add an agent to the orchestrator
def add_agent_to_orchestrator(agent_data):
    if agent_data['id'] in orchestrator.agents:
        # If the agent already exists in the orchestrator, return the existing agent
        return orchestrator.agents[agent_data['id']]

    if agent_data['type'] == 'BedrockLLMAgent':
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=agent_data['name'],
            description=agent_data['description'],
            model_id=agent_data['model_id'],
            streaming=True
        ))
        new_agent.client = bedrock_runtime  # Set the client after creation
    elif agent_data['type'] == 'LambdaAgent':
        new_agent = LambdaAgent(LambdaAgentOptions(
            name=agent_data['name'],
            description=agent_data['description'],
            function_name=agent_data['lambda_function_name']
        ))
        new_agent.client = lambda_client  # Set the client after creation
    elif agent_data['type'] == 'ChainAgent':
        # For ChainAgents, we don't add them directly to the orchestrator
        # Instead, we return None and handle them separately in the chat endpoint
        return None
    else:
        print(f"Unsupported agent type: {agent_data['type']}")
        return None

    new_agent.id = agent_data['id']  # Ensure the ID is set
    orchestrator.add_agent(new_agent)
    return new_agent

# Initialize agents in the orchestrator
for agent_data in agents:
    add_agent_to_orchestrator(agent_data)

# Print debug information
print(f"Orchestrator initialized with {len(orchestrator.agents)} agents:")
for agent_id, agent in orchestrator.agents.items():
    print(f"  - {agent.name} (ID: {agent_id}, Type: {type(agent).__name__})")

class ChainAgentStep(BaseModel):
    agent_id: str
    input: str = "previous_output"

class ChainAgent(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    chain_agents: List[ChainAgentStep]

    class Config:
        extra = "allow"

class Agent(BaseModel):
    id: Optional[str]
    name: str
    description: str
    type: str
    model_id: Optional[str]
    lambda_function_name: Optional[str]
    chain_agents: Optional[List[Union[str, Dict[str, str], ChainAgentStep]]] = Field(default_factory=list)
    agent_positions: Optional[Dict[str, Dict[str, float]]]

    class Config:
        extra = "allow"
        
class ChatRequest(BaseModel):
    message: str
    agent_id: str
    knowledge_base: Optional[str] = None

class LambdaFunction(BaseModel):
    name: str
    arn: str

# Update the KnowledgeBase model
class KnowledgeBase(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    files: List[str] = Field(default_factory=list)

@app.get("/agents", response_model=List[Agent])
async def get_agents():
    all_agents = agents + chain_agents
    for agent in all_agents:
        if agent['type'] == 'ChainAgent' and isinstance(agent.get('chain_agents'), list):
            agent['chain_agents'] = [
                ChainAgentStep(agent_id=step['agent_id'], input=step['input'])
                if isinstance(step, dict) else
                ChainAgentStep(agent_id=step, input='previous_output')
                if isinstance(step, str) else
                step
                for step in agent['chain_agents']
            ]
    return all_agents

@app.post("/agents", response_model=Agent)
async def create_agent(agent: Agent):
    print(f"Received agent data for duplication: {agent.dict()}")
    if agent.id:
        # This is a duplication request
        existing_agent = next((a for a in agents if a['id'] == agent.id), None)
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent to duplicate not found")
        
        print(f"Existing agent found: {existing_agent}")
        new_id = str(uuid.uuid4())
        new_agent = {**existing_agent, 'id': new_id, 'name': agent.name}
        print(f"New agent created: {new_agent}")
        agents.append(new_agent)
        save_agents(agents)
        return new_agent
    
    # Original create agent logic
    if agent.type == "BedrockLLMAgent":
        if not agent.model_id:
            raise HTTPException(status_code=400, detail="model_id is required for BedrockLLMAgent")
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=agent.name,
            description=agent.description,
            model_id=agent.model_id,
            streaming=True
        ))
        new_agent.client = bedrock_runtime
    elif agent.type == "LambdaAgent":
        if not agent.lambda_function_name:
            raise HTTPException(status_code=400, detail="lambda_function_name is required for LambdaAgent")
        new_agent = LambdaAgent(LambdaAgentOptions(
            name=agent.name,
            description=agent.description,
            function_name=agent.lambda_function_name
        ))
        new_agent.client = lambda_client
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
    
    # Instead of removing and re-adding, just update the existing agent
    if updated_agent.type == 'BedrockLLMAgent':
        new_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
            name=updated_agent.name,
            description=updated_agent.description,
            model_id=updated_agent.model_id,
            streaming=True
        ))
        new_agent.client = bedrock_runtime
    elif updated_agent.type == 'LambdaAgent':
        new_agent = LambdaAgent(LambdaAgentOptions(
            name=updated_agent.name,
            description=updated_agent.description,
            function_name=updated_agent.lambda_function_name
        ))
        new_agent.client = lambda_client
    else:
        raise HTTPException(status_code=400, detail="Invalid agent type")
    
    # Update the agent in the orchestrator's agents dictionary
    orchestrator.agents[agent_id] = new_agent
    
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
            new_agent.client = bedrock_runtime
        elif agent_data['type'] == 'LambdaAgent':
            new_agent = LambdaAgent(LambdaAgentOptions(
                name=agent_data['name'],
                description=agent_data['description'],
                function_name=agent_data['lambda_function_name']
            ))
            new_agent.client = lambda_client
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

# Update the create_knowledge_base function
@app.post("/knowledge-bases", response_model=KnowledgeBase)
async def create_knowledge_base(kb: KnowledgeBase):
    try:
        kb.id = str(uuid.uuid4())
        kb_path = os.path.join(KNOWLEDGE_BASE_DIR, kb.id)
        os.makedirs(kb_path, exist_ok=True)
        kb_dict = kb.dict()
        with open(os.path.join(kb_path, 'info.json'), 'w') as f:
            json.dump(kb_dict, f)
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

class ChainAgentRequest(BaseModel):
    name: str
    description: str
    chain_agents: List[ChainAgentStep]
    agent_positions: Dict[str, Dict[str, float]]

@app.post("/chain-agents", response_model=Dict[str, Any])
async def create_chain_agent(chain_agent_request: ChainAgentRequest):
    try:
        # Load existing agents
        existing_agents = load_agents()
        
        # Validate that all agent_ids in the request exist
        for step in chain_agent_request.chain_agents:
            if not any(a['id'] == step.agent_id for a in existing_agents):
                raise HTTPException(status_code=404, detail=f"Agent with id {step.agent_id} not found")
        
        # Create the chain agent data structure
        new_chain_agent = {
            "id": str(uuid.uuid4()),
            "name": chain_agent_request.name,
            "description": chain_agent_request.description,
            "type": "ChainAgent",
            "chain_agents": [
                {
                    "agent_id": step.agent_id,
                    "input": step.input
                } for step in chain_agent_request.chain_agents
            ],
            "agent_positions": chain_agent_request.agent_positions
        }
        
        # Load existing chain agents
        chain_agents = load_chain_agents()
        
        # Add the new chain agent
        chain_agents.append(new_chain_agent)
        
        # Save the updated chain agents
        save_chain_agents(chain_agents)
        
        return new_chain_agent
    except Exception as e:
        print(f"Error creating chain agent: {str(e)}")
        print(f"Request data: {chain_agent_request}")
        raise HTTPException(status_code=500, detail=f"Error creating chain agent: {str(e)}")

# Web search function
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(RatelimitException),
    reraise=True
)
async def web_search(query: str, num_results: int = 3) -> List[str]:
    try:
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(query, max_results=num_results)]
        return [f"{r['title']}: {r['body']}" for r in results]
    except RatelimitException:
        print(f"Rate limit reached for query: {query}. Retrying...")
        raise
    except Exception as e:
        print(f"Error during web search: {str(e)}")
        return [f"Error occurred during web search: {str(e)}"]

# Update the format_bedrock_input function for Claude 3 Sonnet
def format_bedrock_input(model_id: str, content: str):
    if "anthropic.claude-3" in model_id:
        return {
            "prompt": f"{content}"
        }
    elif "anthropic.claude-v2" in model_id:
        return {
            "prompt": f"{content}"
        }
    elif "amazon.titan" in model_id:
        return {
            "inputText": content
        }
    elif "ai21" in model_id:
        return {
            "prompt": content
        }
    elif "cohere" in model_id:
        return {
            "prompt": content
        }
    else:
        return {
            "prompt": f"{content}"
        }

# Add this helper function for Lambda invocation
async def invoke_lambda_agent(agent_data: dict, message: str):
    try:
        payload = {
            "message": message,
            "timestamp": int(time.time())
        }
        
        print(f"Invoking Lambda function: {agent_data['lambda_function_name']}")
        print(f"With payload: {payload}")
        
        response = lambda_client.invoke(
            FunctionName=agent_data['lambda_function_name'],
            InvocationType='RequestResponse',
            Payload=json.dumps(payload)
        )
        
        # Read and parse the response
        response_payload = json.loads(response['Payload'].read().decode('utf-8'))
        print(f"Lambda response payload: {response_payload}")
        
        if response['StatusCode'] != 200:
            raise Exception(f"Lambda invocation failed with status code: {response['StatusCode']}")
            
        if 'errorMessage' in response_payload:
            raise Exception(f"Lambda function error: {response_payload['errorMessage']}")
        
        # Handle the response body properly
        if isinstance(response_payload, dict):
            if 'body' in response_payload:
                # If body is a string, try to parse it as JSON
                if isinstance(response_payload['body'], str):
                    try:
                        return json.loads(response_payload['body'])
                    except json.JSONDecodeError:
                        return response_payload['body']
                return response_payload['body']
            return response_payload
        
        return response_payload
        
    except Exception as e:
        print(f"Error invoking Lambda function: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lambda invocation failed: {str(e)}")

# Add retry decorator for Bedrock invocation
@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=4, max=60),
    retry=retry_if_exception_type((ClientError))
)
async def invoke_bedrock_model(prompt: str, model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0"):
    try:
        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.7,
            "top_p": 0.9,
            "stop_sequences": ["\n\nHuman:"]
        }

        response = bedrock_runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json"
        )
        
        response_body = json.loads(response.get('body').read())
        return response_body['content'][0]['text']
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        if error_code == 'ThrottlingException':
            print("Bedrock throttling detected, retrying with exponential backoff...")
            raise  # This will trigger the retry
        raise HTTPException(
            status_code=500,
            detail=f"Bedrock error: {str(e)}"
        )

# Update the chat endpoint to chain Lambda with Bedrock LLM
@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        print(f"Received chat request for agent ID: {request.agent_id}")
        
        # Handle single agent requests
        agent = next((a for a in agents if a['id'] == request.agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent not found for ID: {request.agent_id}")
        
        print(f"Found agent: {agent['name']} (Type: {agent['type']})")
        
        # Handle Lambda Agent chained with Bedrock LLM
        if agent['type'] == 'LambdaAgent':
            if not agent.get('lambda_function_name'):
                raise HTTPException(status_code=400, detail="Lambda function name not configured")
            
            try:
                # First, get response from Lambda
                lambda_response = await invoke_lambda_agent(agent, request.message)
                if lambda_response is None:
                    return {"response": "No response received from Lambda function"}
                
                # Format the Lambda response for the LLM
                lambda_data = json.dumps(lambda_response, indent=2)
                
                # Prepare context for the LLM
                llm_prompt = f"""Based on the following service status data, please provide a clear and concise response to the user's question: "{request.message}"

Service Status Data:
{lambda_data}

Please analyze the data and provide:
1. A summary of the current status
2. Any notable issues or concerns
3. Specific answers to the user's question

Response:"""

                try:
                    # Use the new retry-enabled function
                    llm_response = await invoke_bedrock_model(llm_prompt)
                    return {"response": llm_response}
                except Exception as e:
                    print(f"Error in Bedrock invocation: {str(e)}")
                    # Return the raw Lambda response as fallback
                    return {
                        "response": f"Due to high load, showing raw status data:\n{lambda_data}"
                    }
                
            except Exception as e:
                print(f"Error processing Lambda or LLM response: {str(e)}")
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))
        
        # Handle regular Bedrock LLM Agent
        elif agent['type'] == 'BedrockLLMAgent':
            agent_instance = BedrockLLMAgent(BedrockLLMAgentOptions(
                name=agent['name'],
                description=agent['description'],
                model_id=agent.get('model_id', 'anthropic.claude-3-sonnet-20240229-v1:0'),
                streaming=True
            ))
            agent_instance.client = bedrock_runtime

            # Add web search for browsing agent
            if agent.get('enable_web_search'):
                search_results = await web_search(request.message)
                context = f"Web search results:\n{json.dumps(search_results, indent=2)}\n\nUser query: {request.message}"
            else:
                context = request.message

            # Use the retry-enabled function
            response = await invoke_bedrock_model(context, agent.get('model_id'))
            return {"response": response}
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported agent type: {agent['type']}")

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

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

@app.delete("/connections/{from_id}/{to_id}")
async def remove_connection(from_id: str, to_id: str):
    # Implement connection removal logic
    pass

@app.patch("/agents/{agent_id}/position")
async def update_agent_position(agent_id: str, position: dict):
    # Implement position update logic
    pass

def get_ordered_agents(chain_agents):
    graph = defaultdict(list)
    all_agents = set()
    
    # Build the graph
    for ca in chain_agents:
        for i in range(len(ca['chain_agents']) - 1):
            from_agent = ca['chain_agents'][i]['agent_id']
            to_agent = ca['chain_agents'][i+1]['agent_id']
            graph[from_agent].append(to_agent)
            all_agents.add(from_agent)
            all_agents.add(to_agent)
    
    # Perform topological sort
    visited = set()
    stack = []
    
    def dfs(agent):
        visited.add(agent)
        for neighbor in graph[agent]:
            if neighbor not in visited:
                dfs(neighbor)
        stack.append(agent)
    
    for agent in all_agents:
        if agent not in visited:
            dfs(agent)
    
    return stack[::-1]  # Reverse the stack to get the correct order

@app.get("/chain-agents", response_model=List[Agent])
async def get_chain_agents():
    return load_chain_agents()

@app.post("/chain-chat")
async def chain_chat(request: ChatRequest):
    try:
        print(f"Received chain chat request for agent ID: {request.agent_id}")
        chain_agent_data = next((ca for ca in chain_agents if ca['id'] == request.agent_id), None)
        if not chain_agent_data:
            raise HTTPException(status_code=404, detail=f"Chain agent not found for ID: {request.agent_id}")
        
        chain_results = []
        current_input = request.message

        for step in chain_agent_data['chain_agents']:
            # Access agent_id as a dictionary key
            agent_id = step['agent_id']
            agent_data = next((a for a in agents if a['id'] == agent_id), None)
            if not agent_data:
                raise HTTPException(status_code=404, detail=f"Agent with id {agent_id} not found in chain")
            
            print(f"Processing step with agent: {agent_data['name']} (Type: {agent_data['type']})")
            
            if agent_data['type'] == 'BedrockLLMAgent':
                agent_instance = BedrockLLMAgent(BedrockLLMAgentOptions(
                    name=agent_data['name'],
                    description=agent_data['description'],
                    model_id=agent_data.get('model_id', 'anthropic.claude-3-sonnet-20240229-v1:0'),
                    streaming=agent_data.get('streaming', False)
                ))
                agent_instance.client = bedrock_runtime
            elif agent_data['type'] == 'LambdaAgent':
                agent_instance = LambdaAgent(LambdaAgentOptions(
                    name=agent_data['name'],
                    description=agent_data['description'],
                    function_name=agent_data['lambda_function_name']
                ))
                agent_instance.client = lambda_client
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported agent type: {agent_data['type']}")

            # Prepare the input in the correct format
            formatted_input = {
                "messages": [
                    {
                        "role": "user",
                        "content": current_input
                    }
                ]
            }

            response = await agent_instance.process_request(formatted_input, "user_id", "session_id", [])
            chain_results.append({
                "agent": agent_data['name'],
                "input": current_input,
                "output": response
            })
            current_input = response

        return {"response": chain_results[-1]['output']}  # Send the final result

    except Exception as e:
        print(f"Error in chain chat endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error in chain chat endpoint: {str(e)}")

class BedrockModel(BaseModel):
    id: str
    name: str
    provider: str
    description: str

@app.get("/bedrock-models", response_model=List[BedrockModel])
async def get_bedrock_models():
    models = [
        {
            "id": "anthropic.claude-3-sonnet-20240229-v1:0",
            "name": "Claude 3 Sonnet",
            "provider": "Anthropic",
            "description": "Latest Claude model optimized for enterprise tasks"
        },
        {
            "id": "anthropic.claude-v2",
            "name": "Claude V2",
            "provider": "Anthropic",
            "description": "Previous generation Claude model"
        },
        {
            "id": "amazon.titan-text-express-v1",
            "name": "Titan Text Express",
            "provider": "Amazon",
            "description": "Amazon's Titan model optimized for text generation"
        },
        {
            "id": "ai21.j2-ultra-v1",
            "name": "Jurassic-2 Ultra",
            "provider": "AI21",
            "description": "AI21's largest language model"
        },
        {
            "id": "cohere.command-text-v14",
            "name": "Command",
            "provider": "Cohere",
            "description": "Cohere's command model for text generation"
        }
    ]
    return models

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, debug=True)

# what is the current weather status in chennai region october 16th?
