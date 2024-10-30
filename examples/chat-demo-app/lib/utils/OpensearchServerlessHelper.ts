import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CustomResource, Duration, aws_opensearchserverless as opensearch } from 'aws-cdk-lib';
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { resolve } from 'path';
import { Provider } from "aws-cdk-lib/custom-resources";
import { generateNamesForAOSS } from "./utils";

const defaultIndexName = 'agent-blueprints-kb-default-index';

export interface OpenSearchServerlessHelperProps {
    collectionName: string;
    accessRoles: Role[];
    region: string;
    accountId: string;
    collectionType?: string
    indexName?: string;
    indexConfiguration?: any;
}

export enum CollectionType {
    VECTORSEARCH = 'VECTORSEARCH',
    SEARCH = 'SEARCH',
    TIMESERIES = 'TIMESERIES',
}

/**
 * A utility class that simplifies the creation and configuration of an Amazon OpenSearch Serverless collection,
 * including its network policies, encryption policies, access policies, and indexes.
 *
 * This class encapsulates the logic for creating and managing the necessary resources for an OpenSearch Serverless
 * collection, allowing developers to easily provision and set up the collection with default configurations.
 */
export class OpenSearchServerlessHelper extends Construct {
    collection: opensearch.CfnCollection;
    indexName: string;
    constructor(scope: Construct, id: string, props: OpenSearchServerlessHelperProps) {
        super(scope, id);
        this.indexName = props.indexName ?? defaultIndexName;

        // Create the Lambda execution role for index manipulation
        const lambdaExecutionRole = this.createLambdaExecutionRoleForIndex(props.region, props.accountId);

        // Create access policies for the AOSS collection and index
        const networkPolicy = this.createNetworkPolicy(props.collectionName);
        const encryptionPolicy = this.createEncryptionPolicy(props.collectionName);
        const accessRoleArns = [lambdaExecutionRole, ...props.accessRoles].map(role => role.roleArn);
        const accessPolicy = this.createAccessPolicy(props.collectionName, accessRoleArns);

        this.collection = new opensearch.CfnCollection(this, 'Collection', {
            name: props.collectionName,
            type: props.collectionType ?? CollectionType.VECTORSEARCH,
            description: 'OpenSearch Serverless collection for Multi-agent orchestrator',
        });

        // Ensure all policies are created before creating the collection.
        this.collection.addDependency(networkPolicy);
        this.collection.addDependency(encryptionPolicy);
        this.collection.addDependency(accessPolicy);

        // Create an index on the collection
        const indexCustomResource = this.createIndex(props.region, lambdaExecutionRole, props.indexConfiguration);
        indexCustomResource.node.addDependency(this.collection);
    }

    /**
     * Creates a custom AWS CloudFormation resource that provisions an index in an Amazon OpenSearch Service (OpenSearch) collection.
     *
     * @param lambdaExecutionRole - The AWS IAM role that the Lambda function will assume to create the index.
     * @returns A custom AWS CloudFormation resource that represents the index-creation
     */
    createIndex(region:string, lambdaExecutionRole: Role, indexConfiguration?: any): CustomResource {

        const powerToolsTypeScriptLayer = LayerVersion.fromLayerVersionArn(
            this,
            "powertools-layer-ts",
            `arn:aws:lambda:${region}:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:2`
        );

        const onEventHandler = new NodejsFunction(this, 'CustomResourceHandler', {
            memorySize: 512,
            timeout: Duration.minutes(15),
            runtime: Runtime.NODEJS_18_X,
            handler: 'onEvent',
            layers:[powerToolsTypeScriptLayer],
            entry: resolve(__dirname, '../CustomResourcesLambda', `aoss-index-create.ts`),
            bundling: {
                minify: false,
                externalModules: [
                    '@aws-lambda-powertools/logger'
             ]
            },
            role: lambdaExecutionRole,
        });

        const provider = new Provider(this, 'Provider', {
            onEventHandler: onEventHandler,
        });

        // Create an index in the OpenSearch collection
        return new CustomResource(this, 'OpenSearchIndex', {
            serviceToken: provider.serviceToken,
            properties: {
                indexName: this.indexName,
                collectionEndpoint: this.collection.attrCollectionEndpoint,
                /** Note: Only add indexConfiguration if present, assigning it {}
                 * by default will create an index with {} as the configuration
                */
                ...(indexConfiguration ? { indexConfiguration: indexConfiguration } : {}),
            },
        });
    }

