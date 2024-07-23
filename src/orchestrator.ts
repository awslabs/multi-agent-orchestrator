import { AgentOverlapAnalyzer } from "./agentOverlapAnalyzer";
import {
  OrchestratorConfig,
  DEFAULT_CONFIG,
  ClassifierResult,
  DispatchToAgentsParams,
  OrchestratorOptions,
  AgentResponse,
  AgentTypes,
  RequestMetadata,
} from "./types/index";
import { Agent } from "./agents/agent";
import { BedrockLLMAgent } from "./agents/bedrockLLMAgent";
import { ChatStorage } from "./storage/chatStorage";
import { InMemoryChatStorage } from "./storage/memoryChatStorage";
import { AccumulatorTransform } from "./utils/helpers";
import { saveChat } from "./utils/chatUtils";
import { Logger } from "./utils/logger";
import { BedrockClassifier } from "./classifiers/bedrockClassifier";
import { Classifier } from "./classifiers/classifier";

export class MultiAgentOrchestrator {
  private config: OrchestratorConfig;
  private storage: ChatStorage;
  private agents: { [key: string]: Agent };
  public classifier: Classifier;
  private executionTimes: Map<string, number>;
  private logger: Logger;
  private defaultAgent: Agent;

  constructor(options: OrchestratorOptions = {}) {
    this.storage = options.storage || new InMemoryChatStorage();
    // Merge the provided config with the DEFAULT_CONFIG
    this.config = {
      LOG_AGENT_CHAT:
        options.config?.LOG_AGENT_CHAT ?? DEFAULT_CONFIG.LOG_AGENT_CHAT,
      LOG_CLASSIFIER_CHAT:
        options.config?.LOG_CLASSIFIER_CHAT ??
        DEFAULT_CONFIG.LOG_CLASSIFIER_CHAT,
      LOG_CLASSIFIER_RAW_OUTPUT:
        options.config?.LOG_CLASSIFIER_RAW_OUTPUT ??
        DEFAULT_CONFIG.LOG_CLASSIFIER_RAW_OUTPUT,
      LOG_CLASSIFIER_OUTPUT:
        options.config?.LOG_CLASSIFIER_OUTPUT ??
        DEFAULT_CONFIG.LOG_CLASSIFIER_OUTPUT,
      LOG_EXECUTION_TIMES:
        options.config?.LOG_EXECUTION_TIMES ??
        DEFAULT_CONFIG.LOG_EXECUTION_TIMES,
      MAX_RETRIES: options.config?.MAX_RETRIES ?? DEFAULT_CONFIG.MAX_RETRIES,
      MAX_MESSAGE_PAIRS_PER_AGENT:
        options.config?.MAX_MESSAGE_PAIRS_PER_AGENT ??
        DEFAULT_CONFIG.MAX_MESSAGE_PAIRS_PER_AGENT,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED:
        options.config?.USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED ??
        DEFAULT_CONFIG.USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED,
        CLASSIFICATION_ERROR_MESSAGE:
        options.config?.CLASSIFICATION_ERROR_MESSAGE ??
        DEFAULT_CONFIG.CLASSIFICATION_ERROR_MESSAGE,  
        NO_SELECTED_AGENT_MESSAGE:
        options.config?.NO_SELECTED_AGENT_MESSAGE ??
        DEFAULT_CONFIG.NO_SELECTED_AGENT_MESSAGE,
        GENERAL_ROUTING_ERROR_MSG_MESSAGE:
        options.config?.GENERAL_ROUTING_ERROR_MSG_MESSAGE ??
        DEFAULT_CONFIG.GENERAL_ROUTING_ERROR_MSG_MESSAGE,    
    };

    this.executionTimes = new Map();

    this.logger = new Logger(options.config, options.logger);

    this.agents = {};
    this.classifier = options.classifier || new BedrockClassifier();

    this.defaultAgent = new BedrockLLMAgent({
      name: AgentTypes.DEFAULT,
      streaming: true,
      description:
        "A knowledgeable generalist capable of addressing a wide range of topics. This agent should be selected if no other specialized agent is a better fit.",
    });

  }

