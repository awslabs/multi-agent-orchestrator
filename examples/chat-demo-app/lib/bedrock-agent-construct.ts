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
  public readonly description:string = "Agent in charge of providing response regarding the \
  multi-agent orchestrator framework. Where to start, how to create an orchestrator.\
  what are the different elements of the framework. Always Respond in mardown format";
  public readonly knowledgeBaseId: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const knowledgeBase = new bedrock.KnowledgeBase(this, 'KnowledgeBaseDocs', {
      embeddingsModel: bedrock.BedrockFoundationModel.COHERE_EMBED_MULTILINGUAL_V3,
      instruction: "Knowledge Base containing the framework documentation",
      description:"Knowledge Base containing the framework documentation"
    });

    this.knowledgeBaseId = knowledgeBase.knowledgeBaseId;

    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      enforceSSL:true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const menuDataSource = new bedrock.S3DataSource(this, 'DocumentsDataSource', {
      bucket: documentsBucket,
      knowledgeBase: knowledgeBase,
      dataSourceName: "Documentation",
      chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
      maxTokens: 500,
      overlapPercentage: 20,
    });

    this.bedrockAgent = new bedrock.Agent(this, "MultiAgentOrchestratorDocumentationAgent", {
      name: "Multi-Agent-Orchestrator-Documentation-Agent",
      description: "Agent in charge of providing response regarding the \
  multi-agent orchestrator framework.",
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0,
      instruction: `Agent in charge of providing response regarding the \
  multi-agent orchestrator framework. Where to start, how to create an orchestrator.\
  what are the different elements of the framework. Always Respond in mardown format.`,
      idleSessionTTL: cdk.Duration.minutes(10),
      shouldPrepareAgent: true,
      aliasName: "latest",
      knowledgeBases: [knowledgeBase]
    });

    const assetsPath = path.join(__dirname, "../../../docs/src/content/docs/");
    const asset = s3deploy.Source.asset(assetsPath);

    new s3deploy.BucketDeployment(this, "DeployDocumentation", {
      sources: [asset],
      destinationBucket: documentsBucket
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
