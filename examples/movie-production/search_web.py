import json
from typing import Any
from tool import ToolResult
from multi_agent_orchestrator.types import ParticipantRole

from duckduckgo_search import DDGS

async def tool_handler(response: Any, conversation: list[dict[str, Any]],) -> Any:
    if not response.content:
        raise ValueError("No content blocks in response")

    tool_results = []
    content_blocks = response.content

    for block in content_blocks:
        # Determine if it's a tool use block based on platform
        tool_use_block =  block if block.type == "tool_use" else None
        if not tool_use_block:
            continue

        tool_name = (tool_use_block.name)

        tool_id = (
            tool_use_block.id
        )

        # Get input based on platform
        input_data = (tool_use_block.input)

        # Process the tool use
        if (tool_name == "search_web"):
            result = search_web(input_data.get('query'))
        else:
            result = f"Unknown tool use name: {tool_name}"

        # Create tool result
        tool_result = ToolResult(tool_id, result)

        # Format according to platform
        formatted_result = (tool_result.to_anthropic_format())

        tool_results.append(formatted_result)

        # Create and return appropriate message format
        return {
            'role': ParticipantRole.USER.value,
            'content': tool_results
        }

def search_web(query: str, num_results: int = 2) -> str:
    """
    Search Web using the DuckDuckGo. Returns the search results.

    Args:
        query(str): The query to search for.
        num_results(int): The number of results to return.

    Returns:
        str: The search results from Google.
            Keys:
                - 'search_results': List of organic search results.
                - 'recipes_results': List of recipes search results.
                - 'shopping_results': List of shopping search results.
                - 'knowledge_graph': The knowledge graph.
                - 'related_questions': List of related questions.
    """

    try:

        print(f"Searching DDG for: {query}")

        search = DDGS().text(query, max_results=num_results)
        return ('\n'.join(result.get('body','') for result in search))


    except Exception as e:
        print(f"Error searching for the query {query}: {e}")
        return f"Error searching for the query {query}: {e}"