    /**
     * Creates an Amazon OpenSearch Service (OpenSearch) access policy. The access policy grants the specified IAM roles
     * permissions to create and modify a collection and it's indices
     *
     * @param kbCollectionName - The name of the OpenSearch collection for which the access policy is being created.
     * @param accessRoleArns - An array of IAM Role ARNs that should be granted access to the OpenSearch collection.
     *
     * @returns A new instance of the `CfnAccessPolicy` construct representing the created OpenSearch access policy resource.
     */
    createAccessPolicy(kbCollectionName: string, accessRoleArns: string[]): opensearch.CfnAccessPolicy {

        const dataAccessPolicy = new opensearch.CfnAccessPolicy(this, 'AccessPolicy', {
            name: generateNamesForAOSS(kbCollectionName, 'access'),
            type: 'data',
            description: `Data Access Policy for ${kbCollectionName}`,
            policy: 'generated',
        });

        dataAccessPolicy.policy = JSON.stringify([
            {
                Description: 'Full Data Access',
                Rules: [
                    {
                        Permission: [
                            'aoss:CreateCollectionItems',
                            'aoss:DeleteCollectionItems',
                            'aoss:UpdateCollectionItems',
                            'aoss:DescribeCollectionItems',
                        ],
                        ResourceType: 'collection',
                        Resource: [`collection/${kbCollectionName}`],
                    },
                    {
                        Permission: [
                            'aoss:CreateIndex',
                            'aoss:DeleteIndex',
                            'aoss:UpdateIndex',
                            'aoss:DescribeIndex',
                            'aoss:ReadDocument',
                            'aoss:WriteDocument',
                        ],
                        ResourceType: 'index',
                        Resource: [`index/${kbCollectionName}/*`],
                    },
                ],
                Principal: accessRoleArns,
            },
        ]);

        return dataAccessPolicy;
    }

    /**
     * Creates an Amazon OpenSearch Service encryption policy for a collection. The encryption policy enables
     * server-side encryption using an AWS-owned key for the specified OpenSearch collection.
     *
     * @param kbCollectionName - The name of the OpenSearch collection for which the encryption policy is being created.
     * @returns A new instance of the `CfnSecurityPolicy` construct representing the created encryption policy.
     */
    createEncryptionPolicy(kbCollectionName: string): opensearch.CfnSecurityPolicy {
        return new opensearch.CfnSecurityPolicy(this, 'EncryptionPolicy', {
            description: 'Security policy for encryption',
            name: generateNamesForAOSS(kbCollectionName, 'encryption'),
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [
                    {
                        ResourceType: 'collection',
                        Resource: [`collection/${kbCollectionName}`],
                    },
                ],
                AWSOwnedKey: true,
            }),
        });
    }

    /**
     * Creates an Amazon OpenSearch Service network policy for the specified collection.The network policy allows
     * access to the specified OpenSearch collection and its dashboards.
     *
     * @param kbCollectionName - The name of the OpenSearch collection for which the network policy is being created.
     * @returns A new instance of the `CfnSecurityPolicy` construct representing the created network policy.
     */
    createNetworkPolicy(kbCollectionName: string): opensearch.CfnSecurityPolicy {
        return new opensearch.CfnSecurityPolicy(this, 'NetworkPolicy', {
            description: 'Security policy for network access',
            name: generateNamesForAOSS(kbCollectionName, 'network'),
            type: 'network',
            policy: JSON.stringify([
                {
                    Rules: [
                        {
                            ResourceType: 'collection',
                            Resource: [`collection/${kbCollectionName}`],
                        },
                        {
                            ResourceType: 'dashboard',
                            Resource: [`collection/${kbCollectionName}`],
                        },
                    ],
                    AllowFromPublic: true,
                }
            ]),
        });
    }

    /**
     * Creates an IAM Role for a Lambda function to create an index in the specified Amazon OpenSearch Service collection.
     *
     * @param collectionArn - The Amazon Resource Name (ARN) of the OpenSearch collection for which the index will be created.
     * @returns The IAM role that grants Lambda function permission to perform all API operations on the specified OpenSearch collection.
     */
    createLambdaExecutionRoleForIndex(region: string, accountId: string): Role {
        /**
         * We won't be able to scope down the permission to the collection resource as
         * the data-access policy requires this roleArn, but the policy needs to be
         * created before creating the collection itself.
         */
        const collectionArn = `arn:aws:aoss:${region}:${accountId}:collection/*`;
        return new Role(this, 'IndexCreationLambdaExecutionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
            inlinePolicies: {
                AOSSAccess: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['aoss:APIAccessAll'],
                            resources: [collectionArn],
                        }),
                    ],
                }),
            },
        });
    }
}