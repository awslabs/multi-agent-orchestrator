from dotenv import load_dotenv
import streamlit as st
load_dotenv()
import os
import uuid
import os
import asyncio
from  search_web import tool_handler
from tool import Tool, ToolResult
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (
    AnthropicAgent,  AnthropicAgentOptions,
    AgentResponse
)
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.classifiers import ClassifierResult
from supervisor import SupervisorMode, SupervisorModeOptions

# Set up the Streamlit app
st.title("AI Movie Production Demo 🎬")
st.caption("Bring your movie ideas to life with the teams of script writing and casting AI agents")


# Get Anthropic API key from user
anthropic_api_key = st.text_input("Enter Anthropic API Key to access Claude Sonnet 3.5", type="password", value=os.getenv('ANTHROPIC_API_KEY', None))

search_web_tool = Tool(name='search_web',
                          description='Search Web for information',
                          properties={
                              'query': {
                                  'type': 'string',
                                  'description': 'The search query'
                              }
                          },
                          required=['query'])

script_writer_agent = AnthropicAgent(AnthropicAgentOptions(
    api_key=os.getenv('ANTHROPIC_API_KEY', None),
    name="ScriptWriterAgent",
    description="""\
You are an expert screenplay writer. Given a movie idea and genre,
develop a compelling script outline with character descriptions and key plot points.

Your tasks consist of:
1. Write a script outline with 3-5 main characters and key plot points
2. Outline the three-act structure and suggest 2-3 twists.
3. Ensure the script aligns with the specified genre and target audience
"""))

casting_director_agent = AnthropicAgent(AnthropicAgentOptions(
    api_key=os.getenv('ANTHROPIC_API_KEY', None),
    name="CastingDirectorAgent",
    description="""\
You are a talented casting director. Given a script outline and character descriptions,\
suggest suitable actors for the main roles, considering their past performances and current availability.

Your tasks consist of:
1. Suggest 1-2 actors for each main role.
2. Check actors' current status using search_web tool
3. Provide a brief explanation for each casting suggestion.
4. Consider diversity and representation in your casting choices.
5. Provide a final response with all the actors you suggest for the main roles
""",

tool_config={
    'tool': [search_web_tool.to_claude_format()],
    'toolMaxRecursions': 20,
    'useToolHandler': tool_handler
    },
    save_chat=False
))

movie_producer_supervisor = AnthropicAgent(AnthropicAgentOptions(
    api_key=os.getenv('ANTHROPIC_API_KEY', None),
    name='MovieProducerAgent',
    description="""
Experienced movie producer overseeing script and casting.

Your tasks consist of:
1. Ask ScriptWriter Agent for a script outline based on the movie idea.
2. Pass the outline to CastingDirectorAgent for casting suggestions.
3. Summarize the script outline and casting suggestions.
4. Provide a concise movie concept overview.
5. Make sure to respond with a markdown format without mentioning it.
""",
))

supervisor = SupervisorMode(SupervisorModeOptions(
    supervisor=movie_producer_supervisor,
    team=[script_writer_agent, casting_director_agent],
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

# Input field for the report query
movie_idea = st.text_area("Describe your movie idea in a few sentences:")
genre = st.selectbox("Select the movie genre:",
                        ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Romance", "Thriller"])
target_audience = st.selectbox("Select the target audience:",
                                ["General", "Children", "Teenagers", "Adults", "Mature"])
estimated_runtime = st.slider("Estimated runtime (in minutes):", 30, 180, 120)

# Process the movie concept
if st.button("Develop Movie Concept"):
    with st.spinner("Developing movie concept..."):
        input_text = (
            f"Movie idea: {movie_idea}, Genre: {genre}, "
            f"Target audience: {target_audience}, Estimated runtime: {estimated_runtime} minutes"
        )
        # Get the response from the assistant
        response = asyncio.run(handle_request(orchestrator, input_text, USER_ID, SESSION_ID))
        st.write(response)