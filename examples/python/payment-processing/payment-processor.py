import uuid
import asyncio
import os
import sys
import streamlit as st
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (
    ChainAgent, ChainAgentOptions,
    BedrockLLMAgent, BedrockLLMAgentOptions
)
from multi_agent_orchestrator.utils import AgentTool, AgentTools
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, AgentResponse, ClassifierResult, ConversationMessage
sys.path.append(os.path.join(os.path.dirname(__file__), 'payment_backend'))

from payment_helper import PaymentHelper

data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "payment_backend", "workers.json")
payment_tools = PaymentHelper(data_file)

async def validate_payment_request(worker_id: str, payment_amount: float) -> str:
    return payment_tools.validate_payment_request(worker_id, payment_amount)

async def detect_fraud(worker_id: str, payment_amount: float, device_id: str, location_id: str) -> str:
    return payment_tools.detect_fraud(worker_id, payment_amount, device_id, location_id)

async def issue_payment(worker_id: str, payment_amount: float) -> str:
    return payment_tools.issue_payment(worker_id, payment_amount)

validation_tool = AgentTool(
    name="validate_payment_request",
    description="Validates if the worker is eligible for early payment.",
    properties={
        "worker_id": {"type": "string"},
        "payment_amount": {"type": "number"},
    },
    required=["worker_id", "payment_amount"],
    func=validate_payment_request
)

validation_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name='ValidationAgent',
    model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
    custom_system_prompt={'template': "Validates payment requests for the workers and then pass to fruad agent with all the details(worker id, payment_amount, device_id and location_id) you recieved along with your response.", "variables":{}},
    description='Validates payment requests for the workers and then pass to fruad agent with all the details(worker id, payment_amount, device_id and location_id) you recieved along with your response.',
    tool_config={
        'tool': AgentTools(tools=[validation_tool]),
        'toolMaxRecursions': 5
    }
))

fraud_detection_tool = AgentTool(
    name="detect_fraud",
    description="Analyzes payment requests for unusual patterns.",
    properties={
        "worker_id": {"type": "string"},
        "payment_amount": {"type": "number"},
        "device_id": {"type": "string"},
        "location_id": {"type": "string"}
    },
    required=["worker_id", "payment_amount", "device_id", "location_id"],
    func=detect_fraud
)

fraud_detection_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name='FraudDetectionAgent',
    model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
    custom_system_prompt={'template': "You receive response from ValidationAgent. You analyze the payment request for unusual patterns and then pass to payment agent with all the details (workerd id, payment amount, fraud check and validation check results) you recieved along with your response.", "variables":{}},
    description='You receive response from ValidationAgent. You analyze the payment request for unusual patterns and then pass to payment agent with all the details (workerd id, payment amount, fraud check and validation check results) you recieved along with your response.',
    tool_config={
        'tool': AgentTools(tools=[fraud_detection_tool]),
        'toolMaxRecursions': 5
    }
))

payment_tool = AgentTool(
    name="issue_payment",
    description="Issues payment to the worker if all checks pass.",
    properties={
        "worker_id": {"type": "string"},
        "payment_amount": {"type": "number"}
    },
    required=["worker_id", "payment_amount"],
    func=issue_payment
)

payment_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    name='PaymentAgent',
    model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
    custom_system_prompt={'template': "You recieive a response from validation and fruad agents. You issue payments to the worker if all checks passed from previous agents including yourself, otherwise not and respond a breif response with what checks are failed (keep the response short and remember you are responding to the user directly. so, approach them accordingly). DO NOT talk about any tool usage in your response", "variables":{}},
    description='You recieive a response from validation and fruad agents. You issue payments to the worker if all checks passed from previous agents including yourself, otherwise not and respond a breif response with what checks are failed (keep it short).',
    tool_config={
        'tool': AgentTools(tools=[payment_tool]),
        'toolMaxRecursions': 5
    }
))

chain_agent = ChainAgent(ChainAgentOptions(
    name='PaymentProcessingChain',
    description='Processes payment requests sequentially through validation, fraud detection, and payment issuance.',
    agents=[validation_agent, fraud_detection_agent, payment_agent]
))

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
orchestrator.add_agent(chain_agent)

async def handle_request(_orchestrator: MultiAgentOrchestrator, _worker_id: str, _payment_amount: float, _device_id: str, _location_id:str, _user_id: str, _session_id: str):
    input_data = f"worker_id: {_worker_id}, payment_amount: {_payment_amount}, device_id: {_device_id}, location_id: {_location_id}"
    classifier_result = ClassifierResult(selected_agent=chain_agent, confidence=1.0)
    try:
        response: AgentResponse = await _orchestrator.agent_process_request(input_data, _user_id, _session_id, classifier_result)
        
        # Print metadata
        print("\nMetadata:")
        print(f"Selected Agent: {response.metadata.agent_name}")
        if isinstance(response, AgentResponse) and not response.streaming:
            if isinstance(response.output, str):
                return response.output
            elif isinstance(response.output, ConversationMessage):
                return response.output.content[0].get('text')
    except Exception as e:
        st.error(f"An error occurred: {e}")
        raise e  # Re-raise the exception to see the full traceback in the logs

worker_id = st.text_input("Enter Worker ID:")
payment_amount = st.number_input("Enter Payment Amount:", step=50.0, min_value=0.0, value=500.0)
device_id = st.text_input("Enter Device ID:")
location_id = st.text_input("Enter Location:")

USER_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())

if st.button("Process Payment"):
    if not worker_id or not device_id or not location_id:
        st.error("Please enter valid Worker ID, Device ID and Location.")
    else:
        with st.spinner("Processing Payment..."):
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                response = loop.run_until_complete(handle_request(orchestrator, worker_id, payment_amount, device_id, location_id, USER_ID, SESSION_ID))
                st.write("### Payment Processing Result")
                st.write(response)
            except Exception as e:
                st.error(f"An error occurred: {e}")