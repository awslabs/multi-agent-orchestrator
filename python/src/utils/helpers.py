from typing import Any


def is_tool_input(input_obj: Any) -> bool:
    return (
        isinstance(input_obj, dict) and
        'selected_agent' in input_obj and
        'confidence' in input_obj
    )