---
title: Creating a Math Agent with BedrockLLMAgent and Custom Tools
description: Understanding Tool use in Bedrock LLM Agent
---

This guide demonstrates how to create a specialized math agent using BedrockLLMAgent and custom math tools. We'll walk through the process of defining the tools, setting up the agent, and integrating it into your Multi-Agent Orchestrator system.

<br>

1. **Define the Math Tools**

Let's break down the math tool definition into its key components:

A. Tool Descriptions

```typescript
export const mathAgentToolDefinition = [
  {
    toolSpec: {
      name: "perform_math_operation",
      description: "Perform a mathematical operation. This tool supports basic arithmetic and various mathematical functions.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              description: "The mathematical operation to perform. Supported operations include:\n" +
                "- Basic arithmetic: 'add', 'subtract', 'multiply', 'divide'\n" +
                "- Exponentiation: 'power'\n" +
                "- Trigonometric: 'sin', 'cos', 'tan'\n" +
                "- Logarithmic and exponential: 'log', 'exp'\n" +
                "- Rounding: 'round', 'floor', 'ceil'\n" +
                "- Other: 'sqrt', 'abs'",
            },
            args: {
              type: "array",
              items: { type: "number" },
              description: "The arguments for the operation.",
            },
          },
          required: ["operation", "args"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "perform_statistical_calculation",
      description: "Perform statistical calculations on a set of numbers.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              description: "The statistical operation to perform. Supported operations include:\n" +
                "'mean', 'median', 'mode', 'variance', 'stddev'",
            },
            args: {
              type: "array",
              items: { type: "number" },
              description: "The set of numbers to perform the statistical operation on.",
            },
          },
          required: ["operation", "args"],
        },
      },
    },
  },
];
```

**Explanation:**
- This defines two tools: `perform_math_operation` and `perform_statistical_calculation`.
- Each tool has a name, description, and input schema.
- The input schema specifies the required parameters (operation and arguments) for each tool.

<br>
<br>

B. Tool Handler

```typescript
import { ConversationMessage, ParticipantRole } from "multi-agent-orchestrator";

export async function mathToolHandler(response, conversation: ConversationMessage[]): Promise<ConversationMessage> {
  const responseContentBlocks = response.content as any[];
  let toolResults: any = [];

  if (!responseContentBlocks) {
    throw new Error("No content blocks in response");
  }

  for (const contentBlock of response.content) {
    if ("toolUse" in contentBlock) {
      const toolUseBlock = contentBlock.toolUse;
      const toolUseName = toolUseBlock.name;

      if (toolUseName === "perform_math_operation") {
        const result = executeMathOperation(toolUseBlock.input.operation, toolUseBlock.input.args);
        // Process and add result to toolResults
      } else if (toolUseName === "perform_statistical_calculation") {
        const result = calculateStatistics(toolUseBlock.input.operation, toolUseBlock.input.args);
        // Process and add result to toolResults
      }
    }
  }

  const message: ConversationMessage = { role: ParticipantRole.USER, content: toolResults };
  return messages;
}
```

**Explanation:**
- This handler processes the LLM's requests to use the math tools.
- It iterates through the response content, looking for tool use blocks.
- When it finds a tool use, it calls the appropriate function (`executeMathOperation` or `calculateStatistics`).
- It formats the results and adds them to the conversation as a new user message.

<br>
<br>

C. Math Operation and Statistical Calculation Functions

