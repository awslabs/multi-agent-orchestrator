import * as cdk from 'aws-cdk-lib';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { UserInterfaceStack } from "./user-interface-stack"
import * as path from "path";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins"; 
import { LexAgentConstruct } from './lex-agent-construct';
import { BedrockKbConstruct } from './bedrock-agent-construct';

export class ChatDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const enableLexAgent = this.node.tryGetContext('enableLexAgent');
    const enableAmazonBedrockAgent = this.node.tryGetContext('enableAmazonBedrockAgent');

    let lexAgent = null;
    let lexAgentConfig = {};
    if (enableLexAgent === true){
      lexAgent = new LexAgentConstruct(this, "LexAgent");
      lexAgentConfig = {
        botId: lexAgent.lexBotId,
        botAliasId: lexAgent.lexBotAliasId,
        localeId: "en_US",
        description: lexAgent.lexBotDescription,
        name: lexAgent.lexBotName,
      }
    }

    let bedrockAgent = null;
    let bedrockAgentConfig = {};
    if (enableAmazonBedrockAgent === true) {
      bedrockAgent = new BedrockKbConstruct(this, "BedrockKbAgent");
      bedrockAgentConfig = {
        agentId: bedrockAgent.bedrockAgent.agentId,
        agentAliasId: bedrockAgent.bedrockAgent.aliasId,
        name: bedrockAgent.bedrockAgent.name,
        description: bedrockAgent.description,
      }
    }

    const powerToolsTypeScriptLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "powertools-layer-ts",
      `arn:aws:lambda:${
        cdk.Stack.of(this).region
      }:094274105915:layer:AWSLambdaPowertoolsTypeScriptV2:2`
    );

    const basicLambdaRole = new iam.Role(this, "BasicLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    basicLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        "basicLambdaRoleAWSLambdaBasicExecutionRole",
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const uiStack = new UserInterfaceStack(this, "UserInterface");

    const sessionTable = new dynamodb.Table(this, "SessionTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "TTL",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const pythonLambda = new lambda.Function(this, "PythonLambda", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "lambda.lambda_handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda/find-my-name")
      ),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    })

    const multiAgentLambdaFunction = new nodejs.NodejsFunction(
      this,
      "MultiAgentLambda",
      {
        entry: path.join(
          __dirname,
          "../lambda/multi-agent/index.ts"
        ),
        runtime: lambda.Runtime.NODEJS_LATEST,
        role: basicLambdaRole,
        memorySize: 2048,
        timeout: cdk.Duration.minutes(5),
        layers: [powerToolsTypeScriptLayer],
        environment: {
          POWERTOOLS_SERVICE_NAME: "multi-agent",
          POWERTOOLS_LOG_LEVEL: "DEBUG",
          HISTORY_TABLE_NAME: sessionTable.tableName,
          HISTORY_TABLE_TTL_KEY_NAME: 'TTL',
          HISTORY_TABLE_TTL_DURATION: '3600',
          LEX_AGENT_ENABLED: enableLexAgent.toString(),
          LEX_AGENT_CONFIG: JSON.stringify(lexAgentConfig),
          BEDROCK_AGENT_ENABLED: enableAmazonBedrockAgent.toString(),
          BEDROCK_AGENT_CONFIG: JSON.stringify(bedrockAgentConfig),
          LAMBDA_AGENTS: JSON.stringify([{description:"This is an Agent to use when you forgot about your own name",name:'find-my-name',functionName:pythonLambda.functionName, region:cdk.Aws.REGION}]),
        },
        bundling: {
          minify: false,
          externalModules: [
            //"aws-lambda",
            "@aws-lambda-powertools/logger",
            "@aws-lambda-powertools/parameters",
            //"@aws-sdk/client-ssm",
        ],
        },
      }
    );

    sessionTable.grantReadWriteData(multiAgentLambdaFunction);
    pythonLambda.grantInvoke(multiAgentLambdaFunction);

    multiAgentLambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
        ],
      })
    );

    const multiAgentLambdaFunctionUrl = multiAgentLambdaFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    uiStack.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "AllowInvokeFunctionUrl",
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunctionUrl"],
        resources: [
          multiAgentLambdaFunctionUrl.functionArn,
        ],
        conditions: {
          StringEquals: { "lambda:FunctionUrlAuthType": "AWS_IAM" },
        },
      })
    );

    uiStack.distribution.addBehavior(
      "/chat/*",
      new cloudfront_origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split("/", multiAgentLambdaFunctionUrl.url))),
      uiStack.behaviorOptions
    );

    if (enableLexAgent){
      multiAgentLambdaFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          sid: 'LexPermission',
          actions: [
            "lex:RecognizeText",
          ],
          resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
            `arn:aws:lex:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:bot-alias/${lexAgent!.lexBotId}/${lexAgent!.lexBotAliasId}`
          ],
        })
      );
    }

    if (enableAmazonBedrockAgent) {
      multiAgentLambdaFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          sid: 'AmazonBedrockKbPermission',
          actions: [
            "bedrock:GetFoundationModel",
            "bedrock:InvokeAgent",
          ],
          resources: [
            `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}::foundation-model/*`,
            `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:knowledge-base/${bedrockAgent!.knowledgeBaseId}`,
            `arn:${cdk.Aws.PARTITION}:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:agent-alias/${bedrockAgent!.bedrockAgent.agentId}/${bedrockAgent!.bedrockAgent.aliasId}`
          ],
        })
      );
    }
  }
}
