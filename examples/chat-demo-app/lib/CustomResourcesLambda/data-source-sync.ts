import { BedrockAgentClient, StartIngestionJobCommand, DeleteDataSourceCommand, DeleteKnowledgeBaseCommand, GetDataSourceCommand } from "@aws-sdk/client-bedrock-agent";
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import { Logger } from '@aws-lambda-powertools/logger';
const logger = new Logger({
    serviceName: 'BedrockAgentsBlueprints',
    logLevel: "INFO"
});

/**
 * OnEvent is called to create/update/delete the custom resource. We are only using it
 * here to start a one-off ingestion job at deployment.
 *
 * https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-requests.html
 *
 * @param event request object containing event type and request variables. This contains 2
 * params: knowledgeBaseId(Required), dataSourceId(Required)
 * @param _context Lambda context, currently unused.
 *
 * @returns reponse object containing the physical resource ID of the ingestionJob.
 */

export const onEvent = async (event: OnEventRequest, _context: unknown): Promise<OnEventResponse> => {
    logger.info("Received Event into Data Sync Function", JSON.stringify(event, null, 2));

    const brAgentClient = new BedrockAgentClient({});
    const { knowledgeBaseId, dataSourceId } = event.ResourceProperties;

    switch (event.RequestType) {
    case 'Create':
        return await handleCreateEvent(brAgentClient, knowledgeBaseId, dataSourceId);
    case 'Delete':
        return await handleDeleteEvent(brAgentClient, knowledgeBaseId, dataSourceId, event);
    default:
        return { PhysicalResourceId: 'skip' };
    }
};

/**
 * Handles the "Create" event by starting an ingestion job.
 *
 * @param brAgentClient The BedrockAgentClient instance.
 * @param knowledgeBaseId The ID of the knowledge base.
 * @param dataSourceId The ID of the data source.
 * @returns The response object containing the physical resource ID and optional reason for failure.
 */
const handleCreateEvent = async (brAgentClient: BedrockAgentClient, knowledgeBaseId: string, dataSourceId: string): Promise<OnEventResponse> => {
    try {
        // Start Knowledgebase and datasource sync job
        logger.info('Starting ingestion job');
        const dataSyncResponse = await brAgentClient.send(
            new StartIngestionJobCommand({
                knowledgeBaseId,
                dataSourceId,
            }),
        );

        logger.info(`Data Sync Response ${JSON.stringify(dataSyncResponse, null, 2)}`);

        return {
            PhysicalResourceId: dataSyncResponse && dataSyncResponse.ingestionJob
                ? `datasync_${dataSyncResponse.ingestionJob.ingestionJobId}`
                : 'datasync_failed',
        };
    } catch (err) {
        logger.error((err as Error).toString());
        return {
            PhysicalResourceId: 'datasync_failed',
            Reason: `Failed to start ingestion job: ${err}`,
        };
    }
};

/**
 * Handles the "Delete" event by deleting the data source and knowledge base.
 *
 * @param brAgentClient The BedrockAgentClient instance.
 * @param knowledgeBaseId The ID of the knowledge base.
 * @param dataSourceId The ID of the data source.
 * @returns The response object containing the physical resource ID and optional reason for failure.
 */
const handleDeleteEvent = async (brAgentClient: BedrockAgentClient, knowledgeBaseId: string, dataSourceId: string, event: OnEventRequest): Promise<OnEventResponse> => {
    try {
        // Retrieve the data source details
        const dataSourceResponse = await brAgentClient.send(
            new GetDataSourceCommand({
                dataSourceId,
                knowledgeBaseId,
            }),
        );

        const dataSource = dataSourceResponse.dataSource;
        logger.info(`DataSourceResponse DataSource ${dataSource}`);

        if (!dataSource) {
            throw new Error('Data source not found');
        }

        // Delete the data source
        const deleteDataSourceResponse = await brAgentClient.send(
            new DeleteDataSourceCommand({
                dataSourceId,
                knowledgeBaseId,
            }),
        );
        logger.info(`Delete DataSource Response: ${deleteDataSourceResponse}`);

        // Delete the knowledge base
        const deleteKBResponse = await brAgentClient.send(
            new DeleteKnowledgeBaseCommand({
                knowledgeBaseId,
            }),
        );
        logger.info(`Delete KB Response: ${deleteKBResponse}`);

        return {
            PhysicalResourceId: event.PhysicalResourceId,
        };
    } catch (err) {
        logger.error((err as Error).toString());
        return {
            PhysicalResourceId: event.PhysicalResourceId,
            Reason: `Failed to delete data source or knowledge base: ${err}`,
        };
    }
};