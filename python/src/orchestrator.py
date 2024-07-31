from typing import Dict, Any, AsyncIterable, Optional, Union
import time
from .utils.logger import Logger
from .types import ConversationMessage, ParticipantRole
from .classifiers.classifier import Classifier, ClassifierResult
from .classifiers.bedrock_classifier import BedrockClassifier, BedrockClassifierOptions
from .agents.agent import Agent, AgentResponse, AgentProcessingResult
from .agents.bedrock_llm_agent import BedrockLLMAgent, BedrockLLMAgentOptions
from .storage.in_memory_chat_storage import InMemoryChatStorage
from .storage.chat_storage import ChatStorage
from dataclasses import dataclass, fields, asdict, replace


@dataclass
class OrchestratorConfig:
    LOG_AGENT_CHAT: bool = False
    LOG_CLASSIFIER_CHAT: bool = False
    LOG_CLASSIFIER_RAW_OUTPUT: bool = False
    LOG_CLASSIFIER_OUTPUT: bool = False
    LOG_EXECUTION_TIMES: bool = False
    MAX_RETRIES: int = 3
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: bool = True
    CLASSIFICATION_ERROR_MESSAGE: str = "I'm sorry, an error occurred while processing your request. Please try again later."
    NO_SELECTED_AGENT_MESSAGE: str = "I'm sorry, I couldn't determine how to handle your request. Could you please rephrase it?"
    GENERAL_ROUTING_ERROR_MSG_MESSAGE: str = "An error occurred while processing your request. Please try again later."
    MAX_MESSAGE_PAIRS_PER_AGENT: int = 100

DEFAULT_CONFIG = OrchestratorConfig()