  analyzeAgentOverlap(): void {
    const agents = this.getAllAgents();
    const analyzer = new AgentOverlapAnalyzer(agents);
    analyzer.analyzeOverlap();
  }

  addAgent(agent: Agent): void {
    this.agents[agent.id] = agent;
    this.classifier.setAgents(this.agents);
  }

  getDefaultAgent(): Agent {
    return this.defaultAgent;
  }

  setDefaultAgent(agent: Agent): void {
    this.defaultAgent = agent;
  }

  setClassifier(intentClassifier: Classifier): void {
    this.classifier = intentClassifier;
  }

  getAllAgents(): { [key: string]: { name: string; description: string } } {
    return Object.fromEntries(
      Object.entries(this.agents).map(([key, { name, description }]) => [
        key,
        { name, description },
      ])
    );
  }

  private isAsyncIterable(obj: any): obj is AsyncIterable<any> {
    return obj != null && typeof obj[Symbol.asyncIterator] === "function";
  }

  private async dispatchToAgent(
    params: DispatchToAgentsParams
  ): Promise<string | AsyncIterable<any>> {
    const {
      userInput,
      userId,
      sessionId,
      classifierResult,
      additionalParams = {},
    } = params;

    if (!classifierResult.selectedAgent) {
      return "I'm sorry, but I need more information to understand your request. Could you please be more specific?";
    } else {
      const { selectedAgent } = classifierResult;
      const agentChatHistory = await this.storage.fetchChat(
        userId,
        sessionId,
        selectedAgent.id
      );

      this.logger.printChatHistory(agentChatHistory, selectedAgent.id);

      this.logger.info(
        `Routing intent "${userInput}" to ${selectedAgent.id} ...`
      );

      const response = await this.measureExecutionTime(
        `Agent ${selectedAgent.name} | Processing request`,
        () =>
          selectedAgent.processRequest(
            userInput,
            userId,
            sessionId,
            agentChatHistory,
            additionalParams
          )
      );

      //if (this.isStream(response)) {
      if (this.isAsyncIterable(response)) {
        return response;
      }

      let responseText = "No response content";
      if (
        response.content &&
        response.content.length > 0 &&
        response.content[0].text
      ) {
        responseText = response.content[0].text;
      }

      return responseText;
    }
  }

  async routeRequest(
    userInput: string,
    userId: string,
    sessionId: string,
    additionalParams: Record<string, string> = {}
  ): Promise<AgentResponse> {
    this.executionTimes = new Map();
    let classifierResult: ClassifierResult;
    const chatHistory = (await this.storage.fetchAllChats(userId, sessionId)) || [];
  
    try {
      classifierResult = await this.measureExecutionTime(
        "Classifying user intent",
        () => this.classifier.classify(userInput, chatHistory)
      );
      this.logger.printIntent(userInput, classifierResult);
    } catch (error) {
      this.logger.error("Error during intent classification:", error);
      return {
        metadata: this.createMetadata(null, userInput, userId, sessionId, additionalParams),
        output: this.config.CLASSIFICATION_ERROR_MESSAGE,
        streaming: false,
      };
    }
  
    // Handle case where no agent was selected
    if (!classifierResult.selectedAgent) {
      if (this.config.USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED) {
        classifierResult = this.getFallbackResult();
        this.logger.info("Using default agent as no agent was selected");
      } else {
        return {
          metadata: this.createMetadata(classifierResult, userInput, userId, sessionId, additionalParams),
          output: this.config.NO_SELECTED_AGENT_MESSAGE,
          streaming: false,
        };
      }
    }
  
    try {
      const agentResponse = await this.dispatchToAgent({
        userInput,
        userId,
        sessionId,
        classifierResult,
        additionalParams,
      });
  
      const metadata = this.createMetadata(classifierResult, userInput, userId, sessionId, additionalParams);
  
      if (this.isAsyncIterable(agentResponse)) {
        const accumulatorTransform = new AccumulatorTransform();
        this.processStreamInBackground(
          agentResponse,
          accumulatorTransform,
          userInput,
          userId,
          sessionId,
          metadata
        );
        return {
          metadata,
          output: accumulatorTransform,
          streaming: true,
        };
      }
  
      await saveChat(
        userInput,
        agentResponse,
        this.storage,
        userId,
        sessionId,
        classifierResult.selectedAgent.id,
        this.config.MAX_MESSAGE_PAIRS_PER_AGENT
      );
  
      return {
        metadata,
        output: agentResponse,
        streaming: false,
      };
    } catch (error) {
      this.logger.error("Error during agent dispatch or processing:", error);
      return {
        metadata: this.createMetadata(classifierResult, userInput, userId, sessionId, additionalParams),
        output: this.config.GENERAL_ROUTING_ERROR_MSG_MESSAGE,
        streaming: false,
      };
    } finally {
      this.logger.printExecutionTimes(this.executionTimes);
    }
  }

