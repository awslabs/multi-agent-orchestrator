import os
import json
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
from botocore.config import Config
from multi_agent_orchestrator import (
    MultiAgentOrchestrator, BedrockLLMAgent, BedrockLLMAgentOptions
)
from multi_agent_orchestrator.agents import ChainAgent, ChainAgentOptions
from multi_agent_orchestrator.agents import LambdaAgent, LambdaAgentOptions
from duckduckgo_search import DDGS
from typing import List, Optional, Dict, Union, Any
from pydantic import BaseModel, Field
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

# Create a custom boto3 session using the default credentials
session = boto3.Session()

# Create a custom configuration
config = Config(
    region_name=session.region_name or 'us-east-1',
    signature_version='v4',
    retries={
        'max_attempts': 10,
        'mode': 'standard'
    }
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
        try:
            with open(CHAIN_AGENTS_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    data = json.loads(content)
                    # Validate and clean the data
                    cleaned_data = []
                    for agent in data:
                        if isinstance(agent.get('chain_agents'), list):
                            agent['chain_agents'] = [
                                {'agent_id': step, 'input': 'previous_output'} if isinstance(step, str) else step
                                for step in agent['chain_agents']
                            ]
                        cleaned_data.append(agent)
                    return cleaned_data
                else:
                    print(f"Warning: {CHAIN_AGENTS_FILE} is empty. Initializing with an empty list.")
                    return []
        except json.JSONDecodeError as e:
            print(f"Error decoding {CHAIN_AGENTS_FILE}: {str(e)}. Initializing with an empty list.")
            return []
    else:
        print(f"Warning: {CHAIN_AGENTS_FILE} does not exist. Initializing with an empty list.")
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
    else:
        print(f"Skipping unsupported agent type: {agent_data['type']}")
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
    input: str

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

class KnowledgeBase(BaseModel):
    id: str
    name: str
    description: str
    files: List[str] = []

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
    
    # Update the agent in the orchestrator
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
    if agent.type != "ChainAgent" or not agent.chain_agents:
        raise HTTPException(status_code=400, detail="Invalid chain agent configuration")

    try:
        # Get the agents from the agents.json file
        with open(AGENTS_FILE, 'r') as f:
            all_agents = json.load(f)

        # Create a dictionary of all agents
        agent_dict = {a['id']: a for a in all_agents}

        # Create BedrockLLMAgent instances for each agent in the chain
        chain_agent_instances = []
        serializable_chain_agents = []
        for step in agent.chain_agents:
            if isinstance(step, dict):
                agent_id = step['agent_id']
                input_type = step['input']
            else:
                agent_id = step.agent_id
                input_type = step.input

            if agent_id not in agent_dict:
                raise HTTPException(status_code=400, detail=f"Agent with id {agent_id} not found")
            
            agent_data = agent_dict[agent_id]
            if agent_data['type'] == 'BedrockLLMAgent':
                chain_agent_instances.append(BedrockLLMAgent(BedrockLLMAgentOptions(
                    name=agent_data['name'],
                    description=agent_data['description'],
                    model_id=agent_data['model_id'],
                    streaming=True
                )))
                chain_agent_instances[-1].client = bedrock_runtime
            elif agent_data['type'] == 'LambdaAgent':
                chain_agent_instances.append(LambdaAgent(LambdaAgentOptions(
                    name=agent_data['name'],
                    description=agent_data['description'],
                    function_name=agent_data['lambda_function_name']
                )))
                chain_agent_instances[-1].client = lambda_client
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported agent type {agent_data['type']} for chain agent")

            serializable_chain_agents.append({
                'agent_id': agent_id,
                'input': input_type
            })

        # Create the ChainAgent
        chain_agent = ChainAgent(ChainAgentOptions(
            name=agent.name,
            description=agent.description,
            agents=chain_agent_instances,
            default_output='The chain encountered an issue during processing.'
        ))

        # Add the chain agent to the orchestrator
        orchestrator.add_agent(chain_agent)

        # Create a dictionary representation of the chain agent
        new_agent = {
            "id": str(uuid.uuid4()),
            "name": agent.name,
            "description": agent.description,
            "type": "ChainAgent",
            "chain_agents": serializable_chain_agents
        }

        # Update positions for all agents involved in the chain
        if agent.agent_positions:
            for agent_id, position in agent.agent_positions.items():
                # Update the position in the agents list
                for a in all_agents:
                    if a['id'] == agent_id:
                        a['position'] = position
                        break

            # Save the updated agents to the file
            save_agents(all_agents)

        # Update the chain_agents.json file
        chain_agents.append(new_agent)
        save_chain_agents(chain_agents)

        return new_agent
    except Exception as e:
        print(f"Error creating chain agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating chain agent: {str(e)}")
    
# Web search function
async def web_search(query: str, num_results: int = 3) -> List[str]:
    with DDGS() as ddgs:
        results = [r for r in ddgs.text(query, max_results=num_results)]
    return [f"{r['title']}: {r['body']}" for r in results]

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        print(f"Received chat request for agent ID: {request.agent_id}")
        agent = next((a for a in agents + chain_agents if a['id'] == request.agent_id), None)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent not found for ID: {request.agent_id}")
        
        print(f"Found agent: {agent['name']} (Type: {agent['type']})")
        
        context = request.message
        if agent.get('enable_web_search', False):
            search_results = await web_search(request.message)
            context = f"Web search results:\n{json.dumps(search_results, indent=2)}\n\nUser query: {request.message}"

        if agent['type'] == 'ChainAgent':
            print("Processing ChainAgent")
            chain_agent_data = next((ca for ca in chain_agents if ca['id'] == agent['id']), None)
            if not chain_agent_data:
                raise HTTPException(status_code=404, detail=f"Chain agent data not found for ID: {agent['id']}")
            
            chain_agent_instances = []
            for step in chain_agent_data['chain_agents']:
                agent_id = step['agent_id']
                agent_data = next((a for a in agents if a['id'] == agent_id), None)
                if not agent_data:
                    raise HTTPException(status_code=404, detail=f"Agent with id {agent_id} not found in chain")
                
                print(f"Creating chain agent instance for: {agent_data['name']} (Type: {agent_data['type']})")
                chain_agent_instances.append(add_agent_to_orchestrator(agent_data))

            print(f"Creating ChainAgent with {len(chain_agent_instances)} instances")
            chain_agent = ChainAgent(ChainAgentOptions(
                name=chain_agent_data['name'],
                description=chain_agent_data['description'],
                agents=chain_agent_instances,
                default_output='The chain encountered an issue during processing.'
            ))

            print("Processing ChainAgent request")
            response = await chain_agent.process_request(context, "user_id", "session_id", [])
            print("ChainAgent request processed successfully")
            return {"response": response}

        # Handle other agent types (BedrockLLMAgent, LambdaAgent)
        print(f"Processing request for {agent['type']}")
        agent_instance = orchestrator.agents.get(agent['id'])
        if not agent_instance:
            print(f"Agent not found in orchestrator, attempting to add: {agent['name']} (ID: {agent['id']})")
            agent_instance = add_agent_to_orchestrator(agent)
            if not agent_instance:
                raise HTTPException(status_code=404, detail=f"Failed to create agent for ID: {agent['id']}")

        print("Processing agent request")
        response = await agent_instance.process_request(context, "user_id", "session_id", [])
        print("Agent request processed successfully")
        return {"response": response}

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
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

@app.delete("/connections/{from_id}/{to_id}")
async def remove_connection(from_id: str, to_id: str):
    # Implement connection removal logic
    pass

@app.patch("/agents/{agent_id}/position")
async def update_agent_position(agent_id: str, position: dict):
    # Implement position update logic
    pass

def get_ordered_agents(chain_agents):
    # Implement topological sort to order agents
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)