/**
 * Represents the result of a tool execution
 */
export class AgentToolResult {
  constructor(
    public toolUseId: string,
    public content: any
  ) {}
}

type ToolFunction = (...args: any[]) => Promise<any> | any;

/**
 * Represents a single tool that can be used by an agent
 */
export class AgentTool {
  readonly name: string;
  readonly description: string;
  readonly properties: Record<string, any>;
  readonly required: string[];
  readonly func: ToolFunction;
  private enumValues: Record<string, any[]>;

  constructor(options: {
    name: string;
    description?: string;
    properties?: Record<string, any>;
    required?: string[];
    func: ToolFunction;
    enumValues?: Record<string, any[]>;
  }) {
    this.name = options.name;
    this.description =
      options.description || this.extractFunctionDescription();
    this.enumValues = options.enumValues || {};
    this.properties =
      options.properties || this.extractProperties(options.func);
    this.required = options.required || Object.keys(this.properties);
    this.func = this.wrapFunction(options.func);

    for (const [propName, enumVals] of Object.entries(this.enumValues)) {
      if (this.properties[propName]) {
        this.properties[propName].enum = enumVals;
      }
    }
  }

  private extractFunctionDescription(): string {
    return `Function to ${this.name}`;
  }

  private extractProperties(func: ToolFunction): Record<string, any> {
    const properties: Record<string, any> = {};
    const params = this.getParamNames(func);
    params.forEach((param) => {
      if (param === "this") return;
      properties[param] = {
        type: "string",
        description: `The ${param} parameter`,
      };
    });
    return properties;
  }

  private getParamNames(func: ToolFunction): string[] {
    const functionStr = func.toString();
    const paramStr = functionStr.slice(
      functionStr.indexOf("(") + 1,
      functionStr.indexOf(")")
    );
    return paramStr
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);
  }

  private wrapFunction(func: ToolFunction): ToolFunction {
    return async (...args: any[]) => {
      const result = func(...args);
      return result instanceof Promise ? await result : result;
    };
  }
}

/**
 * Manages a collection of tools that can be used by an agent
 */
export class AgentTools {
  public tools: AgentTool[];

  constructor(tools: AgentTool[]) {
    this.tools = tools;
  }

  async toolHandler(
    response: any,
    getToolUseBlock: (block: any) => any,
    getToolName: (toolUseBlock: any) => string,
    getToolId: (toolUseBlock: any) => string,
    getInputData: (toolUseBlock: any) => any
  ): Promise<AgentToolResult[]> {
    if (!response.content) {
      throw new Error("No content blocks in response");
    }

    const toolResults: AgentToolResult[] = [];
    const contentBlocks = response.content;

    for (const block of contentBlocks) {
      const toolUseBlock = getToolUseBlock(block);
      if (!toolUseBlock) continue;

      const toolName = getToolName(toolUseBlock);
      const toolId = getToolId(toolUseBlock);
      const inputData = getInputData(toolUseBlock);
      const result = await this.processTool(toolName, inputData);
      const toolResult = new AgentToolResult(toolId, result);
      toolResults.push(toolResult);
    }

    return toolResults;
  }

  private async processTool(toolName: string, inputData: any): Promise<any> {
    try {
      let tool: AgentTool | undefined;
      for (const t of this.tools) {
        if (t.name === toolName) {
          tool = t;
          break;
        }
      }

      if (!tool?.func) {
        return `Tool '${toolName}' not found`;
      }

      if ("messages" in inputData) {
        return await tool.func(inputData.messages);
      }
      return await tool.func(inputData);
    } catch (error) {
      return `Error processing tool '${toolName}': ${error.message}`;
    }
  }
}