@dataclass
class MultiAgentOrchestrator:
    def __init__(self, 
                 options: OrchestratorConfig = DEFAULT_CONFIG, 
                 storage: ChatStorage = InMemoryChatStorage(), 
                 classifer: Classifier = BedrockClassifier(options=BedrockClassifierOptions()),
                 logger: Logger = None):
        
        if options is None:
            options = {}
        if isinstance(options, dict):
            # Filter out keys that are not part of OrchestratorConfig fields
            valid_keys = {f.name for f in fields(OrchestratorConfig)}
            options = {k: v for k, v in options.items() if k in valid_keys}
            options = OrchestratorConfig(**options)
        elif not isinstance(options, OrchestratorConfig):
            raise ValueError("options must be a dictionary or an OrchestratorConfig instance")


        self.config = replace(DEFAULT_CONFIG, **asdict(options))
        self.storage = storage
        

        self.logger = Logger(self.config, logger)
        self.agents: Dict[str, Agent] = {}
        self.classifier: Classifier = classifer
        self.execution_times: Dict[str, float] = {}
        self.default_agent: Agent = BedrockLLMAgent(
            options=BedrockLLMAgentOptions(
                name="DEFAULT", 
                streaming=True, 
                description="A knowledgeable generalist capable of addressing a wide range of topics.",
            ))   
            

    def add_agent(self, agent: Agent):
        if agent.id in self.agents:
            raise ValueError(f"An agent with ID '{agent.id}' already exists.")
        self.agents[agent.id] = agent
        self.classifier.set_agents(self.agents)

    def get_default_agent(self) -> Agent:
        return self.default_agent

    def set_default_agent(self, agent: Agent):
        self.default_agent = agent

    def set_classifier(self, intent_classifier: Classifier):
        self.classifier = intent_classifier

    def get_all_agents(self) -> Dict[str, Dict[str, str]]:
        return {key: {"name": agent.name, "description": agent.description} for key, agent in self.agents.items()}

    async def dispatch_to_agent(self, params: Dict[str, Any]) -> Union[ConversationMessage, AsyncIterable[Any]]:
        user_input = params['user_input']
        user_id = params['user_id']
        session_id = params['session_id']
        classifier_result:ClassifierResult = params['classifier_result']
        additional_params = params.get('additional_params', {})

        if not classifier_result.selectedAgent:
            return "I'm sorry, but I need more information to understand your request. Could you please be more specific?"

        selected_agent = classifier_result.selectedAgent
        agent_chat_history = await self.storage.fetch_chat(user_id, session_id, selected_agent.id)

        self.logger.print_chat_history(agent_chat_history, selected_agent.id)   
        self.logger.info(f"Routing intent '{user_input}' to {selected_agent.id} ...")

        response = await self.measure_execution_time(
            f"Agent {selected_agent.name} | Processing request",
            lambda: selected_agent.process_request(user_input, user_id, session_id, agent_chat_history, additional_params)
        )

        return response

    async def route_request(self, user_input: str, user_id: str, session_id: str, additional_params: Dict[str, str] = {}) -> AgentResponse:
        self.execution_times.clear()
        chat_history = await self.storage.fetch_all_chats(user_id, session_id) or []

        try:
            classifier_result:ClassifierResult = await self.measure_execution_time(
                "Classifying user intent",
                lambda: self.classifier.classify(user_input, chat_history)
            )

            if self.config.LOG_CLASSIFIER_OUTPUT:
                self.print_intent(user_input, classifier_result)

        except Exception as error:
            self.logger.error("Error during intent classification:", error)
            return AgentResponse(
                metadata=self.create_metadata(None, user_input, user_id, session_id, additional_params),
                output=self.config.CLASSIFICATION_ERROR_MESSAGE,
                streaming=False
            )

        if not classifier_result.selectedAgent:
            if self.config.USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED:
                classifier_result = self.get_fallback_result()
                self.logger.info("Using default agent as no agent was selected")
            else:
                return AgentResponse(
                    metadata= self.create_metadata(classifier_result, user_input, user_id, session_id, additional_params),
                    output= self.config.NO_SELECTED_AGENT_MESSAGE,
                    streaming=False
                )

        try:
            agent_response = await self.dispatch_to_agent({
                "user_input": user_input,
                "user_id": user_id,
                "session_id": session_id,
                "classifier_result": classifier_result,
                "additional_params": additional_params
            })

            metadata = self.create_metadata(classifier_result, user_input, user_id, session_id, additional_params)

            # save question
            await self.save_message(ConversationMessage(role=ParticipantRole.USER.value, content=[{'text':user_input}]), user_id, session_id, classifier_result.selectedAgent)

            if isinstance(agent_response, ConversationMessage):
                # save the response
                await self.save_message(agent_response, user_id, session_id, classifier_result.selectedAgent)


            return AgentResponse(
                    metadata=metadata,
                    output=agent_response,
                    streaming=False
                )

        except Exception as error:
            self.logger.error("Error during agent dispatch or processing:", error)
            return AgentResponse(
                    metadata= self.create_metadata(classifier_result, user_input, user_id, session_id, additional_params),
                    output= self.config.GENERAL_ROUTING_ERROR_MSG_MESSAGE,
                    streaming=False
                )

        finally:
            self.logger.print_execution_times(self.execution_times)

        
    def print_intent(self, user_input: str, intent_classifier_result: ClassifierResult) -> None:
        """Print the classified intent."""
        Logger.log_header('Classified Intent')
        Logger.logger.info(f"> Text: {user_input}")
        Logger.logger.info(f"> Selected Agent: {intent_classifier_result.selectedAgent.name if intent_classifier_result.selectedAgent else 'No agent selected'}")
        Logger.logger.info(f"> Confidence: {intent_classifier_result.confidence:.2f}")
        Logger.logger.info('')

    # async def process_stream_in_background(self, agent_response: AsyncIterable[Any], accumulator_transform: AccumulatorTransform,
    #                                        user_input: str, user_id: str, session_id: str, agent: Agent):
    #     stream_start_time = time.time()
    #     chunk_count = 0

    #     try:
    #         async for chunk in agent_response:
    #             if chunk_count == 0:
    #                 first_chunk_time = time.time()
    #                 time_to_first_chunk = first_chunk_time - stream_start_time
    #                 self.execution_times["Time to first chunk"] = time_to_first_chunk
    #                 self.logger.print_execution_times(self.execution_times)

    #             accumulator_transform.write(chunk)
    #             chunk_count += 1

    #         accumulator_transform.end()
    #         self.logger.debug(f"Streaming completed: {chunk_count} chunks received")

    #         full_response = accumulator_transform.get_accumulated_data()
    #         if full_response and agent.save_chat:
    #             await save_conversation_exchange(
    #                 user_input,
    #                 full_response,
    #                 self.storage,
    #                 user_id,
    #                 session_id,
    #                 agent.id
    #             )
    #         else:
    #             self.logger.warn("No data accumulated, messages not saved")

    #     except Exception as error:
    #         self.logger.error("Error processing stream:", error)

    async def measure_execution_time(self, timer_name: str, fn):
        if not self.config.LOG_EXECUTION_TIMES:
            return await fn()

        start_time = time.time()
        self.execution_times[timer_name] = start_time

        try:
            result = await fn()
            end_time = time.time()
            duration = end_time - start_time
            self.execution_times[timer_name] = duration
            return result
        except Exception as error:
            end_time = time.time()
            duration = end_time - start_time
            self.execution_times[timer_name] = duration
            raise error

    def create_metadata(self, intent_classifier_result: Optional[ClassifierResult], user_input: str,
                        user_id: str, session_id: str, additional_params: Dict[str, str]) -> AgentProcessingResult:
        base_metadata = AgentProcessingResult(
            user_input=user_input,
            agent_id="no_agent_selected",
            agent_name="No Agent",
            user_id=user_id,
            session_id=session_id,
            additional_params=additional_params
        )

        if not intent_classifier_result or not intent_classifier_result.selectedAgent:
            base_metadata.additional_params['error_type'] = 'classification_failed'
        else:
           base_metadata.agent_id = intent_classifier_result.selectedAgent.id
           base_metadata.agent_name = intent_classifier_result.selectedAgent.name

        return base_metadata

    def get_fallback_result(self) -> ClassifierResult:
        return ClassifierResult(selectedAgent=self.get_default_agent(), confidence=0)
    
    async def save_message(self, message: ConversationMessage, user_id: str, session_id: str, agent: Agent):
        if agent and agent.save_chat:
            return await self.storage.save_chat_message(user_id, session_id, agent.id, message, self.config.MAX_MESSAGE_PAIRS_PER_AGENT)