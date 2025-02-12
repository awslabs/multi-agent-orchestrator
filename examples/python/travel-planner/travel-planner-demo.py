import uuid
import asyncio
import streamlit as st
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent, BedrockLLMAgentOptions,
    AgentResponse,
    SupervisorAgent, SupervisorAgentOptions)
from multi_agent_orchestrator.classifiers import ClassifierResult
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.utils import AgentTool, AgentTools
from search_web import search_web

# Set up the Streamlit app
st.title("AI Travel Planner ✈️")
st.caption("""
Plan your next adventure with AI Travel Planner by researching and planning a personalized itinerary on autopilot using Amazon Bedrock.

To learn more about the agents used in this demo visit [this link](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/python/travel-planner).
.
""")

search_web_tool = AgentTool(name='search_web',
                          description='Search Web for information',
                          properties={
                              'query': {
                                  'type': 'string',
                                  'description': 'The search query'
                              }
                          },
                          func=search_web,
                          required=['query'])


# Initialize the agents
researcher_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name="ResearcherAgent",
    description="""
You are a world-class travel researcher. Given a travel destination and the number of days the user wants to travel for,
generate a list of search terms for finding relevant travel activities and accommodations.
Then search the web for each term, analyze the results, and return the 10 most relevant results.

your tasks consist of:
1. Given a travel destination and the number of days the user wants to travel for, first generate a list of 3 search terms related to that destination and the number of days.
2. For each search term, `search_web` and analyze the results.
3. From the results of all searches, return the 10 most relevant results to the user's preferences.
4. Remember: the quality of the results is important.
""",
    tool_config={
        'tool': AgentTools(tools=[search_web_tool]),
        'toolMaxRecursions': 20,
    },
    save_chat=False
))

planner_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name="PlannerAgent",
    description="""
You are a senior travel planner. Given a travel destination, the number of days the user wants to travel for, and a list of research results,
your goal is to generate a draft itinerary that meets the user's needs and preferences.

your tasks consist of:
1. Given a travel destination, the number of days the user wants to travel for, and a list of research results, generate a draft itinerary that includes suggested activities and accommodations.
2. Ensure the itinerary is well-structured, informative, and engaging.
3. Ensure you provide a nuanced and balanced itinerary, quoting facts where possible.
4. Remember: the quality of the itinerary is important.
5. Focus on clarity, coherence, and overall quality.
6. Never make up facts or plagiarize. Always provide proper attribution.
7. Make sure to respond with a markdown format without mentioning it.
"""
))

supervisor = SupervisorAgent(SupervisorAgentOptions(
    name="SupervisorAgent",
    description="My Supervisor agent description",
    lead_agent=planner_agent,
    team=[researcher_agent],
    trace=True
))

# Define the async request handler
async def handle_request(_orchestrator: MultiAgentOrchestrator, _user_input: str, _user_id: str, _session_id: str):
    classifier_result = ClassifierResult(selected_agent=supervisor, confidence=1.0)

    response: AgentResponse = await _orchestrator.agent_process_request(_user_input, _user_id, _session_id, classifier_result)

    # Print metadata
    print("\nMetadata:")
    print(f"Selected Agent: {response.metadata.agent_name}")
    if isinstance(response, AgentResponse) and not response.streaming:
        # Handle regular response
        if isinstance(response.output, str):
            return response.output
        elif isinstance(response.output, ConversationMessage):
            return response.output.content[0].get('text')

# Initialize the orchestrator
orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
    LOG_AGENT_CHAT=True,
    LOG_CLASSIFIER_CHAT=True,
    LOG_CLASSIFIER_RAW_OUTPUT=True,
    LOG_CLASSIFIER_OUTPUT=True,
    LOG_EXECUTION_TIMES=True,
    MAX_RETRIES=3,
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
    MAX_MESSAGE_PAIRS_PER_AGENT=10,
))

USER_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())

# Input fields for the user's destination and the number of days they want to travel for
destination = st.text_input("Where do you want to go?")
num_days = st.number_input("How many days do you want to travel for?", min_value=1, max_value=30, value=7)

# Process the Travel Itinerary
if st.button("Generate Itinerary"):
    with st.spinner("Generating Itinerary..."):
        input_text = f"{destination} for {num_days} days"
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(handle_request(orchestrator, input_text, USER_ID, SESSION_ID))
        st.write(response)
