from dataclasses import dataclass
from typing import Any, Optional, Dict
import boto3
from multi_agent_orchestrator.retrievers import Retriever

@dataclass
class AmazonKnowledgeBasesRetrieverOptions:
    """Options for Amazon Kb Retriever."""
    knowledge_base_id: str
    region: Optional[str] = None
    retrievalConfiguration: Optional[Dict] = None
    retrieveAndGenerateConfiguration: Optional[Dict] = None


class AmazonKnowledgeBasesRetriever(Retriever):
    def __init__(self, options: AmazonKnowledgeBasesRetrieverOptions):
        super().__init__(options)
        self.options = options

        if not self.options.knowledge_base_id:
            raise ValueError("knowledge_base_id is required in options")

        if options.region:
            self.client = boto3.client('bedrock-agent-runtime', region_name=options.region)
        else:
            self.client = boto3.client('bedrock-agent-runtime')


    async def retrieve_and_generate(self, text, retrieve_and_generate_configuration=None):
        pass

    async def retrieve(self, text, knowledge_base_id=None, retrieval_configuration=None):
        if not text:
            raise ValueError("Input text is required for retrieve")

        response = self.client.retrieve(
            knowledgeBaseId=knowledge_base_id or self.options.knowledge_base_id,
            retrievalConfiguration=retrieval_configuration or self.options.retrievalConfiguration,
            retrievalQuery={"text": text}
        )
        retrievalResults = response.get('retrievalResults', [])
        return retrievalResults

    async def retrieve_and_combine_results(self, text, knowledge_base_id=None, retrieval_configuration=None):
        retrievalResults = await self.retrieve(text, knowledge_base_id, retrieval_configuration)

        return self.combine_retrieval_results(retrievalResults)

    @staticmethod
    def combine_retrieval_results(retrieval_results):
        return "\n".join(
            result['content']['text']
            for result in retrieval_results
            if result and result.get('content') and isinstance(result['content'].get('text'), str)
        )