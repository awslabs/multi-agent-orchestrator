export class ToolResult {
  constructor(
    public toolUseId: string,
    public content: any
  ) {}
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
    this.description =
      options.description || this.extractFunctionDescription(options.func);
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

  private extractFunctionDescription(func: Function): string {
    return `Function to ${this.name}`;
  }

  private extractProperties(func: Function): Record<string, any> {
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

  private getParamNames(func: Function): string[] {
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

  private wrapFunction(func: Function): Function {
    return async (...args: any[]) => {
      const result = func(...args);
      return result instanceof Promise ? await result : result;
    };
  }
}

export class Tools {
  public tools: Tool[];

  constructor(tools: Tool[]) {
    this.tools = tools;
  }

  async toolHandler(
    response: any,
    getToolUseBlock: (block: any) => any,
    getToolName: (toolUseBlock: any) => string,
    getToolId: (toolUseBlock: any) => string,
    getInputData: (toolUseBlock: any) => any
  ): Promise<ToolResult[]> {
    if (!response.content) {
      throw new Error("No content blocks in response");
    }
    const toolResults: ToolResult[] = [];
    const contentBlocks = response.content;

    for (const block of contentBlocks) {
      const toolUseBlock = getToolUseBlock(block);
      if (!toolUseBlock) continue;

      const toolName = getToolName(toolUseBlock);
      const toolId = getToolId(toolUseBlock);
      const inputData = getInputData(toolUseBlock);

      
      const result = await this.processTool(toolName, inputData);
      const toolResult = new ToolResult(toolId, result);

      toolResults.push(toolResult);
    }
    return toolResults;
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

      if ("messages" in inputData) {
        return await tool.func(inputData.messages);
      }
      return await tool.func(inputData);
    } catch (error) {
      return `Error processing tool '${toolName}': ${error.message}`;
    }
  }
}
