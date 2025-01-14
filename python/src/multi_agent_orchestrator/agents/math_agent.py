# /Users/suvee/projects/multi-agent-orchestrator/python/src/multi_agent_orchestrator/agents/math_agent.py

from typing import Dict, List, Optional, Union, AsyncIterable
from multi_agent_orchestrator.agents.agent import Agent, AgentOptions, AgentCallbacks
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents.bedrock_llm_agent import BedrockLLMAgent, BedrockLLMAgentOptions
import json
import re
from dataclasses import dataclass

@dataclass
class MathAgentOptions(AgentOptions):
    def __init__(
        self,
        name: str = "Math Agent",
        description: str = "An agent that performs mathematical operations",
        save_chat: bool = True,
        callbacks: Optional[AgentCallbacks] = None,
        LOG_AGENT_DEBUG_TRACE: Optional[bool] = False,
        model_id: str = "anthropic.claude-v2",
        **kwargs
    ):
        super().__init__(
            name=name,
            description=description,
            save_chat=save_chat,
            callbacks=callbacks,
            LOG_AGENT_DEBUG_TRACE=LOG_AGENT_DEBUG_TRACE,
            **kwargs
        )
        self.model_id = model_id

class MathOperation:
    """Available mathematical operations"""
    ADDITION = "add"
    SUBTRACTION = "subtract"
    MULTIPLICATION = "multiply"
    DIVISION = "divide"
    POWER = "power"

class ComplexMathSchema:
    """Schema for all calculations with proper operation chaining"""
    schema = {
        "type": "object",
        "properties": {
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": [
                                MathOperation.ADDITION,
                                MathOperation.SUBTRACTION,
                                MathOperation.MULTIPLICATION,
                                MathOperation.DIVISION,
                                MathOperation.POWER
                            ]
                        },
                        "numbers": {
                            "type": "array",
                            "items": {
                                "oneOf": [
                                    {"type": "number"},
                                    {
                                        "type": "object",
                                        "properties": {
                                            "reference": {"type": "string"},
                                            "step": {"type": "integer"}
                                        },
                                        "required": ["reference", "step"]
                                    }
                                ]
                            }
                        },
                        "description": {"type": "string"},
                        "result_reference": {"type": "string"}
                    },
                    "required": ["operation", "numbers", "description", "result_reference"]
                },
                "minItems": 1
            },
            "final_context": {"type": "string"}
        },
        "required": ["steps", "final_context"]
    }

