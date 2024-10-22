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

const CLIENT_TIMEOUT_MS = 10000;
const CLIENT_MAX_RETRIES = 5;

const RETRY_CONFIG = {
    delay: 30000, // 30 sec
    maxTry: 20, // Should wait at least 10 mins for the permissions to propagate
};

/**
 * Handles the 'Create', 'Update', and 'Delete' events for a custom resource.
 *
 * This function checks the existence of an OpenSearch index and retries the operation if the index is not found,
 * with a configurable retry strategy.
 *
 * @param event - The request object containing the event type and request variables.
 *   - indexName (required): The name of the OpenSearch index to check.
 *   - collectionEndpoint (required): The endpoint of the OpenSearch collection.
 * @param _context - The Lambda context object. Unused currently.
 *
 * @returns - A response object containing the physical resource ID of the index name.
 *   - For 'Create' or 'Update' events, the physical resource ID is 'osindex_<indexName>'.
 *   - For 'Delete' events, the physical resource ID is 'skip'.
 */
export const onEvent = async (event: OnEventRequest, _context: unknown): Promise<OnEventResponse> => {
    const { indexName, collectionEndpoint } = event.ResourceProperties;

    try {
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

        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            // Validate permissions to access index
            await retryAsync(
                async () => {
                    let statusCode: null | number = 404;
                    let result = await openSearchClient.indices.exists({
                        index: indexName,
                    });
                    statusCode = result.statusCode;
                    if (statusCode === 404) {
                        throw new Error('Index not found');
                    } else if (statusCode === 200) {
                        logger.info('Successfully checked index!');
                    } else {
                        throw new Error(`Unknown error while looking for index result opensearch response: ${JSON.stringify(result)}`);
                    }
                },
                RETRY_CONFIG,
            );
            //Validate permissions to use index
            await retryAsync(
                async () => {
                    let statusCode: null | number = 404;
                    const openSearchQuery = {
                        query: {
                            match_all: {}
                        },
                        size: 1 // Limit the number of results to 1
                    };
                    let result = await openSearchClient.search({
                        index: indexName,
                        body: openSearchQuery
                    });
                    statusCode = result.statusCode;
                    if (statusCode === 404) {
                        throw new Error('Index not accesible');
                    } else if (statusCode === 200) {
                        logger.info('Successfully queried index!');
                    } else {
                        throw new Error(`Unknown error while querying index in opensearch response: ${JSON.stringify(result)}`);
                    }
                },
                RETRY_CONFIG,
            );
        } else if (event.RequestType === 'Delete') {
            // Handle delete event
            try {
                const result = await openSearchClient.indices.delete({
                    index: indexName,
                });
                if (result.statusCode === 404) {
                    logger.info('Index not found, considered as deleted');
                } else {
                    logger.info('Successfully deleted index!');
                }
            } catch (error) {
                logger.error(`Error deleting index: ${error}`);
            }
            return { PhysicalResourceId: `osindex_${indexName}` };
        }
    } catch (error) {
        logger.error((error as Error).toString());
        throw new Error(`Failed to check for index: ${error}`);
    }

    await sleep(5000); // Wait for 5 seconds before returning status
    return {
        PhysicalResourceId: `osindex_${indexName}`,
    };
};

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}