```typescript
/**
   * Executes a mathematical operation using JavaScript's Math library.
   * @param operation - The mathematical operation to perform.
   * @param args - Array of numbers representing the arguments for the operation.
   * @returns An object containing either the result of the operation or an error message.
   */
function executeMathOperation(
    operation: string,
    args: number[]
  ): { result: number } | { error: string } {
    const safeEval = (code: string) => {
      return Function('"use strict";return (' + code + ")")();
    };

    try {
      let result: number;

      switch (operation.toLowerCase()) {
        case 'add':
        case 'addition':
          result = args.reduce((sum, current) => sum + current, 0);
          break;
        case 'subtract':
        case 'subtraction':
          if (args.length !== 2) {
            throw new Error('Subtraction requires exactly two arguments');
          }
          result = args[0] - args[1];
          break;
        case 'multiply':
        case 'multiplication':
          result = args.reduce((product, current) => product * current, 1);
          break;
        case 'divide':
        case 'division':
          if (args.length !== 2) {
            throw new Error('Division requires exactly two arguments');
          }
          if (args[1] === 0) {
            throw new Error('Division by zero');
          }
          result = args[0] / args[1];
          break;
        case 'power':
        case 'exponent':
          if (args.length !== 2) {
            throw new Error('Power operation requires exactly two arguments');
          }
          result = Math.pow(args[0], args[1]);
          break;
        default:
          // For other operations, use the Math object if the function exists
          if (typeof Math[operation] === 'function') {
            result = safeEval(`Math.${operation}(${args.join(",")})`);
          } else {
            throw new Error(`Unsupported operation: ${operation}`);
          }
      }

      return { result };
    } catch (error) {
      return {
        error: `Error executing ${operation}: ${(error as Error).message}`,
      };
    }
}

function calculateStatistics(operation: string, args: number[]): { result: number } | { error: string } {
  try {
    switch (operation.toLowerCase()) {
    case 'mean':
      return { result: args.reduce((sum, num) => sum + num, 0) / args.length };
    case 'median': {
      const sorted = args.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return {
        result: sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
      };
    }
    case 'mode': {
      const counts = args.reduce((acc, num) => {
        acc[num] = (acc[num] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter(key => counts[Number(key)] === maxCount);
      return { result: Number(modes[0]) }; // Return first mode if there are multiple
    }
    case 'variance': {
      const mean = args.reduce((sum, num) => sum + num, 0) / args.length;
      const squareDiffs = args.map(num => Math.pow(num - mean, 2));
      return { result: squareDiffs.reduce((sum, square) => sum + square, 0) / args.length };
    }
    case 'stddev': {
      const mean = args.reduce((sum, num) => sum + num, 0) / args.length;
      const squareDiffs = args.map(num => Math.pow(num - mean, 2));
      const variance = squareDiffs.reduce((sum, square) => sum + square, 0) / args.length;
      return { result: Math.sqrt(variance) };
    }
    default:
      throw new Error(`Unsupported statistical operation: ${operation}`);
    }
  } catch (error) {
    return { error: `Error executing ${operation}: ${(error as Error).message}` };
  }
}

```

**Explanation:**
- These functions perform the actual mathematical and statistical operations.
- They handle various operations like addition, subtraction, trigonometry, mean, median, etc.
- They return either a result or an error message if the operation fails.

<br>
<br>

2. **Create the Math Agent**

Now that we have our math tool defined and the code above in a file called `weatherTool.ts`, let's create a BedrockLLMAgent that uses this tool.


```typescript
import { BedrockLLMAgent } from 'multi-agent-orchestrator';
import { mathAgentToolDefinition, mathToolHandler } from './mathTools';

const MATH_PROMPT = `
You are a mathematical assistant capable of performing various mathematical operations and statistical calculations.
Use the provided tools to perform calculations. Always show your work and explain each step and provide the final result of the operation.
If a calculation involves multiple steps, use the tools sequentially and explain the process.
Only respond to mathematical queries. For non-math questions, politely redirect the conversation to mathematics.
`;

const mathAgent = new BedrockLLMAgent({
  name: "Math Agent",
  description: "Specialized agent for performing mathematical operations and statistical calculations.",
  streaming: false,
  inferenceConfig: {
    temperature: 0.1,
  },
  toolConfig: {
    useToolHandler: mathToolHandler,
    tool: mathAgentToolDefinition,
    toolMaxRecursions: 5
  }
});

mathAgent.setSystemPrompt(MATH_PROMPT);
```

3. **Add the Math Agent to the Orchestrator**

Now we can add our math agent to the Multi-Agent Orchestrator:

```typescript
import { MultiAgentOrchestrator } from "multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator();

orchestrator.addAgent(mathAgent);
```

## 4. Using the Math Agent

Now that our math agent is set up and added to the orchestrator, we can use it to perform mathematical operations:

```typescript
const response = await orchestrator.routeRequest(
  "What is the square root of 16 plus the cosine of 45 degrees?",
  "user123",
  "session456"
);
```

### How It Works

1. When a mathematical query is received, the orchestrator routes it to the Math Agent.
2. The Math Agent processes the query using the custom system prompt (MATH_PROMPT).
3. The agent uses the appropriate math tool (`perform_math_operation` or `perform_statistical_calculation`) to perform the required calculations.
4. The mathToolHandler processes the tool use, performs the calculations, and adds the results to the conversation.
5. The agent then formulates a response based on the calculation results and the original query, showing the work and explaining each step.

This setup allows for a specialized math agent that can handle various mathematical and statistical queries while performing real-time calculations.

---

By following this guide, you can create a powerful, context-aware math agent using BedrockLLMAgent and custom tools within your Multi-Agent Orchestrator system.