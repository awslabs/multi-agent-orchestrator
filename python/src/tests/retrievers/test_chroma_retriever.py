import pytest
from unittest.mock import Mock, patch
from agent_squad.retrievers import ChromaRetriever, ChromaRetrieverOptions


@pytest.fixture
def mock_chroma_client():
    with patch('chromadb.Client') as mock_client:
        mock_collection = Mock()
        mock_collection.query.return_value = {
            'documents': [['doc1', 'doc2']],
            'metadatas': [['meta1', 'meta2']]
        }
        mock_client.return_value.get_or_create_collection.return_value = (
            mock_collection
        )
        yield mock_client


@pytest.fixture
def chroma_retriever(mock_chroma_client):
    options = ChromaRetrieverOptions(
        collection_name='test_collection',
        persist_directory='./test_data'
    )
    return ChromaRetriever(options)


@pytest.mark.asyncio
async def test_retrieve(chroma_retriever):
    results = await chroma_retriever.retrieve("test query")
    assert len(results) == 2
    assert results[0]['content']['text'] == 'doc1'
    assert results[0]['metadata'] == 'meta1'
    assert results[1]['content']['text'] == 'doc2'
    assert results[1]['metadata'] == 'meta2'


@pytest.mark.asyncio
async def test_retrieve_and_combine_results(chroma_retriever):
    result = await chroma_retriever.retrieve_and_combine_results("test query")
    assert result == "doc1\ndoc2"


@pytest.mark.asyncio
async def test_retrieve_and_generate(chroma_retriever):
    with pytest.raises(NotImplementedError):
        await chroma_retriever.retrieve_and_generate("test query")


def test_init_without_collection_name():
    with pytest.raises(ValueError):
        ChromaRetriever(ChromaRetrieverOptions(collection_name=''))


def test_init_with_remote_client():
    options = ChromaRetrieverOptions(
        collection_name='test_collection',
        host='localhost',
        port=8000
    )
    with patch('chromadb.HttpClient') as mock_client:
        mock_collection = Mock()
        mock_client.return_value.get_or_create_collection.return_value = (
            mock_collection
        )
        retriever = ChromaRetriever(options)
        assert retriever.client is not None
        mock_client.assert_called_once_with(
            host='localhost',
            port=8000,
            ssl=False
        ) 