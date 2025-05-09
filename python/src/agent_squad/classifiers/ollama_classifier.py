from typing import List, Dict, Optional, Any
from agent_squad.classifiers import Classifier, ClassifierResult
from agent_squad.types import ConversationMessage, ParticipantRole
from agent_squad.utils import Logger
import ollama
import json


class OllamaClassifierOptions:
    def __init__(self,
                model_id: Optional[str] = None,
                inference_config: Optional[Dict[str, Any]] = None,
                host: Optional[str] = None):
        self.model_id = model_id or "llama3.2"
        self.inference_config = inference_config or {}
        self.host = host


class OllamaClassifier(Classifier):
    def __init__(self, options: OllamaClassifierOptions):
        super().__init__()

        self.client = ollama.Client(host=options.host or None)
        self.model_id = options.model_id
        self.inference_config = options.inference_config
        self.temperature = self.inference_config.get('temperature', 0.0)
        self.system_prompt = "You are an AI assistant."

        self.tools = [{
            'type': 'function',
            'function': {
                'name': 'analyzePrompt',
                'description': 'Analyze the user input and provide structured output',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'userinput': {'type': 'string', 'description': 'The original user input'},
                        'selected_agent': {'type': 'string', 'description': 'The name of the selected agent'},
                        'confidence': {'type': 'number', 'description': 'Confidence level between 0 and 1'},
                    },
                    'required': ['userinput', 'selected_agent', 'confidence'],
                },
            }
        }]

    async def process_request(self,
                              input_text: str,
                              chat_history: List[ConversationMessage]) -> ClassifierResult:
        messages = [{"role": "system", "content": self.system_prompt}]        
        messages.extend([{"role": msg.role, "content": msg.content[0]['text']} for msg in chat_history])
        messages.append({"role": ParticipantRole.USER.value, "content": input_text})

        try:
            response = self.client.chat(
                model=self.model_id,
                messages=messages,
                options={'temperature': self.temperature},
                tools=self.tools
            )
            
            if 'tool_calls' not in response['message'] or not response['message']['tool_calls']:
                Logger.get_logger().info(f"Model response without tool call: {response['message']['content']}")
                raise Exception(f"Ollama model {self.model_id} did not use tools")
            
            tool_call = response['message']['tool_calls'][0]
            function_args = tool_call.get('function', {}).get('arguments', "{}")
            tool_input = json.loads(function_args)

            if not isinstance(tool_input, dict) or 'selected_agent' not in tool_input or 'confidence' not in tool_input:
                raise ValueError("Invalid tool input structure")
            
            intent_classifier_result: ClassifierResult = ClassifierResult(
                selected_agent=self.get_agent_by_id(tool_input['selected_agent']),
                confidence=float(tool_input['confidence'])
            )

            return intent_classifier_result

        except Exception as error:
            Logger.get_logger().error(f"Error processing request: {str(error)}")
            raise error
