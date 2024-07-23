import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { Construct } from 'constructs';
import * as path from "path";
import * as custom_resources from 'aws-cdk-lib/custom-resources';
import { createHash } from 'crypto';

export class BedrockKbConstruct extends Construct {
  public readonly bedrockAgent: bedrock.Agent;
  public readonly description:string = "Agent in charge of providing response to restaurant's menu.";
  public readonly knowledgeBaseId: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const knowledgeBase = new bedrock.KnowledgeBase(this, 'KnowledgeBaseMenus', {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024,
      instruction: "Knowledge Base containing the restaurant menu's collection",
      description:"Knowledge Base containing the restaurant menu's collection"
    });

    this.knowledgeBaseId = knowledgeBase.knowledgeBaseId;

    const menusBucket = new s3.Bucket(this, 'MenusBucket', {
      enforceSSL:true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const menuDataSource = new bedrock.S3DataSource(this, 'MenusDataSource', {
      bucket: menusBucket,
      knowledgeBase: knowledgeBase,
      dataSourceName: "RestaurantMenus",
      chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
      maxTokens: 500,
      overlapPercentage: 20,
    });
    
    this.bedrockAgent = new bedrock.Agent(this, "RestaurantBookingAgent", {
      name: "menu-restaurant-agent",
      description: "Agent in charge of providing response to restaurant's menu.",
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
      instruction: `You are a restaurant agent, helping clients retrieve information restaurant's menu.`,
      idleSessionTTL: cdk.Duration.minutes(10),
      shouldPrepareAgent: true,
      aliasName: "latest",
      knowledgeBases: [knowledgeBase]
    });

    const assetsPath = path.join(__dirname, "./knowledge-base-assets");
    const asset = s3deploy.Source.asset(assetsPath);

    new s3deploy.BucketDeployment(this, "DeployMenus", {
      sources: [asset],
      destinationBucket: menusBucket
    });

    const payload: string = JSON.stringify({
      dataSourceId: menuDataSource.dataSourceId,
      knowledgeBaseId: knowledgeBase.knowledgeBaseId,
    });

    const syncDataSourceLambdaRole = new iam.Role(this, 'SyncDataSourceLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });

    syncDataSourceLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "syncDataSourceLambdaRoleAWSLambdaBasicExecutionRole",
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const syncDataSourceLambda = new lambda.Function(this, 'SyncDataSourceLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda.lambda_handler',
      code: lambda.Code.fromAsset('lambda/sync_bedrock_knowledgebase/'),
      role: syncDataSourceLambdaRole
    });

    syncDataSourceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:StartIngestionJob",
        ],
        resources: [knowledgeBase.knowledgeBaseArn],
      })
    );

    const payloadHashPrefix = createHash('md5').update(payload).digest('hex').substring(0, 6)

    const sdkCall: custom_resources.AwsSdkCall = {
      service: 'Lambda',
      action: 'invoke',
      parameters: {
        FunctionName: syncDataSourceLambda.functionName,
        Payload: payload
      },
      physicalResourceId: custom_resources.PhysicalResourceId.of(`${id}-AwsSdkCall-${syncDataSourceLambda.currentVersion.version + payloadHashPrefix}`)
    };

    const customResourceFnRole = new iam.Role(this, 'AwsCustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    customResourceFnRole.addToPolicy(
      new iam.PolicyStatement({
        resources: [syncDataSourceLambda.functionArn],
        actions: ['lambda:InvokeFunction']
      })
    );

    const customResource = new custom_resources.AwsCustomResource(this, 'AwsCustomResource', {
      onCreate: sdkCall,
      onUpdate: sdkCall,
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      role: customResourceFnRole
    });
  }
}
