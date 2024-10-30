import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CustomResource, Duration, Stack, aws_bedrock as bedrock } from 'aws-cdk-lib';
import { Construct } from "constructs";
import { OpenSearchServerlessHelper, OpenSearchServerlessHelperProps } from "./utils/OpensearchServerlessHelper";
import { AMAZON_BEDROCK_METADATA, AMAZON_BEDROCK_TEXT_CHUNK, KB_DEFAULT_VECTOR_FIELD } from "./constants";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { resolve } from "path";
import { Provider } from "aws-cdk-lib/custom-resources";
import { FileBufferMap, generateFileBufferMap, generateNamesForAOSS } from "./utils/utils";
import { BedrockKnowledgeBaseModels } from "./constants";

export enum KnowledgeBaseStorageConfigurationTypes {
    OPENSEARCH_SERVERLESS = "OPENSEARCH_SERVERLESS",
    PINECONE = "PINECONE",
    RDS = "RDS"
}

export interface KnowledgeBaseStorageConfigurationProps {
    type: KnowledgeBaseStorageConfigurationTypes;
    configuration?: OpenSearchServerlessHelperProps
}

export interface BedrockKnowledgeBaseProps {
    /**
     * The name of the knowledge base.
     * This is a required parameter and must be a non-empty string.
     */
    kbName: string;


    /**
     * The embedding model to be used for the knowledge base.
     * This is an optional parameter and defaults to titan-embed-text-v1.
     * The available embedding models are defined in the `EmbeddingModels` enum.
     */
    embeddingModel?: BedrockKnowledgeBaseModels;

    /**
     * The asset files to be added to the knowledge base.
     * This is an optional parameter and can be either:
     *   1. An array of file buffers (Buffer[]), or
     *   2. A FileBufferMap object, where the keys are file names and the values are file buffers.
     *
     * If an array of file buffers is provided, a FileBufferMap will be created internally,
     * with randomly generated UUIDs as the keys and the provided file buffers as the values.
     * This allows you to attach files without specifying their names.
     */
    assetFiles?: FileBufferMap | Buffer[];

    /**
     * The vector storage configuration for the knowledge base.
     * This is an optional parameter and defaults to OpenSearchServerless.
     * The available storage configurations are defined in the `KnowledgeBaseStorageConfigurationTypes` enum.
     */
    storageConfiguration?: KnowledgeBaseStorageConfigurationProps;
}

export class BedrockKnowledgeBase extends Construct {
    public readonly knowledgeBaseName: string;
    public knowledgeBase: bedrock.CfnKnowledgeBase;
    public assetFiles: FileBufferMap;
    private embeddingModel: BedrockKnowledgeBaseModels;
    private kbRole: Role;
    private accountId: string;
    private region: string;

    constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseProps) {
        super(scope, id);
        // Check if user has opted out of creating KB
        if (this.node.tryGetContext("skipKBCreation") === "true") return;

        this.accountId = Stack.of(this).account;
        this.region = Stack.of(this).region;

        this.embeddingModel = props.embeddingModel ?? BedrockKnowledgeBaseModels.TITAN_EMBED_TEXT_V1;
        this.knowledgeBaseName = props.kbName;
        this.addAssetFiles(props.assetFiles);
        this.kbRole = this.createRoleForKB();

        // Create the knowledge base facade.
        this.knowledgeBase = this.createKnowledgeBase(props.kbName);

        // Setup storageConfigurations
        const storageConfig = props.storageConfiguration?.type ?? KnowledgeBaseStorageConfigurationTypes.OPENSEARCH_SERVERLESS; // Default to OpenSearchServerless
        switch (storageConfig) {
        case KnowledgeBaseStorageConfigurationTypes.OPENSEARCH_SERVERLESS:
            this.setupOpensearchServerless(props.kbName, this.region, this.accountId);
            break;
        default:
            throw new Error(`Unsupported storage configuration type: ${storageConfig}`);
        }
    }

    /**
     * Adds asset files to the Knowledge Base.
     *
     * @param files - An array of Buffers representing the asset files, a FileBufferMap object, or undefined.
     *
     * @remarks
     * This method adds the provided asset files to the Knowledge Base by converting files to an internal
     * representation of FileBufferMap (Interface to store the combination of filenames and their contents)
     */

    public addAssetFiles(files: Buffer[] | FileBufferMap | undefined) {
        if (!files) return;

        const fileBufferMap: FileBufferMap = Array.isArray(files)
            ? generateFileBufferMap(files)
            : files;

        this.assetFiles = {
            ...this.assetFiles,
            ...fileBufferMap
        };
    }

    /**
     * Creates a new Amazon Bedrock Knowledge Base (CfnKnowledgeBase) resource.
     *
     * @param kbName - The name of the Knowledge Base.
     * @returns The created Amazon Bedrock CfnKnowledgeBase resource.
     */
    private createKnowledgeBase(kbName: string) {
        return new bedrock.CfnKnowledgeBase(
            this,
            "KnowledgeBase",
            {
                knowledgeBaseConfiguration: {
                    type: 'VECTOR',
                    vectorKnowledgeBaseConfiguration: {
                        embeddingModelArn: this.embeddingModel.getArn(this.region),
                    },
                },
                name: kbName,
                roleArn: this.kbRole.roleArn,
                storageConfiguration: {
                    type: 'NOT_SET'
                }
            }
        );
    }

    /**
     * Creates a service role that can access the FoundationalModel.
     * @returns Service role for KB
     */
    private createRoleForKB(): Role {
        const embeddingsAccessPolicyStatement = new PolicyStatement({
            sid: 'AllowKBToInvokeEmbedding',
            effect: Effect.ALLOW,
            actions: ['bedrock:InvokeModel'],
            resources: [this.embeddingModel.getArn(this.region)],
        });

        const kbRole = new Role(this, 'BedrockKBServiceRole', {
            assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
        });

        kbRole.addToPolicy(embeddingsAccessPolicyStatement);

        return kbRole;
    }

    /**
     * Grants the Knowledge Base permissions to access objects and list contents
     * in the specified S3 bucket, but only if the request originates from the provided AWS account ID.
     *
     * @param bucketName The name of the S3 bucket to grant access to.
     */
    public addS3Permissions(bucketName: string) {
        const s3AssetsAccessPolicyStatement = new PolicyStatement({
            sid: 'AllowKBToAccessAssets',
            effect: Effect.ALLOW,
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: [
                `arn:aws:s3:::${bucketName}/*`,
                `arn:aws:s3:::${bucketName}`
            ]
        });

        this.kbRole.addToPolicy(s3AssetsAccessPolicyStatement);
    }

    /** DataSource operations */

    /**
     * Synchronizes the data source for the specified knowledge base.
     *
     * This function performs the following steps:
     *
     * 1. Creates a Lambda execution role with the necessary permissions to start an ingestion job for the specified knowledge base.
     * 2. Creates a Node.js Lambda function that will handle the custom resource event for data source synchronization.
     * 3. Creates a custom resource provider that uses the Lambda function as the event handler.
     * 4. Creates a custom resource that represents the data source synchronization process, passing the knowledge base ID and data source ID as properties.
     *
     * The custom resource creation triggers the Lambda function to start the ingestion job for the specified knowledge base, synchronizing the data source.
     *
     * @param dataSourceId - The ID of the data source to synchronize.
     * @param knowledgeBaseId - The ID of the knowledge base to synchronize the data source for.
     * @returns The custom resource that represents the data source synchronization process.
     */
    private syncDataSource(dataSourceId: string, knowledgeBaseId: string) {
        // Create an execution role for the custom resource to execute lambda
        const lambdaExecutionRole = new Role(this, 'DataSyncLambdaRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
            inlinePolicies: {
                DataSyncAccess: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ["bedrock:StartIngestionJob",
                                "bedrock:DeleteDataSource",    // Delete a data source associated with the knowledgebase
                                "bedrock:DeleteKnowledgeBase",  // Delete the knowledgebase
                                "bedrock:GetDataSource",        // Get information about a data source associated with the knowledgebase
                                "bedrock:UpdateDataSource"],      // Update a data source associated with the knowledgebase
                            resources: [`arn:aws:bedrock:${this.region}:${this.accountId}:knowledge-base/${knowledgeBaseId}`],
                        }),
                    ],
                }),
            },
        });

        const powerToolsTypeScriptLayer = LayerVersion.fromLayerVersionArn(
            this,
            "powertools-layer-ts-kb",
            `arn:aws:lambda:${this.region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:2`
        );


        const onEventHandler = new NodejsFunction(this, 'DataSyncCustomResourceHandler', {
            memorySize: 128,
            timeout: Duration.minutes(15),
            runtime: Runtime.NODEJS_18_X,
            handler: 'onEvent',
            layers:[powerToolsTypeScriptLayer],
            entry: resolve(__dirname, 'CustomResourcesLambda', `data-source-sync.ts`),
            bundling: {
                minify: false,
                externalModules: [
                    '@aws-lambda-powertools/logger'
                ],
            },
            role: lambdaExecutionRole,
        });

        const provider = new Provider(this, 'Provider', {
            onEventHandler: onEventHandler,
        });

        // Create an index in the OpenSearch collection
        return new CustomResource(this, 'DataSyncLambda', {
            serviceToken: provider.serviceToken,
            properties: {
                knowledgeBaseId: knowledgeBaseId,
                dataSourceId: dataSourceId,

            },
        });
    }

    /**
     * Creates and synchronizes an Amazon Bedrock data source after the deployment of an assets.
     *
     * This function is called by the BlueprintConstructs to initialize the data source for a knowledge base.
     * It creates a new CfnDataSource with the specified asset bucket ARN and folder name, and then synchronizes
     * the data source with the knowledge base, using a customResource.
     *
     * @param assetBucketArn - The ARN of the asset bucket where the data source files are stored.
     * @returns The created CfnDataSource instance.
     */
    public createAndSyncDataSource(assetBucketArn: string): bedrock.CfnDataSource {
        const cfnDataSource = new bedrock.CfnDataSource(this, 'BlueprintsDataSource', {
            dataSourceConfiguration: {
                s3Configuration: {
                    bucketArn: assetBucketArn,
                },
                type: 'S3',
            },
            knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
            name: `${this.knowledgeBase.name}-DataSource`,

            // the properties below are optional
            dataDeletionPolicy: 'RETAIN',  // Changed to RETAIN since data source deletion upon stack deletion works only when the data deletion policy is set to RETAIN
            description: 'Data source for KB',
            vectorIngestionConfiguration: {
                chunkingConfiguration: {
                    chunkingStrategy: 'FIXED_SIZE',

                    // the properties below are optional
                    fixedSizeChunkingConfiguration: {
                        maxTokens: 1024,
                        overlapPercentage: 20,
                    },
                },
            },
        });

        this.syncDataSource(cfnDataSource.attrDataSourceId, this.knowledgeBase.attrKnowledgeBaseId);
        return cfnDataSource;
    }

    /** AOSS Operations */

    /**
     * Sets up an Amazon OpenSearch Serverless (AOSS) collection for the Knowledge Base (KB).
     *
     * @param kbName - The name of the Knowledge Base.
     * @param region - The AWS region where the AOSS collection will be created.
     * @param accountId - The AWS account ID where the AOSS collection will be created.
     *
     * @remarks
     * This method performs the following steps:
     * 1. Generates a name for the AOSS collection based on the provided `kbName`.
     * 2. Creates an execution role for a Lambda function that validates permission propagation.
     * 3. Creates a new AOSS collection with the generated name, access roles, region, and account ID.
     * 4. Grants the KB and the validation Lambda execution role access to the AOSS collection.
     * 5. Waits for the permission propagation in AOSS (up to 2 minutes) before accessing the index.
     * 6. Adds the AOSS storage configuration to the KB.
     * 7. Sets up dependencies between the KB and the permission custom resource.
     */
    private setupOpensearchServerless(kbName: string, region: string, accountId: string) {
        const aossCollectionName = generateNamesForAOSS(kbName, 'collection');
        const validationLambdaExecutionRole = this.createValidationLambdaRole();

        // Create the AOSS collection.
        const aossCollection = new OpenSearchServerlessHelper(this, 'AOSSCollectionForKB', {
            collectionName: aossCollectionName,
            accessRoles: [this.kbRole, validationLambdaExecutionRole],
            region: region,
            accountId: accountId,
        });

        // Once collection is created, allow KB to access it
        this.addAOSSPermissions(aossCollection.collection.attrArn);

        // Permission propagation in AOSS can take up to 2 mins, wait until an
        // index can be accessed.
        const permissionCustomResource = this.waitForPermissionPropagation(validationLambdaExecutionRole, aossCollection.collection.attrCollectionEndpoint, aossCollection.indexName);
        permissionCustomResource.node.addDependency(aossCollection.collection);

        this.addAOSSStorageConfigurationToKB(aossCollection.collection.attrArn, aossCollection.indexName);

        this.knowledgeBase.node.addDependency(permissionCustomResource);
    }

    /**
     * Associate the AOSS configuration to the KB.
     */
    private addAOSSStorageConfigurationToKB(collectionArn: string, collectionIndexName: string) {
        this.knowledgeBase.storageConfiguration = {
            type: 'OPENSEARCH_SERVERLESS',
            opensearchServerlessConfiguration: {
                collectionArn: collectionArn,
                fieldMapping: {
                    metadataField: AMAZON_BEDROCK_METADATA,
                    textField: AMAZON_BEDROCK_TEXT_CHUNK,
                    vectorField: KB_DEFAULT_VECTOR_FIELD,
                },
                vectorIndexName: collectionIndexName,
            }
        };
    }

    /**
     * Allow KB to invoke AOSS collection and indices
     * @param collectionArn AOSS collection ARN that the KB operates on.
     */
    private addAOSSPermissions(collectionArn: string) {
        const AOSSAccessPolicyStatement = new PolicyStatement({
            sid: 'AllowKBToAccessAOSS',
            effect: Effect.ALLOW,
            actions: ['aoss:APIAccessAll'],
            resources: [collectionArn],
        });
        this.kbRole.addToPolicy(AOSSAccessPolicyStatement);
    }

    /**
     * Create an execution role for the custom resource to execute lambda
     * @returns Role with permissions to acess the AOSS collection and indices
     */
    private createValidationLambdaRole() {
        return new Role(this, 'PermissionValidationRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
            inlinePolicies: {
                AOSSAccess: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['aoss:APIAccessAll'],
                            resources: ['*'], //We aren't able to make it restrictive as the cluster arn is generated at runtime
                        }),
                    ],
                }),
            },
        });
    }

    /**
     * Deploys a custom resource that checks the existence of an OpenSearch index and retries the operation
     * if the index is not found, with a configurable retry strategy.
     *
     * This function is necessary because Amazon OpenSearch Service (AOSS) permissions can take up to
     * 2 minutes to create and propagate. The custom resource is used to ensure that the index is
     * available before proceeding with further resource creation.
     *
     * @param validationRole - Custom resource Lambda execution role.
     * @param collectionEndpoint - The endpoint of the OpenSearch collection.
     * @param indexName - The name of the OpenSearch index to be validated.
     * @returns The created CustomResource instance.
     */
    private waitForPermissionPropagation(validationRole: Role, collectionEndpoint: string, indexName: string) {

        const powerToolsTypeScriptLayer = LayerVersion.fromLayerVersionArn(
            this,
            "powertools-layer-ts",
            `arn:aws:lambda:${this.region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:2`
        );

        const onEventHandler = new NodejsFunction(this, 'PermissionCustomResourceHandler', {
            memorySize: 128,
            timeout: Duration.minutes(15),
            runtime: Runtime.NODEJS_18_X,
            handler: 'onEvent',
            layers:[powerToolsTypeScriptLayer],
            entry: resolve(__dirname, 'CustomResourcesLambda', `permission-validation.ts`),
            bundling: {
                minify: false,
                externalModules: ['@aws-lambda-powertools/logger'],
            },
            role: validationRole,
        });

        const provider = new Provider(this, 'PermissionValidationProvider', {
            onEventHandler: onEventHandler,
        });

        // Create an index in the OpenSearch collection
        return new CustomResource(this, 'PermissionValidationCustomResource', {
            serviceToken: provider.serviceToken,
            properties: {
                collectionEndpoint: collectionEndpoint,
                indexName: indexName,

            },
        });

    }
}