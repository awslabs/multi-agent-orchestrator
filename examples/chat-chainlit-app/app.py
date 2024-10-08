import uuid
import chainlit as cl
from orchestrator import MultiAgentOrchestrator, OrchestratorConfig, BedrockClassifier, BedrockClassifierOptions
from agents import create_tech_agent, create_travel_agent, create_health_agent
from multi_agent_orchestrator.classifiers import ClassifierResult
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.types import ParticipantRole


# Initialize the orchestrator
custom_bedrock_classifier = BedrockClassifier(BedrockClassifierOptions(
    model_id='anthropic.claude-3-haiku-20240307-v1:0',
    inference_config={
        'maxTokens': 500,
        'temperature': 0.7,
        'topP': 0.9
    }
))

orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
    LOG_AGENT_CHAT=True,
    LOG_CLASSIFIER_CHAT=True,
    LOG_CLASSIFIER_RAW_OUTPUT=True,
    LOG_CLASSIFIER_OUTPUT=True,
    LOG_EXECUTION_TIMES=True,
    MAX_RETRIES=3,
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=False,
    MAX_MESSAGE_PAIRS_PER_AGENT=10
), classifier=custom_bedrock_classifier)

# Add agents to the orchestrator
orchestrator.add_agent(create_tech_agent())
orchestrator.add_agent(create_travel_agent())
orchestrator.add_agent(create_health_agent())

@cl.on_chat_start
async def start():
    cl.user_session.set("user_id", str(uuid.uuid4()))
    cl.user_session.set("session_id", str(uuid.uuid4()))
    cl.user_session.set("chat_history", [])

@cl.step(type="tool")
async def classify(user_query):
    user_id = cl.user_session.get("user_id")
    session_id = cl.user_session.get("session_id")

    chat_history = await orchestrator.storage.fetch_all_chats(user_id, session_id) or []

    # Perform classification
    classifier_result:ClassifierResult = await orchestrator.classifier.classify(user_query, chat_history)

    cl.user_session.set("chat_history", chat_history)

    # Prepare the output message
    output = "**Classifying Intent** \n"
    # output += "=======================\n"
    output += f"> Text: {user_query}\n"
    if classifier_result.selected_agent:
            output += f"> Selected Agent: {classifier_result.selected_agent.name}\n"
    else:
            output += "> Selected Agent: No agent found\n"

    output += f"> Confidence: {classifier_result.confidence:.2f}\n"

    return output, classifier_result

@cl.on_message
async def main(message: cl.Message):
    user_id = cl.user_session.get("user_id")
    session_id = cl.user_session.get("session_id")

    msg = cl.Message(content="")
    output, classifier_result = await classify(message.content)
    await cl.Message(content=output).send()



    await msg.send()  # Send the message immediately to start streaming
    cl.user_session.set("current_msg", msg)

    agent_response = await orchestrator.dispatch_to_agent({
                "user_input": message.content,
                "user_id": user_id,
                "session_id": session_id,
                "classifier_result": classifier_result,
                "additional_params": {}
            })
    await orchestrator.save_message(
        ConversationMessage(
            role=ParticipantRole.USER.value,
            content=[{'text':message.content}]
        ),
        user_id,
        session_id,
        classifier_result.selected_agent
    )

    await orchestrator.save_message(
        agent_response,
        user_id,
        session_id,
        classifier_result.selected_agent
    )


    # Handle non-streaming responses
    if classifier_result.selected_agent.streaming is False:
        # Handle regular response
        if isinstance(agent_response, str):
            await msg.stream_token(agent_response)
        elif isinstance(agent_response, ConversationMessage):
                await msg.stream_token(agent_response.content[0].get('text'))
    await msg.update()


if __name__ == "__main__":
    cl.run()