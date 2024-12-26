from duckduckgo_search import DDGS

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