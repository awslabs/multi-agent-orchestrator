import {
    BedrockRuntimeClient,
    BedrockAgentRuntimeClient,
    ConverseCommand,
  } from "@aws-sdk/client-bedrock-runtime";
  import { Agent, AgentOptions } from "./agent";
  import {
    BEDROCK_MODEL_ID_CLAUDE_3_HAIKU,
    BEDROCK_MODEL_ID_CLAUDE_3_SONNET,
    ConversationMessage,
    ParticipantRole,
    TemplateVariables,
  } from "../types";
  import { Logger } from "../utils/logger";
  
  export interface BedrockInlineAgentOptions extends AgentOptions {
    inferenceConfig?: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      stopSequences?: string[];
    };
    client?: BedrockRuntimeClient;
    bedrockAgentClient?: BedrockAgentRuntimeClient;
    modelId?: string;
    foundationModel?: string;
    region?: string;
    actionGroupsList: Record<string, any>[];
    knowledgeBases?: Record<string, any>[];
    customSystemPrompt?: {
      template?: string;
      variables?: TemplateVariables;
    };
  }
  
  export class BedrockInlineAgent extends Agent {
    /** Class-level constants */
    protected static readonly TOOL_INPUT_SCHEMA = {
      json: {
        type: "object",
        properties: {
          action_group_names: {
            type: "array",
            items: { type: "string" },
            description: "A string array of action group names needed to solve the customer request"
          },
          knowledge_bases: {
            type: "array",
            items: { type: "string" },
            description: "A string array of knowledge base names needed to solve the customer request"
          },
          description: {
            type: "string",
            description: "Description to instruct the agent how to solve the user request using available action groups"
          },
          user_request: {
            type: "string",
            description: "The initial user request"
          }
        },
        required: ["action_group_names", "description", "user_request"]
      }
    };
  
    protected static readonly KEYS_TO_REMOVE = [
      'actionGroupId',
      'actionGroupState',
      'agentId',
      'agentVersion'
    ];
  
    /** Protected class members */
    protected client: BedrockRuntimeClient;
    protected bedrockAgentClient: BedrockAgentRuntimeClient;
    protected modelId: string;
    protected foundationModel: string;
    protected inferenceConfig: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      stopSequences?: string[];
    };
    protected actionGroupsList: Record<string, any>[];
    protected knowledgeBases: Record<string, any>[];
    protected inlineAgentTool: any[];
    protected toolConfig: {
      tool: any[];
      useToolHandler: (response: ConversationMessage, conversation: ConversationMessage[]) => Promise<ConversationMessage>;
      toolMaxRecursions: number;
    };
  
    private promptTemplate: string;
    private systemPrompt: string = '';
    private customVariables: TemplateVariables = {};
  
    constructor(options: BedrockInlineAgentOptions) {
      super(options);
  
      // Initialize clients
      this.client = options.client ?? (
        options.region
          ? new BedrockRuntimeClient({ region: options.region })
          : new BedrockRuntimeClient()
      );
  
      this.bedrockAgentClient = options.bedrockAgentClient ?? (
        options.region
          ? new BedrockAgentRuntimeClient({ region: options.region })
          : new BedrockAgentRuntimeClient()
      );
  
      // Set model IDs
      this.modelId = options.modelId ?? BEDROCK_MODEL_ID_CLAUDE_3_HAIKU;
      this.foundationModel = options.foundationModel ?? BEDROCK_MODEL_ID_CLAUDE_3_SONNET;
  
      // Set inference configuration
      this.inferenceConfig = options.inferenceConfig ?? {
        maxTokens: 1000,
        temperature: 0.0,
        topP: 0.9,
        stopSequences: []
      };
  
      // Store action groups and knowledge bases
      this.actionGroupsList = options.actionGroupsList;
      this.knowledgeBases = options.knowledgeBases ?? [];
  
      // Define inline agent tool configuration
      this.inlineAgentTool = [{
        toolSpec: {
          name: "inline_agent_creation",
          description: "Create an inline agent with a list of action groups and knowledge bases",
          inputSchema: BedrockInlineAgent.TOOL_INPUT_SCHEMA
        }
      }];
  
      // Configure tool usage
      this.toolConfig = {
        tool: this.inlineAgentTool,
        useToolHandler: this.inlineAgentToolHandler.bind(this),
        toolMaxRecursions: 1
      };
  
      // Set prompt template
      this.promptTemplate = `You are a ${this.name}.
      ${this.description}
      You will engage in an open-ended conversation,
      providing helpful and accurate information based on your expertise.
      The conversation will proceed as follows:
      - The human may ask an initial question or provide a prompt on any topic.
      - You will provide a relevant and informative response.
      - The human may then follow up with additional questions or prompts related to your previous
      response, allowing for a multi-turn dialogue on that topic.
      - Or, the human may switch to a completely new and unrelated topic at any point.
      - You will seamlessly shift your focus to the new topic, providing thoughtful and
      coherent responses based on your broad knowledge base.
      Throughout the conversation, you should aim to:
      - Understand the context and intent behind each new question or prompt.
      - Provide substantive and well-reasoned responses that directly address the query.
      - Draw insights and connections from your extensive knowledge when appropriate.
      - Ask for clarification if any part of the question or prompt is ambiguous.
      - Maintain a consistent, respectful, and engaging tone tailored
      to the human's communication style.
      - Seamlessly transition between topics as the human introduces new subjects.`;
  
      if (options.customSystemPrompt) {
        this.setSystemPrompt(
          options.customSystemPrompt.template,
          options.customSystemPrompt.variables
        );
      }
    }
  
    private async inlineAgentToolHandler(
      response: ConversationMessage,
      conversation: ConversationMessage[]
    ): Promise<ConversationMessage> {
      const responseContentBlocks = response.content;
  
      if (!responseContentBlocks) {
        throw new Error("No content blocks in response");
      }
  
      for (const contentBlock of responseContentBlocks) {
        if ("toolUse" in contentBlock) {
          const toolUseBlock = contentBlock.toolUse;
          const toolUseName = toolUseBlock?.name;
  
          if (toolUseName === "inline_agent_creation") {
            const actionGroupNames = toolUseBlock.input?.action_group_names || [];
            const kbNames = toolUseBlock.input?.knowledge_bases || '';
            const description = toolUseBlock.input?.description || '';
            const userRequest = toolUseBlock.input?.user_request || '';
  
            // Fetch relevant action groups
            const actionGroups = this.actionGroupsList
              .filter(item => actionGroupNames.includes(item.actionGroupName))
              .map(item => {
                const newItem = { ...item };
                BedrockInlineAgent.KEYS_TO_REMOVE.forEach(key => delete newItem[key]);
                if ('parentActionGroupSignature' in newItem) {
                  delete newItem.description;
                }
                return newItem;
              });
  
            // Handle knowledge bases
            const kbs = kbNames && this.knowledgeBases.length
              ? this.knowledgeBases.filter(item => item.knowledgeBaseId === kbNames[0])
              : [];
  
            const inlineResponse = await this.bedrockAgentClient.invokeInlineAgent({
              actionGroups,
              knowledgeBases: kbs,
              enableTrace: true,
              endSession: false,
              foundationModel: this.foundationModel,
              inputText: userRequest,
              instruction: description,
              sessionId: 'session-3'
            });
  
            const eventstream = inlineResponse.completion;
            const toolResults: string[] = [];
  
            for (const event of eventstream || []) {
              if ('chunk' in event && event.chunk?.bytes) {
                toolResults.push(new TextDecoder().decode(event.chunk.bytes));
              }
            }
  
            return {
              role: ParticipantRole.ASSISTANT,
              content: [{ text: toolResults.join('') }]
            };
          }
        }
      }
  
      throw new Error("Tool use block not handled");
    }
  
    async processRequest(
      inputText: string,
      userId: string,
      sessionId: string,
      chatHistory: ConversationMessage[],
      additionalParams?: Record<string, string>
    ): Promise<ConversationMessage> {
      try {
        // Construct the user's message
        const userMessage: ConversationMessage = {
          role: ParticipantRole.USER,
          content: [{ text: inputText }]
        };
    
        // Combine chat history with current message
        const conversation: ConversationMessage[] = [...chatHistory, userMessage];
    
        this.updateSystemPrompt();
    
        // Prepare the command to converse with the Bedrock API
        const converseCmd = {
          modelId: this.modelId,
          messages: conversation,
          system: [{ text: this.systemPrompt }],
          inferenceConfig: this.inferenceConfig,
          toolConfig: {
            tools: this.inlineAgentTool
          }
        };
    
        // Call Bedrock's converse API
        const command = new ConverseCommand(converseCmd);
        const response = await this.client.send(command);
    
        if (!response.output) {
          throw new Error("No output received from Bedrock model");
        }
    
        const bedrockResponse = response.output.message as ConversationMessage;
    
        // Check if tool use is required
        if (bedrockResponse.content) {  // Add null check
          for (const content of bedrockResponse.content) {
            if (content && typeof content === 'object' && 'toolUse' in content) {
              return await this.toolConfig.useToolHandler(bedrockResponse, conversation);
            }
          }
        }
    
        return bedrockResponse;
    
      } catch (error: unknown) {  // Explicitly type error as unknown
        // Handle error with proper type checking
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unknown error occurred';
          
        Logger.logger.error("Error processing request with Bedrock:", errorMessage);
        throw new Error(`Error processing request with Bedrock: ${errorMessage}`);
      }
    }
  
    setSystemPrompt(template?: string, variables?: TemplateVariables): void {
      if (template) {
        this.promptTemplate = template;
      }
      if (variables) {
        this.customVariables = variables;
      }
      this.updateSystemPrompt();
    }
  
    private updateSystemPrompt(): void {
      const allVariables: TemplateVariables = {
        ...this.customVariables
      };
      this.systemPrompt = this.replaceplaceholders(this.promptTemplate, allVariables);
    }
  
    private replaceplaceholders(template: string, variables: TemplateVariables): string {
      return template.replace(/{{(\w+)}}/g, (match, key) => {
        if (key in variables) {
          const value = variables[key];
          return Array.isArray(value) ? value.join('\n') : String(value);
        }
        return match;
      });
    }
  }