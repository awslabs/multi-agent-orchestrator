import path from "path";

import {
  aws_lambda as lambda,
  aws_sqs as sqs,
  aws_lambda_nodejs as nodejs,
  aws_iam as iam,
  aws_appsync as appsync,
  aws_dynamodb as dynamodb,
  aws_s3 as s3,
  aws_cloudfront_origins as origins,
  aws_cloudfront as cloudfront,
  aws_s3_deployment as s3deploy,
  aws_cognito as cognito
} from "aws-cdk-lib";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import { Utils } from "./utils/utils";



import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class AiEcommerceSupportSimulatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true,
        blockPublicAcls: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }),
    });

    const hostingOrigin = new origins.S3Origin(websiteBucket);

    const myResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicy",
      {
        responseHeadersPolicyName:
          "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        comment: "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
            cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: false,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
      }
    );

    const distribution = new cloudfront.Distribution(
      this,
      "Distribution",
      {
        comment: "AI-Powered E-commerce Support Simulator",
        defaultRootObject: "index.html",
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultBehavior:{
          origin: hostingOrigin,
          responseHeadersPolicy: myResponseHeadersPolicy,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        }
      }
    );

    const userPool = new cognito.UserPool(this, "UserPool", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      selfSignUpEnabled: false,
      autoVerify: { email: true, phone: true },
      signInAliases: {
        email: true,
      },
    });

    const userPoolClient = userPool.addClient("UserPoolClient", {
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
    });

    const identityPool = new cognitoIdentityPool.IdentityPool(
      this,
      "IdentityPool",
      {
        authenticationProviders: {
          userPools: [
            new cognitoIdentityPool.UserPoolAuthenticationProvider({
              userPool,
              userPoolClient,
            }),
          ],
        },
      }
    );

    const appPath = path.join(__dirname, "../resources/ui");
    const buildPath = path.join(appPath, "dist");

    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs20.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            `npm --cache /tmp/.npm run build`,
            "cp -aur /asset-input/dist/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                  NODE_ENV: 'production', // Ensure production build
                  npm_config_cache: `${process.env.HOME}/.npm`, // Use home directory for npm cache
                },
              };
        
              console.log(`Installing dependencies in ${appPath}...`);
              execSync(`npm --silent --prefix "${appPath}" install`, options);
        
              console.log(`Building project in ${appPath}...`);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
        
              console.log(`Copying build output from ${buildPath} to ${outputDir}...`);
              Utils.copyDirRecursive(buildPath, outputDir);
        
              return true;
            } catch (e) {
              if (e instanceof Error) {
                console.error('Error during local bundling:', e.message);
                console.error('Stack trace:', e.stack);
              } else {
                console.error('An unknown error occurred during local bundling');
              }
              return false;
            }
          },
        },
        
      },
    });


    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, "AiSupportApi", {
      name: "ai-support-api",
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, "../", "graphql", "schema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: userPool,
            appIdClientRegex: userPoolClient.userPoolClientId,
            defaultAction: appsync.UserPoolDefaultAction.ALLOW,
          },
        },    
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],        
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      xrayEnabled: true,
      
    });

    const apiPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "appsync:GraphQL",
      ],
      resources: [
        `${api.arn}/*`,
        `${api.arn}/types/Mutation/*`,
        `${api.arn}/types/Subscription/*`,
      ],
    });
    
    identityPool.authenticatedRole.addToPrincipalPolicy(apiPolicyStatement);


    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      API: {
        GraphQL: {
          endpoint: api.graphqlUrl,
          region: cdk.Aws.REGION,
          defaultAuthMode: appsync.AuthorizationType.USER_POOL
        },
      },
      Auth: {
        Cognito: {
          userPoolClientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId,
          identityPoolId: identityPool.identityPoolId,
        },
      }
    });

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });



    const customerIncommingMessagesQueue = new sqs.Queue(this, "CustomerMessagesQueue", {
      visibilityTimeout: cdk.Duration.minutes(10),
    });
    const supportIncommingMessagestMessagesQueue = new sqs.Queue(this, "SupportMessagesQueue");

    const outgoingMessagesQueue = new sqs.Queue(this, "OutgoingMessagesQueue", {
      //visibilityTimeout: cdk.Duration.minutes(10),
    });

    const datasource = api.addHttpDataSource(
      "sqs",
      `https://sqs.${cdk.Aws.REGION}.amazonaws.com`,
      {
        authorizationConfig: {
          signingRegion: cdk.Aws.REGION,
          signingServiceName: "sqs",
        },
      }
    );

    customerIncommingMessagesQueue.grantSendMessages(datasource.grantPrincipal);
    supportIncommingMessagestMessagesQueue.grantSendMessages(datasource.grantPrincipal);
    

    const myJsFunction = new appsync.AppsyncFunction(this, 'function', {
			name: 'my_js_function',
			api,
			dataSource: datasource,
			code: appsync.Code.fromAsset(
				path.join(__dirname, '../graphql/Query.sendMessage.js')
			),
			runtime: appsync.FunctionRuntime.JS_1_0_0,
		});

    const sendResponseFunction = new appsync.AppsyncFunction(this, 'SendResponseFunction', {
      api: api,
      dataSource: api.addNoneDataSource('NoneDataSource'),
      name: 'SendResponseFunction',
      code: appsync.Code.fromAsset(path.join(__dirname, '../graphql/sendResponse.js')),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

		const pipelineVars = JSON.stringify({
			accountId: cdk.Aws.ACCOUNT_ID,
			customerQueueUrl: customerIncommingMessagesQueue.queueUrl,
			customerQueueName: customerIncommingMessagesQueue.queueName,
      supportQueueUrl: supportIncommingMessagestMessagesQueue.queueUrl,
      supportQueueName: supportIncommingMessagestMessagesQueue.queueName,
		});

    
    // Create the pipeline resolver
    new appsync.Resolver(this, 'SendResponseResolver', {
      api: api,
      typeName: 'Mutation',
      fieldName: 'sendResponse',
      code: appsync.Code.fromAsset(path.join(__dirname, '../graphql/sendResponsePipeline.js')),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [sendResponseFunction],
    });
  

		new appsync.Resolver(this, 'PipelineResolver', {
			api,
			typeName: 'Query',
			fieldName: 'sendMessage',
			code: appsync.Code.fromInline(`
            // The before step
            export function request(...args) {
              console.log(args);
              return ${pipelineVars}
            }
        
            // The after step
            export function response(ctx) {
              return ctx.prev.result
            }
          `),
			runtime: appsync.FunctionRuntime.JS_1_0_0,
			pipelineConfig: [myJsFunction],
		});


    
    const sessionTable = new dynamodb.Table(this, "SessionTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "TTL",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create the initial processing Lambda
    const customerMessageLambda = new nodejs.NodejsFunction(
      this,
      "CustomerMessageLambda",
      {
        entry: path.join(__dirname, "../lambda/customerMessage/index.ts"),
        handler: "handler",
        timeout: cdk.Duration.minutes(9),
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 2048,
        environment: {
          QUEUE_URL: outgoingMessagesQueue.queueUrl,
          HISTORY_TABLE_NAME: sessionTable.tableName,
          HISTORY_TABLE_TTL_KEY_NAME: 'TTL',
          HISTORY_TABLE_TTL_DURATION: '3600',
        },
        bundling: {
          commandHooks: {
            afterBundling: (inputDir: string, outputDir: string): string[] => [
              `cp ${inputDir}/resources/ui/public/mock_data.json ${outputDir}`
            ],
            beforeBundling: (inputDir: string, outputDir: string): string[] => [],
            beforeInstall: (inputDir: string, outputDir: string): string[] => [],
          },
        },
      }
    );

    sessionTable.grantReadWriteData(customerMessageLambda);


    customerMessageLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: ["*"],
      })
    );

    customerMessageLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:*'
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/*`
      ]
    }));

    const supportMessageLambda = new nodejs.NodejsFunction(
      this,
      "SupportMessageLambda",
      {
        entry: path.join(__dirname, "../lambda/supportMessage/index.ts"),
        handler: "handler",
        timeout: cdk.Duration.seconds(29),
        runtime: lambda.Runtime.NODEJS_18_X,
        environment: {
          QUEUE_URL: outgoingMessagesQueue.queueUrl,
        },
      }
    );

    
    new lambda.EventSourceMapping(this, "CustomerEventSourceMapping", {
      target: customerMessageLambda,
     batchSize: 1,
      eventSourceArn: customerIncommingMessagesQueue.queueArn,
    });

    

    new lambda.EventSourceMapping(this, "SupportEventSourceMapping", {
      target: supportMessageLambda,
      batchSize: 1,
      eventSourceArn: supportIncommingMessagestMessagesQueue.queueArn,
    });   

    customerIncommingMessagesQueue.grantConsumeMessages(customerMessageLambda);
    supportIncommingMessagestMessagesQueue.grantConsumeMessages(supportMessageLambda);
    
    outgoingMessagesQueue.grantSendMessages(customerMessageLambda);
    outgoingMessagesQueue.grantSendMessages(supportMessageLambda);



    // Create the response Lambda
    const sendResponse = new nodejs.NodejsFunction(
      this,
      "SendResponseLambda",
      {
        entry: path.join(__dirname, "../lambda/sendResponse/index.ts"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_18_X,
        environment: {
          REGION: cdk.Aws.REGION,
          APPSYNC_API_URL: api.graphqlUrl,
        },
      }
    );

    outgoingMessagesQueue.grantConsumeMessages(sendResponse);


    sendResponse.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["appsync:GraphQL"],
        resources: [`${api.arn}/*`],
      })
    );

    new lambda.EventSourceMapping(this, "ResponseEventSourceMapping", {
      target: sendResponse,
      batchSize: 1,
      eventSourceArn: outgoingMessagesQueue.queueArn,
    });   
    

    new cdk.CfnOutput(this, "CloudfrontDomainName", {
      value: distribution.domainName
    });

  }
}
