import { ConversationMessage, ParticipantRole, AgentProviderType } from '../types';


class ToolResult {
  constructor(
    private toolUseId: string,
    private content: any
  ) {}

  toAnthropicFormat(): any {
    return {
      type: 'tool_result',
      tool_use_id: this.toolUseId,
      content: this.content
    };
  }

  toBedrockFormat(): any {
    return {
      toolResult: {
        toolUseId: this.toolUseId,
        content: [{ text: this.content }]
      }
    };
  }
}

export class Tool {
  readonly name: string;
  readonly description: string;
  readonly properties: Record<string, any>;
  readonly required: string[];
  readonly func: Function;
  private enumValues: Record<string, any[]>;

  constructor(options: {
    name: string;
    description?: string;
    properties?: Record<string, any>;
    required?: string[];
    func: Function;
    enumValues?: Record<string, any[]>;
  }) {
    this.name = options.name;
    this.description = options.description || this.extractFunctionDescription(options.func);
    this.enumValues = options.enumValues || {};
    this.properties = options.properties || this.extractProperties(options.func);
    this.required = options.required || Object.keys(this.properties);
    this.func = this.wrapFunction(options.func);

    for (const [propName, enumVals] of Object.entries(this.enumValues)) {
      if (this.properties[propName]) {
        this.properties[propName].enum = enumVals;
      }
    }
  }

  private extractFunctionDescription(func: Function): string {
    return `Function to ${this.name}`;
  }

  private extractProperties(func: Function): Record<string, any> {
    const properties: Record<string, any> = {};
    const params = this.getParamNames(func);
    
    params.forEach(param => {
      if (param === 'this') return;
      
      properties[param] = {
        type: 'string',
        description: `The ${param} parameter`
      };
    });

    return properties;
  }

  private getParamNames(func: Function): string[] {
    const functionStr = func.toString();
    const paramStr = functionStr.slice(
      functionStr.indexOf('(') + 1,
      functionStr.indexOf(')')
    );
    return paramStr.split(',').map(p => p.trim()).filter(p => p);
  }

  private wrapFunction(func: Function): Function {
    return async (...args: any[]) => {
      const result = func(...args);
      return result instanceof Promise ? await result : result;
    };
  }

  toClaudeFormat(): any {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: 'object',
        properties: this.properties,
        required: this.required
      }
    };
  }

  toBedrockFormat(): any {
    return {
      toolSpec: {
        name: this.name,
        description: this.description,
        inputSchema: {
          json: {
            type: 'object',
            properties: this.properties,
            required: this.required
          }
        }
      }
    };
  }

  toOpenaiFormat(): any {
    return {
      type: 'function',
      function: {
        name: this.name.toLowerCase().replace('_tool', ''),
        description: this.description,
        parameters: {
          type: 'object',
          properties: this.properties,
          required: this.required,
          additionalProperties: false
        }
      }
    };
  }
}

export class Tools {

  public tools: Tool[];

  constructor(tools: Tool[]) {
    this.tools = tools;
    console.log("Tools instance initialized with:", this.tools);
  }

  async toolHandler(providerType: AgentProviderType, response: any, _conversation: any[]): Promise<any> {
    if (!response.content) {
      throw new Error('No content blocks in response');
    }
    const toolResults = [];
    const contentBlocks = response.content;

    for (const block of contentBlocks) {
      const toolUseBlock = this.getToolUseBlock(providerType, block);
      if (!toolUseBlock) continue;

      const toolName = providerType === AgentProviderType.BEDROCK
        ? toolUseBlock.name
        : toolUseBlock.name;

      const toolId = providerType === AgentProviderType.BEDROCK
        ? toolUseBlock.toolUseId
        : toolUseBlock.id;

      const inputData = providerType === AgentProviderType.BEDROCK
        ? toolUseBlock.input
        : toolUseBlock.input;

      const result = await this.processTool(toolName, inputData);
      const toolResult = new ToolResult(toolId, result);

      const formattedResult = providerType === AgentProviderType.BEDROCK
        ? toolResult.toBedrockFormat()
        : toolResult.toAnthropicFormat();

      toolResults.push(formattedResult);
    }

    if (providerType === AgentProviderType.BEDROCK) {
      return {
        role: ParticipantRole.USER,
        content: toolResults
      } as ConversationMessage;
    } else {
      return {
        role: ParticipantRole.USER,
        content: toolResults
      };
    }
  }

  private getToolUseBlock(providerType: AgentProviderType, block: any): any {
    if (providerType === AgentProviderType.BEDROCK && 'toolUse' in block) {
      return block.toolUse;
    }
    if (providerType === AgentProviderType.ANTHROPIC && block.type === 'tool_use') {
      return block;
    }
    return null;
  }

  private async processTool(toolName: string, inputData: any): Promise<any> {
    try {
      let tool: Tool | undefined;
      for (const t of this.tools) {
        if (t.name === toolName) {
          tool = t;
          break;
        }
      }
        
      if (!tool?.func) {
        return `Tool '${toolName}' not found`;
      }
      
      if ('messages' in inputData) {
        return await tool.func(inputData.messages);
      }
      return await tool.func(inputData);

    } catch (error) {
      return `Error processing tool '${toolName}': ${error.message}`;
    }
  }

  toClaudeFormat(): any[] {
    return this.tools.map(tool => tool.toClaudeFormat());
  }

  toBedrockFormat(): any[] {
    return this.tools.map(tool => tool.toBedrockFormat());
  }
}