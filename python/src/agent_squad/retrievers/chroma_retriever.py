from dataclasses import dataclass
from typing import Any, Optional, Dict, List
import chromadb
from chromadb.config import Settings
from agent_squad.retrievers import Retriever

@dataclass
class ChromaRetrieverOptions:
    """Options for Chroma Retriever."""
    collection_name: str
    persist_directory: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    ssl: Optional[bool] = False
    n_results: Optional[int] = 4
    embedding_function: Optional[Any] = None

class ChromaRetriever(Retriever):
    def __init__(self, options: ChromaRetrieverOptions):
        super().__init__(options)
        self.options = options

        if not self.options.collection_name:
            raise ValueError("collection_name is required in options")

        # Initialize ChromaDB client
        if self.options.host and self.options.port:
            self.client = chromadb.HttpClient(
                host=self.options.host,
                port=self.options.port,
                ssl=self.options.ssl
            )
        else:
            self.client = chromadb.Client(
                Settings(
                    persist_directory=self.options.persist_directory,
                    is_persistent=bool(self.options.persist_directory)
                )
            )

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name=self.options.collection_name,
            embedding_function=self.options.embedding_function
        )

    async def retrieve(self, text: str) -> List[Dict[str, Any]]:
        """
        Retrieve documents from ChromaDB based on the input text.

        Args:
            text (str): The input text to base the retrieval on.

        Returns:
            List[Dict[str, Any]]: List of retrieved documents with their metadata.
        """
        if not text:
            raise ValueError("Input text is required for retrieve")

        results = self.collection.query(
            query_texts=[text],
            n_results=self.options.n_results
        )

        # Format results
        formatted_results = []
        for i in range(len(results['documents'][0])):
            formatted_results.append({
                'content': {
                    'text': results['documents'][0][i]
                },
                'metadata': (
                    results['metadatas'][0][i] if results['metadatas'] else {}
                )
            })

        return formatted_results

    async def retrieve_and_combine_results(self, text: str) -> str:
        """
        Retrieve documents and combine their content into a single string.

        Args:
            text (str): The input text to base the retrieval on.

        Returns:
            str: Combined text from retrieved documents.
        """
        results = await self.retrieve(text)
        return self.combine_retrieval_results(results)

    async def retrieve_and_generate(self, text: str) -> Any:
        """
        Placeholder for retrieve and generate functionality.
        This can be implemented based on specific requirements.

        Args:
            text (str): The input text to base the retrieval on.

        Returns:
            Any: Generated content based on retrieved documents.
        """
        raise NotImplementedError(
            "retrieve_and_generate is not implemented for ChromaRetriever"
        )

    @staticmethod
    def combine_retrieval_results(
        retrieval_results: List[Dict[str, Any]]
    ) -> str:
        """
        Combine retrieval results into a single string.

        Args:
            retrieval_results (List[Dict[str, Any]]): List of retrieved documents.

        Returns:
            str: Combined text from retrieved documents.
        """
        return "\n".join(
            result['content']['text']
            for result in retrieval_results
            if result and result.get('content') and isinstance(
                result['content'].get('text'), str
            )
        ) 