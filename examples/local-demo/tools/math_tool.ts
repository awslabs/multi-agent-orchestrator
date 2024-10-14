import { ConversationMessage, ParticipantRole, Logger } from "multi-agent-orchestrator";

export const MATH_AGENT_PROMPT = `
You are a mathematical assistant capable of performing various mathematical operations and statistical calculations.
Use the provided tools to perform calculations. Always show your work and explain each step and provide the final result of the operation.
If a calculation involves multiple steps, use the tools sequentially and explain the process.
Only respond to mathematical queries. For non-math questions, politely redirect the conversation to mathematics.
`

export const  mathAgentToolDefinition = [
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
                            "- Basic arithmetic: 'add' (or 'addition'), 'subtract' (or 'subtraction'), 'multiply' (or 'multiplication'), 'divide' (or 'division')\n" +
                            "- Exponentiation: 'power' (or 'exponent')\n" +
                            "- Trigonometric: 'sin', 'cos', 'tan'\n" +
                            "- Logarithmic and exponential: 'log', 'exp'\n" +
                            "- Rounding: 'round', 'floor', 'ceil'\n" +
                            "- Other: 'sqrt', 'abs'\n" +
                            "Note: For operations not listed here, check if they are standard Math object functions.",
                        },
                        args: {
                        type: "array",
                        items: {
                            type: "number",
                        },
                        description: "The arguments for the operation. Note:\n" +
                            "- Addition and multiplication can take multiple arguments\n" +
                            "- Subtraction, division, and exponentiation require exactly two arguments\n" +
                            "- Most other operations take one argument, but some may accept more",
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
                                "- 'mean': Calculate the average of the numbers\n" +
                                "- 'median': Calculate the middle value of the sorted numbers\n" +
                                "- 'mode': Find the most frequent number\n" +
                                "- 'variance': Calculate the variance of the numbers\n" +
                                "- 'stddev': Calculate the standard deviation of the numbers",
                            },
                            args: {
                            type: "array",
                            items: {
                                type: "number",
                            },
                            description: "The set of numbers to perform the statistical operation on.",
                        },
                    },
                    required: ["operation", "args"],
                },
            },
        },
    },
];

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
          if (typeof Math[operation as keyof typeof Math] === 'function') {
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


export  async function mathToolHanlder(response:any, conversation: ConversationMessage[]): Promise<any>{

    const responseContentBlocks = response.content as any[];

    const mathOperations: string[] = [];
    let lastResult: number | string | undefined;

    // Initialize an empty list of tool results
    let toolResults:any = []

    if (!responseContentBlocks) {
      throw new Error("No content blocks in response");
    }
    for (const contentBlock of response.content) {
        if ("text" in contentBlock) {
            Logger.logger.info(contentBlock.text);
        }
        if ("toolUse" in contentBlock) {
            const toolUseBlock = contentBlock.toolUse;
            const toolUseName = toolUseBlock.name;

            if (toolUseName === "perform_math_operation") {
                const operation = toolUseBlock.input.operation;
                let args = toolUseBlock.input.args;

                if (['sin', 'cos', 'tan'].includes(operation) && args.length > 0) {
                    const degToRad = Math.PI / 180;
                    args = [args[0] * degToRad];
                }

                const result = executeMathOperation(operation, args);

                if ('result' in result) {
                    lastResult = result.result;
                    mathOperations.push(`Tool call ${mathOperations.length + 1}: perform_math_operation: args=[${args.join(', ')}] operation=${operation} result=${lastResult}\n`);

                    toolResults.push({
                        toolResult: {
                            toolUseId: toolUseBlock.toolUseId,
                            content: [{ json: { result: lastResult } }],
                            status: "success"
                        }
                    });
                } else {
                    // Handle error case
                    const errorMessage = `Error in ${toolUseName}: ${operation}(${toolUseBlock.input.args.join(', ')}) - ${result.error}`;
                    mathOperations.push(errorMessage);
                    toolResults.push({
                        toolResult: {
                            toolUseId: toolUseBlock.toolUseId,
                            content: [{ text: result.error }],
                            status: "error"
                        }
                    });
                }
            } else if (toolUseName === "perform_statistical_calculation") {
                const operation = toolUseBlock.input.operation;
                const args = toolUseBlock.input.args;
                const result = calculateStatistics(operation, args);

                if ('result' in result) {
                    lastResult = result.result;
                    mathOperations.push(`Tool call ${mathOperations.length + 1}: perform_statistical_calculation: args=[${args.join(', ')}] operation=${operation} result=${lastResult}\n`);
                    toolResults.push({
                    toolResult: {
                        toolUseId: toolUseBlock.toolUseId,
                        content: [{ json: { result: lastResult } }],
                        status: "success"
                    }
                    });
                } else {
                    // Handle error case
                    const errorMessage = `Error in ${toolUseName}: ${operation}(${args.join(', ')}) - ${result.error}`;
                    mathOperations.push(errorMessage);
                    toolResults.push({
                        toolResult: {
                            toolUseId: toolUseBlock.toolUseId,
                            content: [{ text: result.error }],
                            status: "error"
                        }
                    });
                }
            }
        }
    }
    // Embed the tool results in a new user message
    const message:ConversationMessage = {role: ParticipantRole.USER, content: toolResults};

    return message;
}

