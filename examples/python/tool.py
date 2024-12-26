from typing import Dict, Any, Optional, Callable, Type, get_type_hints, Union
import inspect
from functools import wraps
import re
from dataclasses import dataclass

@dataclass
class PropertyDefinition:
    type: str
    description: str
    enum: Optional[list] = None

@dataclass
class ToolResult:
    tool_use_id: str
    content: Any

    def to_anthropic_format(self) -> dict:
        return {
            "type": "tool_result",
            "tool_use_id": self.tool_use_id,
            "content": self.content
        }

    def to_bedrock_format(self) -> dict:
        return {
            "toolResult": {
                "toolUseId": self.tool_use_id,
                "content": [{"text": self.content}]
            }
        }

class ToolBuilder:
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.properties: Dict[str, Dict[str, Any]] = {}
        self.required: list[str] = []

    def add_property(self,
                    name: str,
                    type: str = "string",
                    description: str = "",
                    required: bool = True,
                    enum: Optional[list] = None) -> 'ToolBuilder':
        self.properties[name] = {
            "type": type,
            "description": description
        }
        if enum:
            self.properties[name]["enum"] = enum
        if required:
            self.required.append(name)
        return self

    def build(self) -> 'Tool':
        return Tool.from_dict(
            name=self.name,
            description=self.description,
            properties=self.properties,
            required=self.required
        )

class Tool:
    def __init__(self,
                name: str,
                description: str,
                properties: Optional[Dict[str, Dict[str, Any]]] = None,
                required: Optional[list[str]] = None,
                func: Optional[Callable] = None,
                enum_values: Optional[Dict[str, list]] = None):

        self.name = name
        self.func_description = description
        self.enum_values = enum_values or {}

        if func:
            # Extract properties from the function
            self.properties = self._extract_properties(func)
            self.required = list(self.properties.keys())
            self.func = self._wrap_function(func)
        else:
            # Use provided properties
            self.properties = properties or {}
            self.required = required or list(self.properties.keys())
            self.func = None

        # Add enum values to properties if they exist
        for prop_name, enum_vals in self.enum_values.items():
            if prop_name in self.properties:
                self.properties[prop_name]["enum"] = enum_vals

    def _extract_properties(self, func: Callable) -> Dict[str, Dict[str, Any]]:
        """Extract properties from the function's signature and type hints"""
        # Get function's type hints and signature
        type_hints = get_type_hints(func)
        sig = inspect.signature(func)

        # Parse docstring for parameter descriptions
        docstring = inspect.getdoc(func) or ""
        param_descriptions = {}

        # Extract parameter descriptions using regex
        param_matches = re.finditer(r':param\s+(\w+)\s*:\s*([^:\n]+)', docstring)
        for match in param_matches:
            param_name = match.group(1)
            description = match.group(2).strip()
            param_descriptions[param_name] = description

        properties = {}
        for param_name, param in sig.parameters.items():
            # Skip 'self' parameter for class methods
            if param_name == 'self':
                continue

            param_type = type_hints.get(param_name, Any)

            # Convert Python types to JSON schema types
            type_mapping = {
                int: "integer",
                float: "number",
                str: "string",
                bool: "boolean",
                list: "array",
                dict: "object"
            }

            json_type = type_mapping.get(param_type, "string")

            # Use docstring description if available, else create a default one
            description = param_descriptions.get(param_name, f"The {param_name} parameter")

            properties[param_name] = {
                "type": json_type,
                "description": description
            }

        return properties

    def _wrap_function(self, func: Callable) -> Callable:
        """Wrap the function to preserve its metadata and handle async/sync functions"""
        @wraps(func)
        async def wrapper(**kwargs):
            result = func(**kwargs)
            if inspect.iscoroutine(result):
                return await result
            return result
        return wrapper

    @classmethod
    def from_function(cls, name: str, description: str, func: Callable, enum_values: Optional[Dict[str, list]] = None) -> 'Tool':
        """Create a Tool instance from a function"""
        return cls(name=name, description=description, func=func, enum_values=enum_values)

    @classmethod
    def from_dict(cls, name: str, description: str, properties: Dict[str, Dict[str, Any]], required: Optional[list[str]] = None) -> 'Tool':
        """Create a Tool instance from a dictionary of properties"""
        return cls(name=name, description=description, properties=properties, required=required)

    @classmethod
    def from_property_definitions(cls, name: str, description: str, properties: Dict[str, PropertyDefinition]) -> 'Tool':
        """Create a Tool instance from PropertyDefinition objects"""
        formatted_properties = {}
        for prop_name, prop_def in properties.items():
            prop_dict = {
                "type": prop_def.type,
                "description": prop_def.description
            }
            if prop_def.enum:
                prop_dict["enum"] = prop_def.enum
            formatted_properties[prop_name] = prop_dict

        return cls(name=name, description=description, properties=formatted_properties)

    @classmethod
    def builder(cls, name: str, description: str) -> ToolBuilder:
        """Create a ToolBuilder instance"""
        return ToolBuilder(name, description)

    def to_claude_format(self) -> Dict[str, Any]:
        """Convert generic tool definition to Claude format"""
        return {
            "name": self.name,
            "description": self.func_description,
            "input_schema": {
                "type": "object",
                "properties": self.properties,
                "required": self.required
            }
        }

    def to_bedrock_format(self) -> Dict[str, Any]:
        """Convert generic tool definition to Bedrock format"""
        return {
            "toolSpec": {
                "name": self.name,
                "description": self.func_description,
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": self.properties,
                        "required": self.required
                    }
                }
            }
        }

    def to_openai_format(self) -> Dict[str, Any]:
        """Convert generic tool definition to OpenAI format"""
        return {
            "type": "function",
            "function": {
                "name": self.name.lower().replace("_tool", ""),
                "description": self.func_description,
                "parameters": {
                    "type": "object",
                    "properties": self.properties,
                    "required": self.required,
                    "additionalProperties": False
                }
            }
        }
