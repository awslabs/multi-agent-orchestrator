from multi_agent_orchestrator.utils.logger import Logger
from duckduckgo_search import DDGS


def search_web(query: str, num_results: int = 2) -> str:
    """
    Search Web using the DuckDuckGo. Returns the search results.

    params: query(str): The query to search for.
    params: num_results(int): The number of results to return.

    Returns:
        str: The search results from DDG.
    """

    try:

        Logger.info(f"Searching DDG for: {query}")

        search = DDGS().text(query, max_results=num_results)
        return ('\n'.join(result.get('body','') for result in search))


    except Exception as e:
        Logger.error(f"Error searching for the query {query}: {e}")
        return f"Error searching for the query {query}: {e}"