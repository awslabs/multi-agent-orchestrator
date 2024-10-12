import { Logger } from "@aws-lambda-powertools/logger";
import {
  MultiAgentOrchestrator,
  BedrockLLMAgent,
  DynamoDbChatStorage,
  LexBotAgent,
  AmazonBedrockAgent,
  LambdaAgent,
  BedrockClassifier,
  Agent,
} from "multi-agent-orchestrator";
import { weatherToolDescription, weatherToolHanlder } from './weather_tool'
import { mathToolHanlder, mathAgentToolDefinition } from './math_tool';
import { APIGatewayProxyEventV2, Handler, Context } from "aws-lambda";
import { Buffer } from "buffer";
import { GREETING_AGENT_PROMPT, HEALTH_AGENT_PROMPT, MATH_AGENT_PROMPT, TECH_AGENT_PROMPT, WEATHER_AGENT_PROMPT } from "./prompts";

const logger = new Logger();

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: APIGatewayProxyEventV2,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): Handler;
  }
}

interface LexAgentConfig {
  name: string;
  description: string;
  botId: string;
  botAliasId: string;
  localeId: string;
}

interface BedrockAgentConfig {
  name: string;
  description: string;
  agentId: string;
  agentAliasId: string;
}

interface BodyData {
  query: string;
  sessionId: string;
  userId: string;
}

const LEX_AGENT_ENABLED = process.env.LEX_AGENT_ENABLED || "false";
const BEDROCK_AGENT_ENABLED = process.env.BEDROCK_AGENT_ENABLED || "false";

const storage = new DynamoDbChatStorage(
  process.env.HISTORY_TABLE_NAME!,
  process.env.AWS_REGION!,
  process.env.HISTORY_TABLE_TTL_KEY_NAME,
  Number(process.env.HISTORY_TABLE_TTL_DURATION),
);

const orchestrator = new MultiAgentOrchestrator({
  storage: storage,
  config: {
    LOG_AGENT_CHAT: true,
    LOG_CLASSIFIER_CHAT: true,
    LOG_CLASSIFIER_RAW_OUTPUT: true,
    LOG_CLASSIFIER_OUTPUT: true,
    LOG_EXECUTION_TIMES: true,
  },
  logger: logger,
  classifier: new BedrockClassifier({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
  }),
});



const techAgent = new BedrockLLMAgent({
  name: "Tech Agent",
  description:
    "Specializes in a wide range of technology areas, including software development, hardware, AI, cybersecurity, blockchain, cloud computing, and emerging tech innovations. Handles inquiries related to pricing, costs, and technical details of technology products and services except for the multi-agent orchestrator framework and its components.",
  streaming: true,
  inferenceConfig: {
    temperature: 0.1,
  },
});

techAgent.setSystemPrompt(TECH_AGENT_PROMPT);

const healthAgent = new BedrockLLMAgent({
  name: "Health Agent",
  description:
    "Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.",
});

healthAgent.setSystemPrompt(HEALTH_AGENT_PROMPT);

const weatherAgent = new BedrockLLMAgent({
  name: "Weather Agent",
  description: "Specialized agent for giving weather condition from a city.",
  streaming: true,
  inferenceConfig: {
    temperature: 0.0,
  },
  toolConfig: {
    useToolHandler: weatherToolHanlder,
    tool: weatherToolDescription,
    toolMaxRecursions: 5,
  },
});

weatherAgent.setSystemPrompt(WEATHER_AGENT_PROMPT);

// Add a our custom Math Agent to the orchestrator
const mathAgent = new BedrockLLMAgent({
  name: "Math Agent",
  description:
    "Specialized agent for solving mathematical problems. Can dynamically create and execute mathematical operations, handle complex calculations, and explain mathematical concepts. Capable of working with algebra, calculus, statistics, and other advanced mathematical fields.",
  streaming: false,
  inferenceConfig: {
    temperature: 0.0,
  },
  toolConfig: {
    useToolHandler: mathToolHanlder,
    tool: mathAgentToolDefinition,
    toolMaxRecursions: 5,
  },
});
mathAgent.setSystemPrompt(MATH_AGENT_PROMPT);



if (LEX_AGENT_ENABLED === "true") {
  const config: LexAgentConfig = JSON.parse(process.env.LEX_AGENT_CONFIG!);
  orchestrator.addAgent(
    new LexBotAgent({
      name: config.name,
      description: config.description,
      botId: config.botId,
      botAliasId: config.botAliasId,
      localeId: config.localeId,
    })
  );
}

if (process.env.LAMBDA_AGENTS){
  const lambdaAgents = JSON.parse(process.env.LAMBDA_AGENTS);
  for (const agent of lambdaAgents) {
    orchestrator.addAgent(new LambdaAgent({
      name: agent.name,
      description: agent.description,
      functionName: agent.functionName,
      functionRegion: agent.region
    }
    ));
  }
}

