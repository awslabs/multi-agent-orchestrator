import { SQSEvent, SQSHandler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import {
  MultiAgentOrchestrator,
  DynamoDbChatStorage,
} from 'multi-agent-orchestrator';
import { HumanAgent, orderManagementAgent, productInfoAgent } from './agents';
import { SQSLogger } from './sqsLogger';

const sqs = new SQSClient({});
let orchestrator: MultiAgentOrchestrator | null = null;

if (!process.env.QUEUE_URL) {
  throw new Error('QUEUE_URL not set');
}

const storage = new DynamoDbChatStorage(
  process.env.HISTORY_TABLE_NAME!,
  process.env.AWS_REGION!,
  process.env.HISTORY_TABLE_TTL_KEY_NAME,
  Number(process.env.HISTORY_TABLE_TTL_DURATION),
);

// Async initialization function for the orchestrator
const initializeOrchestrator = async (): Promise<MultiAgentOrchestrator> => {

  if (!orchestrator) {
    const sqsLogger = new SQSLogger(process.env.QUEUE_URL!, "log");

    orchestrator = new MultiAgentOrchestrator({
      storage: storage,
      config: {
        LOG_AGENT_CHAT: true,
        LOG_CLASSIFIER_CHAT: true,
        LOG_CLASSIFIER_RAW_OUTPUT: true,
        LOG_CLASSIFIER_OUTPUT: true,
        LOG_EXECUTION_TIMES: true,
        MAX_MESSAGE_PAIRS_PER_AGENT: 10,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: false,
      },
      logger: sqsLogger,
    });

    const humanAgent = new HumanAgent({
      name: "Human Agent",
      description: "Handles complex inquiries, complaints, or sensitive issues requiring human expertise.",
      saveChat: false,
      queueUrl: process.env.QUEUE_URL!
    });


    // Add additional agents
    orchestrator.addAgent(orderManagementAgent);
    orchestrator.addAgent(productInfoAgent);
    orchestrator.addAgent(humanAgent);
  }

  return orchestrator;
};

// Orchestrator initialization promise to be awaited before the handler is called
let orchestratorPromise: Promise<MultiAgentOrchestrator> | null = null;

export const handler: SQSHandler = async (event: SQSEvent) => {

  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!orchestratorPromise) {
    orchestratorPromise = initializeOrchestrator(); // Initialize if not done already
  }

  const orchestrator = await orchestratorPromise;

  // Get the queue URL from environment variables
  const queueUrl = process.env.QUEUE_URL;
  if (!queueUrl) {
    throw new Error("QUEUE_URL environment variable is not set");
  }

  // Process each record in the SQS event
  for (const record of event.Records) {
    try {
      // Parse the message body
      const body = JSON.parse(record.body);
      const sessionId = body.sessionId;

      console.log(`Calling the orchestrator sessionId:${sessionId}, message: ${body.message}`)

       const orchestratorResponse = await orchestrator.routeRequest(
        body.message,
        sessionId,
        sessionId
      );
      console.log("orchestratorResponse="+JSON.stringify(orchestratorResponse));

      // Create the message object using data from the SQS event
       const message = {
        destination: "customer",
        message: orchestratorResponse.output,
      };

      // Send the message to another SQS queue
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
      });

      const response = await sqs.send(command);
      console.log('Message sent to SQS:', response.MessageId);
    } catch (error) {
      console.error('Error processing record:', error);
      // You might want to handle this error differently depending on your requirements
    }
  }

  return {
    message: `Processed ${event.Records.length} messages`
  };
};