  private async processStreamInBackground(
    agentResponse: AsyncIterable<any>,
    accumulatorTransform: AccumulatorTransform,
    userInput: string,
    userId: string,
    sessionId: string,
    metadata: any
  ): Promise<void> {
    const streamStartTime = Date.now();
    let chunkCount = 0;

    try {
      for await (const chunk of agentResponse) {
        if (chunkCount === 0) {
          const firstChunkTime = Date.now();
          const timeToFirstChunk = firstChunkTime - streamStartTime;
          this.executionTimes.set("Time to first chunk", timeToFirstChunk);
          this.logger.printExecutionTimes(this.executionTimes);
        }
        accumulatorTransform.write(chunk);
        chunkCount++;
      }

      accumulatorTransform.end();
      this.logger.debug(`Streaming completed: ${chunkCount} chunks received`);

      const fullResponse = accumulatorTransform.getAccumulatedData();
      if (fullResponse) {
        await saveChat(
          userInput,
          fullResponse,
          this.storage,
          userId,
          sessionId,
          metadata.agentId
        );
      } else {
        this.logger.warn("No data accumulated, messages not saved");
      }
    } catch (error) {
      this.logger.error("Error processing stream:", error);

      if (error instanceof Error) {
        accumulatorTransform.destroy(error);
      } else if (typeof error === "string") {
        accumulatorTransform.destroy(new Error(error));
      } else {
        accumulatorTransform.destroy(new Error("An unknown error occurred"));
      }
    }
  }

  private measureExecutionTime<T>(
    timerName: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    if (!this.config.LOG_EXECUTION_TIMES) {
      return Promise.resolve(fn());
    }

    const startTime = Date.now();
    this.executionTimes.set(timerName, startTime);

    return Promise.resolve(fn()).then(
      (result) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.executionTimes.set(timerName, duration);
        return result;
      },
      (error) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.executionTimes.set(timerName, duration);
        throw error;
      }
    );
  }

  private createMetadata(
    intentClassifierResult: ClassifierResult | null,
    userInput: string,
    userId: string,
    sessionId: string,
    additionalParams: Record<string, string>
  ): RequestMetadata {
    const baseMetadata = {
      userInput,
      userId,
      sessionId,
      additionalParams,
    };

    if (!intentClassifierResult || !intentClassifierResult.selectedAgent) {
      return {
        ...baseMetadata,
        agentId: "no_agent_selected",
        agentName: "No Agent",
        errorType: "classification_failed",
      };
    }

    return {
      ...baseMetadata,
      agentId: intentClassifierResult.selectedAgent.id,
      agentName: intentClassifierResult.selectedAgent.name,
    };
  }

  private getFallbackResult(): ClassifierResult {
    return {
      selectedAgent: this.getDefaultAgent(),
      confidence: 0,
    };
  }
}