if (BEDROCK_AGENT_ENABLED === "true") {
  const config: BedrockAgentConfig = JSON.parse(
    process.env.BEDROCK_AGENT_CONFIG!
  );
  orchestrator.addAgent(
    new AmazonBedrockAgent({
      name: "Multi-Agent-Orchestrator Documentation Agent",
      //description: "You specialize in the Multi-Agent Orchestrator framework, which manages multiple AI agents and handles complex conversations. You provide comprehensive support for integrating, configuring, and customizing agents within the orchestrator. You also handle queries about the framework's extensible architecture, dual language support, and deployment flexibility across various environments. Your expertise includes helping users with pre-built agents, agent creation, usage, and optimizing orchestrator workflows for different use cases",
      description: "Specializes in a wide range of technology areas, including software development, hardware, AI, cybersecurity, blockchain, cloud computing, and emerging tech innovations. Handles inquiries related to pricing, costs, and technical details of technology products and services except for the multi-agent orchestrator framework and its components.",
      agentId: config.agentId,
      agentAliasId: config.agentAliasId,
    })
  );
}

//orchestrator.addAgent(techAgent);
orchestrator.addAgent(healthAgent);
orchestrator.addAgent(weatherAgent);
orchestrator.addAgent(mathAgent);

const greetingAgent = new BedrockLLMAgent({
  name: "Greeting Agent",
  description: "Welcome the user and list him the available agents",
  streaming: true,
  inferenceConfig: {
    temperature: 0.0,
  },
  saveChat: false,
});

const agents = orchestrator.getAllAgents();
const agentList = Object.entries(agents)
  .map(([agentKey, agentInfo], index) => {
    const name = (agentInfo as any).name || agentKey;
    const description = (agentInfo as any).description;
    return `${index + 1}. **${name}**: ${description}`;
  })
  .join('\n\n');
greetingAgent.setSystemPrompt(GREETING_AGENT_PROMPT(agentList));



orchestrator.addAgent(greetingAgent);


async function eventHandler(
  event: APIGatewayProxyEventV2,
  responseStream: NodeJS.WritableStream
) {
  logger.info(event);

  try {
    const userBody = JSON.parse(event.body as string) as BodyData;
    const userId = userBody.userId;
    const sessionId = userBody.sessionId;

    logger.info("calling the orchestrator");
    const response = await orchestrator.routeRequest(
      userBody.query,
      userId,
      sessionId
    );

    logger.info("response from the orchestrator");

    let safeBuffer = Buffer.from(
      JSON.stringify({
        type: "metadata",
        data: response,
      }) + "\n",
      "utf8"
    );

    responseStream.write(safeBuffer);

    if (response.streaming == true) {
      logger.info("\n** RESPONSE STREAMING ** \n");
      // Send metadata immediately
      logger.info(` > Agent ID: ${response.metadata.agentId}`);
      logger.info(` > Agent Name: ${response.metadata.agentName}`);

      logger.info(`> User Input: ${response.metadata.userInput}`);
      logger.info(`> User ID: ${response.metadata.userId}`);
      logger.info(`> Session ID: ${response.metadata.sessionId}`);
      logger.info(
        `> Additional Parameters:`,
        response.metadata.additionalParams
      );
      logger.info(`\n> Response: `);

      for await (const chunk of response.output) {
        if (typeof chunk === "string") {
          process.stdout.write(chunk);

          safeBuffer = Buffer.from(
            JSON.stringify({
              type: "chunk",
              data: chunk,
            }) + "\n"
          );

          responseStream.write(safeBuffer);
        } else {
          logger.error("Received unexpected chunk type:", typeof chunk);
        }
      }
    } else {
      // Handle non-streaming response (AgentProcessingResult)
      logger.info("\n** RESPONSE ** \n");
      logger.info(` > Agent ID: ${response.metadata.agentId}`);
      logger.info(` > Agent Name: ${response.metadata.agentName}`);
      logger.info(`> User Input: ${response.metadata.userInput}`);
      logger.info(`> User ID: ${response.metadata.userId}`);
      logger.info(`> Session ID: ${response.metadata.sessionId}`);
      logger.info(
        `> Additional Parameters:`,
        response.metadata.additionalParams
      );
      logger.info(`\n> Response: ${response.output}`);

      safeBuffer = Buffer.from(
        JSON.stringify({
          type: "complete",
          data: response.output,
        })
      );

      responseStream.write(safeBuffer);
    }
  } catch (error) {
    logger.error("Error: " + error);

    responseStream.write(
      JSON.stringify({
        response: error,
      })
    );
  } finally {
    responseStream.end();
  }
}

export const handler = awslambda.streamifyResponse(eventHandler);
