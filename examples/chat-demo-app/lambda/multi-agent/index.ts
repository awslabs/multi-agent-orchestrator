import { Logger } from "@aws-lambda-powertools/logger";
import { 
  MultiAgentOrchestrator,
  BedrockLLMAgent,
  DynamoDbChatStorage,
  LexBotAgent,
  AmazonBedrockAgent,
  LambdaAgent,
  BedrockClassifier,
} from "multi-agent-orchestrator";
import { weatherToolDescription, WEATHER_PROMPT, weatherToolHanlder } from './weather_tool'
import { mathToolHanlder, mathAgentToolDefinition, MATH_AGENT_PROMPT } from './math_tool';
import { APIGatewayProxyEventV2, Handler, Context } from "aws-lambda";
import { Buffer } from "buffer";

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
});

  orchestrator.setClassifier(new BedrockClassifier(
  {
      modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
  }
  ));

orchestrator.addAgent(
  new BedrockLLMAgent({
    name: "Tech Agent",
    description:
      "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
    streaming: true,
    inferenceConfig: {
      temperature: 0.1,
    },
  })
);

orchestrator.addAgent(
  new BedrockLLMAgent({
    name: "Health Agent",
    description:
      "Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.",
  })
);

  const weatherAgent = new BedrockLLMAgent({
    name: "Weather Agent",
    description: "Specialized agent for giving weather condition from a city.",
    streaming: false,
    inferenceConfig: {
      temperature: 0.0,
    },
    toolConfig:{
      useToolHandler: weatherToolHanlder,
      tool: weatherToolDescription,
      toolMaxRecursions: 5
    }
  });
  weatherAgent.setSystemPrompt(WEATHER_PROMPT);
  orchestrator.addAgent(weatherAgent);

  // Add a our custom Math Agent to the orchestrator
  const mathAgent = new BedrockLLMAgent({
    name: "Math Agent",
    description: "Specialized agent for solving mathematical problems. Can dynamically create and execute mathematical operations, handle complex calculations, and explain mathematical concepts. Capable of working with algebra, calculus, statistics, and other advanced mathematical fields.",
    streaming: false,
    inferenceConfig: {
      temperature: 0.0,
    },
    toolConfig:{
      useToolHandler: mathToolHanlder,
      tool: mathAgentToolDefinition,
      toolMaxRecursions: 5
    }
  });
  mathAgent.setSystemPrompt(MATH_AGENT_PROMPT);
  orchestrator.addAgent(mathAgent);

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
      name: config.name,
      description: config.description,
      agentId: config.agentId,
      agentAliasId: config.agentAliasId,
    })
  );
}

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
