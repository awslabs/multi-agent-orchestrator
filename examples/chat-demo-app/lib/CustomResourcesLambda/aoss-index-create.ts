import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { retryAsync } from 'ts-retry';
import { Logger } from '@aws-lambda-powertools/logger';
const logger = new Logger({
    serviceName: 'BedrockAgentsBlueprints',
    logLevel: "INFO"
});

const CLIENT_TIMEOUT_MS = 1000;
const CLIENT_MAX_RETRIES = 5;
const CREATE_INDEX_RETRY_CONFIG = {
    delay: 30000, // 30 sec
    maxTry: 20,   // Should wait at least 10 mins for the permissions to propagate
};

// TODO: make an embedding to config map to support more models
// Dafault config for titan embedding v2. Derived from https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-setup.html
const DEFAULT_INDEX_CONFIG = {
    mappings: {
        properties: {
            id: {
                type: 'text',
                fields: {
                    keyword: {
                        type: 'keyword',
                        ignore_above: 256,
                    },
                },
            },
            AMAZON_BEDROCK_METADATA: {
                type: 'text',
                index: false,
            },
            AMAZON_BEDROCK_TEXT_CHUNK: {
                type: 'text',
            },
            'bedrock-knowledge-base-default-vector': {
                type: 'knn_vector',
                dimension: 1536,
                method: {
                    engine: 'faiss',
                    space_type: 'l2',
                    name: 'hnsw',
                },
            },
        },
    },
    settings: {
        index: {
            number_of_shards: 2,
            'knn.algo_param': {
                ef_search: 512,
            },
            knn: true,
        },
    },
};

/**
 * OnEvent is called to create/update/delete the custom resource.
 *
 * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-requests.html
 *
 * @param event request object containing event type and request variables. This contains 3
 * params: indexName(Required), collectionEndpoint(Required), indexConfiguration(Optional)
 * @param _context Lambda context
 *
 * @returns reponse object containing the physical resource ID of the indexName.
 */
export const onEvent = async (event: OnEventRequest, _context: unknown): Promise<OnEventResponse> => {
    const { indexName, collectionEndpoint, indexConfiguration } = event.ResourceProperties;

    try {
        logger.info("Initiating custom resource for index operations");
        const signerResponse = AwsSigv4Signer({
            region: process.env.AWS_REGION!,
            service: 'aoss',
            getCredentials: defaultProvider(),
        });

        const openSearchClient = new Client({
            ...signerResponse,
            maxRetries: CLIENT_MAX_RETRIES,
            node: collectionEndpoint,
            requestTimeout: CLIENT_TIMEOUT_MS,
        });

        logger.info("AOSS client creation successful");

        if (event.RequestType == 'Create') {
            return await createIndex(openSearchClient, indexName, indexConfiguration);
        } else if (event.RequestType == 'Update') {
            return await updateIndex(openSearchClient, indexName, indexConfiguration);
        } else if (event.RequestType == 'Delete') {
            return await deleteIndex(openSearchClient, indexName);
        } else {
            throw new Error(`Unsupported request type: ${event.RequestType}`);
        }
    } catch (error) {
        logger.error((error as Error).toString());
        throw new Error(`Custom aoss-index operation failed: ${error}`);
    }
};

const createIndex = async (openSearchClient: Client, indexName: string, indexConfig?: any): Promise<OnEventResponse> => {
    logger.info("AOSS index creation started");

    // Create index based on default or user provided config.
    const indexConfiguration = indexConfig ?? DEFAULT_INDEX_CONFIG;

    // Retry index creation to allow data policy to propagate.
    await retryAsync(
        async () => {
            await openSearchClient.indices.create({
                index: indexName,
                body: indexConfiguration,
            });
            logger.info('Successfully created index!');
        },
        CREATE_INDEX_RETRY_CONFIG,
    );

    return {
        PhysicalResourceId: `osindex_${indexName}`,
    };
};

const deleteIndex = async (openSearchClient: Client, indexName: string): Promise<OnEventResponse> => {
    logger.info("AOSS index deletion started");
    await openSearchClient.indices.delete({
        index: indexName,
    });

    return {
        PhysicalResourceId: `osindex_${indexName}`,
    };
};

const updateIndex = async (openSearchClient: Client, indexName: string, indexConfig?: any): Promise<OnEventResponse> => {
    logger.info("AOSS index update started");
    // OpenSearch doesn't have an update index function. Hence, delete and create index
    await deleteIndex(openSearchClient, indexName);
    return await createIndex(openSearchClient, indexName, indexConfig);
};
