import readline from "readline";
import {
  MultiAgentOrchestrator,
  Logger,
  BedrockFlowsAgent,
  Agent,
} from "multi-agent-orchestrator";


const flowInputEncoder = (
    agent: Agent,
    input: string,
    kwargs: {
        userId?: string,
        sessionId?: string,
        chatHistory?: any[],
        [key: string]: any  // This allows any additional properties
      }
) => {
    const chat_history_string = kwargs.chatHistory?.map((message: { role: string; content: { text?: string }[] }) =>
      `${message.role}:${message.content[0]?.text || ''}`
    )
    .join('\n');

    if (agent == flowTechAgent){
        return {
        "question":input,
        "history":chat_history_string
        };
    } else {
        return input
    }
}

const flowTechAgent = new BedrockFlowsAgent({
    name: "Tech Agent",
    description:
      "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
    flowIdentifier:'BEDROCK-FLOW-ID',
    flowAliasIdentifier:'BEDROCK-FLOW-ALIAS-ID',
    flowInputEncoder: flowInputEncoder
  });

function createOrchestrator(): MultiAgentOrchestrator {
  const orchestrator = new MultiAgentOrchestrator({
    config: {
      LOG_AGENT_CHAT: true,
      LOG_EXECUTION_TIMES: true,
      MAX_MESSAGE_PAIRS_PER_AGENT: 10,
    },
    logger: console,
  });

  // Add a Tech Agent to the orchestrator
  orchestrator.addAgent(
    flowTechAgent
  );

  return orchestrator;
}

const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Function to run local conversation
async function runLocalConversation(): Promise<void> {
  const orchestrator = createOrchestrator();
  // Generate random uuid 4

  const userId = uuidv4();
  const sessionId = uuidv4();

  const allAgents = orchestrator.getAllAgents();
  Logger.logger.log("Here are the existing agents:");
  for (const agentKey in allAgents) {
    const agent = allAgents[agentKey];
    Logger.logger.log(`Name: ${agent.name}`);
    Logger.logger.log(`Description: ${agent.description}`);
    Logger.logger.log("--------------------");
  }

  orchestrator.analyzeAgentOverlap();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  Logger.logger.log(
    "Welcome to the interactive AI agent. Type your queries and press Enter. Type 'exit' to end the conversation."
  );

  const askQuestion = (): void => {
    rl.question("You: ", async (userInput: string) => {
      if (userInput.toLowerCase() === "exit") {
        Logger.logger.log("Thank you for using the AI agent. Goodbye!");
        rl.close();
        return;
      }

      try {

        const response = await orchestrator.agentProcessRequest(
            userInput,
            userId,
            sessionId,
            {
                selectedAgent:flowTechAgent,
                confidence:1.0
            }
        );

        // Handle non-streaming response (AgentProcessingResult)
        Logger.logger.log("\n** RESPONSE ** \n");
        Logger.logger.log(`> Agent ID: ${response.metadata.agentId}`);
        Logger.logger.log(`> Agent Name: ${response.metadata.agentName}`);
        Logger.logger.log(`> User Input: ${response.metadata.userInput}`);
        Logger.logger.log(`> User ID: ${response.metadata.userId}`);
        Logger.logger.log(`> Session ID: ${response.metadata.sessionId}`);
        Logger.logger.log(
        `> Additional Parameters:`,
        response.metadata.additionalParams
        );
        Logger.logger.log(`\n> Response: ${response.output}`);
      } catch (error) {
        Logger.logger.error("Error:", error);
      }
      askQuestion(); // Continue the conversation
    });
  };

  askQuestion(); // Start the conversation
}

// Check if this script is being run directly (not imported as a module)
if (require.main === module) {
  // This block will only run when the script is executed locally
  runLocalConversation();
}
