import os
import uuid
import asyncio
import streamlit as st
from dotenv import load_dotenv
load_dotenv()
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import AnthropicAgent, AnthropicAgentOptions, AgentResponse
from multi_agent_orchestrator.classifiers import ClassifierResult
from multi_agent_orchestrator.types import ConversationMessage
from search_web import tool_handler, search_web_tool
from supervisor import SupervisorMode, SupervisorModeOptions


# Set up the Streamlit app
st.title("AI Travel Planner ✈️")
st.caption("Plan your next adventure with AI Travel Planner by researching and planning a personalized itinerary on autopilot using Amazon Bedrock")


# Get Anthropic API key from user
anthropic_api_key = st.text_input("Enter Anthropic API Key to access Claude Sonnet 3.5", type="password", value=os.getenv('ANTHROPIC_API_KEY', None))


researcher_agent = AnthropicAgent(AnthropicAgentOptions(
    api_key=anthropic_api_key,
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
    'tool': [search_web_tool.to_claude_format()],
    'toolMaxRecursions': 20,
    'useToolHandler': tool_handler
    },
    save_chat=False
))

planner_agent = AnthropicAgent(AnthropicAgentOptions(
    api_key=anthropic_api_key,
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

supervisor = SupervisorMode(SupervisorModeOptions(
    supervisor=planner_agent,
    team=[researcher_agent],
    trace=True
))

async def handle_request(_orchestrator: MultiAgentOrchestrator, _user_input:str, _user_id:str, _session_id:str):
    classifier_result=ClassifierResult(selected_agent=supervisor, confidence=1.0)

    response:AgentResponse = await _orchestrator.agent_process_request(_user_input, _user_id, _session_id, classifier_result)

    # Print metadata
    print("\nMetadata:")
    print(f"Selected Agent: {response.metadata.agent_name}")
    if isinstance(response, AgentResponse) and response.streaming is False:
        # Handle regular response
        if isinstance(response.output, str):
            return (response.output)
        elif isinstance(response.output, ConversationMessage):
                return (response.output.content[0].get('text'))


# Initialize the orchestrator with some options
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
        input_text = (f"{destination} for {num_days} days")
        # Get the response from the assistant
        response = asyncio.run(handle_request(orchestrator, input_text, USER_ID, SESSION_ID))
        st.write(response)
