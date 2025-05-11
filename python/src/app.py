from typing import AsyncIterable
from agent_squad.orchestrator import AgentSquad
from agent_squad.agents.ollama_agent import OllamaAgent, OllamaAgentOptions
from agent_squad.agents.agent import AgentStreamResponse
from agent_squad.classifiers.ollama_classifier import OllamaClassifier, OllamaClassifierOptions
import asyncio

classifier = OllamaClassifier(OllamaClassifierOptions(
    model_id='llama3.2', 
    #inference_config={'temperature':0.0}
))

orchestrator = AgentSquad(classifier=classifier)

tech_agent = OllamaAgent(OllamaAgentOptions(
    name="Tech Agent",
    model_id="llama3.2",
    description="Handles technical questions about programming and software",
    streaming=True
))
orchestrator.add_agent(tech_agent)

hr_agent = OllamaAgent(OllamaAgentOptions(
    name="Human Resources Agent",
    model_id="llama3.2",
    description="Handles HR Interview questions about language skills",
    streaming=True
))
orchestrator.add_agent(hr_agent)

agents = orchestrator.get_all_agents()
print("Available agents:")
for agent_id, info in agents.items():
    print(f"{agent_id}: {info['name']} - {info['description']}")

async def handle_user_query():
    response = await orchestrator.route_request(
        "Hello what kind of question can I ask for a polish fluent candidate?",
        "user123",
        "session456"
    )

    if isinstance(response.output, AsyncIterable):
        async for chunk in response.output:
            if isinstance(chunk, AgentStreamResponse):
                print(chunk.text, end='', flush=True)
    else:
        # Assuming response.output is a ConversationMessage, you should extract the content from it
        if hasattr(response.output, 'content') and isinstance(response.output.content, list):
            # Extract the text from the list of dictionaries
            text = ''.join([message['text'] for message in response.output.content if 'text' in message])
            print(text)



# Run the example
asyncio.run(handle_user_query())