class MathAgent(Agent):
    def __init__(self, options: MathAgentOptions):
        super().__init__(options)
        self.options = options
        
        parser_options = BedrockLLMAgentOptions(
            name="Math Problem Parser",
            description="Parses natural language math problems",
            model_id=options.model_id
        )
        self.parser_llm = BedrockLLMAgent(parser_options)

        self.operations = {
            MathOperation.ADDITION: self._add,
            MathOperation.SUBTRACTION: self._subtract,
            MathOperation.MULTIPLICATION: self._multiply,
            MathOperation.DIVISION: self._divide,
            MathOperation.POWER: self._power
        }

    def _add(self, numbers: List[float]) -> float:
        return sum(numbers)

    def _subtract(self, numbers: List[float]) -> float:
        if len(numbers) < 2:
            raise ValueError("Subtraction requires at least two numbers")
        result = numbers[0]
        for num in numbers[1:]:
            result -= num
        return result

    def _multiply(self, numbers: List[float]) -> float:
        result = 1
        for num in numbers:
            result *= num
        return result

    def _divide(self, numbers: List[float]) -> float:
        if len(numbers) < 2:
            raise ValueError("Division requires at least two numbers")
        if 0 in numbers[1:]:
            raise ValueError("Cannot divide by zero")
        result = numbers[0]
        for num in numbers[1:]:
            result /= num
        return result

    def _power(self, numbers: List[float]) -> float:
        if len(numbers) != 2:
            raise ValueError("Power operation requires exactly two numbers")
        return pow(numbers[0], numbers[1])

    async def _parse_problem(self, text: str) -> Dict:
        """Use LLM to parse all problems using the complex schema with result references"""
        prompt = f"""
        Convert mathematical word problems into a series of steps following PEMDAS (Parentheses, Exponents, Multiplication/Division, Addition/Subtraction).
        Use result references to chain operations properly.

        Schema:
        ```json
        {json.dumps(ComplexMathSchema.schema, indent=2)}
        ```

        Examples with proper operation chaining:

        1. Simple with reference: "Multiply 5 by 3 and add 2"
        → {{
            "steps": [
                {{
                    "operation": "multiply",
                    "numbers": [5, 3],
                    "description": "Multiplying 5 and 3",
                    "result_reference": "step_1"
                }},
                {{
                    "operation": "add",
                    "numbers": [{{"reference": "step_1", "step": 1}}, 2],
                    "description": "Adding 2 to the previous result",
                    "result_reference": "step_2"
                }}
            ],
            "final_context": "Final result of multiplication and addition"
        }}

        2. Complex Salary Calculation: "i get paid 20$ an hour. i work 8 hours a day. how much i can withdraw if i am allowed to withdraw 30% after 5 days"
        → {{
            "steps": [
                {{
                    "operation": "multiply",
                    "numbers": [20, 8],
                    "description": "Daily salary calculation",
                    "result_reference": "daily_salary"
                }},
                {{
                    "operation": "multiply",
                    "numbers": [{{"reference": "daily_salary", "step": 1}}, 5],
                    "description": "Total salary for 5 days",
                    "result_reference": "total_salary"
                }},
                {{
                    "operation": "multiply",
                    "numbers": [{{"reference": "total_salary", "step": 2}}, 0.30],
                    "description": "Calculating 30% withdrawal amount",
                    "result_reference": "withdrawal_amount"
                }}
            ],
            "final_context": "Amount available for withdrawal"
        }}

        3. PEMDAS Example: "What is (5 + 3) * 2 ^ 2 - 10"
        → {{
            "steps": [
                {{
                    "operation": "add",
                    "numbers": [5, 3],
                    "description": "Adding numbers in parentheses",
                    "result_reference": "parentheses_result"
                }},
                {{
                    "operation": "power",
                    "numbers": [2, 2],
                    "description": "Calculating 2 squared",
                    "result_reference": "exponent_result"
                }},
                {{
                    "operation": "multiply",
                    "numbers": [
                        {{"reference": "parentheses_result", "step": 1}},
                        {{"reference": "exponent_result", "step": 2}}
                    ],
                    "description": "Multiplying previous results",
                    "result_reference": "multiply_result"
                }},
                {{
                    "operation": "subtract",
                    "numbers": [
                        {{"reference": "multiply_result", "step": 3}},
                        10
                    ],
                    "description": "Subtracting 10",
                    "result_reference": "final_result"
                }}
            ],
            "final_context": "Result of (5 + 3) * 2 ^ 2 - 10"
        }}

        Current Problem to analyze: {text}

        Rules:
        1. Follow PEMDAS order strictly
        2. Use result_reference for each step
        3. Reference previous results using {{"reference": "step_name", "step": step_number}}
        4. Break complex calculations into clear, sequential steps
        5. Ensure each step depends on actual computed values
        6. Provide meaningful references that describe the value

        Respond only with the JSON output, no additional text.
        """

        response = await self.parser_llm.process_request(
            prompt,
            "system",
            "math_parser",
            []
        )

        try:
            content = response.content[0]['text']
            json_str = re.search(r'\{.*\}', content, re.DOTALL).group()
            return json.loads(json_str)
        except (json.JSONDecodeError, AttributeError) as e:
            raise ValueError(f"Failed to parse LLM response: {str(e)}")

    def _format_response(self, step_results: List[Dict], final_context: str, final_result: float) -> str:
        """Format response for both simple and complex calculations."""
        # For single-step calculations, use simpler format
        if len(step_results) == 1:
            formatted_result = f"{int(final_result):,}" if final_result.is_integer() else f"{final_result:,.2f}"
            if any(word in final_context.lower() for word in ['salary', 'money', 'cost', 'price', '$']):
                formatted_result = f"${formatted_result}"
            return f"{final_context}: {formatted_result}"

        # For multi-step calculations, show all steps
        response_lines = ["Let me break this down step by step:"]
        
        for i, step in enumerate(step_results, 1):
            result = step['result']
            formatted_result = f"{int(result):,}" if result.is_integer() else f"{result:,.2f}"
            
            # Add dollar sign for monetary values
            if any(word in step['description'].lower() for word in ['salary', 'money', 'cost', 'price', '$']):
                formatted_result = f"${formatted_result}"
            
            response_lines.append(f"{i}. {step['description']}: {formatted_result}")
        
        # Format final result
        final_formatted = f"{int(final_result):,}" if final_result.is_integer() else f"{final_result:,.2f}"
        if any(word in final_context.lower() for word in ['salary', 'money', 'cost', 'price', '$']):
            final_formatted = f"${final_formatted}"
            
        response_lines.append(f"\nFinal {final_context}: {final_formatted}")
        
        return "\n".join(response_lines)

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None,
    ) -> ConversationMessage:
        """Process all mathematical operations with proper result tracking."""
        self.log_debug("MathAgent", f"Processing request: {input_text}")

        try:
            parsed = await self._parse_problem(input_text)
            
            if not parsed.get('steps'):
                raise ValueError("No calculation steps provided")

            # Dictionary to store intermediate results
            step_results = {}
            final_result = 0
            formatted_steps = []
            
            for i, step in enumerate(parsed['steps'], 1):
                operation = step['operation']
                numbers = []
                
                # Process each number, replacing references with actual values
                for num in step['numbers']:
                    if isinstance(num, dict) and 'reference' in num:
                        ref_step = num['step']
                        if ref_step not in step_results:
                            raise ValueError(f"Invalid reference to step {ref_step}")
                        numbers.append(step_results[ref_step])
                    else:
                        numbers.append(float(num))
                
                if operation not in self.operations:
                    raise ValueError(f"Unsupported operation: {operation}")
                
                # Perform the calculation
                result = self.operations[operation](numbers)
                
                # Store result for future references
                step_results[i] = result
                
                formatted_steps.append({
                    'description': step['description'],
                    'result': result
                })
                
                final_result = result
            
            # Format the response using the _format_response method
            response_text = self._format_response(
                formatted_steps,
                parsed['final_context'],
                final_result
            )

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{'text': response_text}]
            )
            
        except Exception as e:
            error_message = f"Error: {str(e)}"
            self.log_debug("MathAgent", f"Operation error: {error_message}")
            
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{'text': error_message}]
            )