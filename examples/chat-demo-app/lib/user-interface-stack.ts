import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from "node:path";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import { Utils } from "./utils/utils";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cognitoIdentityPool from "@aws-cdk/aws-cognito-identitypool-alpha";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";

interface UserInterfaceProps extends cdk.StackProps{
  multiAgentLambdaFunctionUrl:cdk.aws_lambda.FunctionUrl
}

export class UserInterfaceStack extends cdk.Stack {
    public distribution: cf.Distribution;
    public behaviorOptions: cf.AddBehaviorOptions;
    public authFunction: cf.experimental.EdgeFunction;

    constructor(scope: Construct, id: string, props?: UserInterfaceProps ) {
      super(scope, id, props);

    const appPath = path.join(__dirname, "../ui");
    const buildPath = path.join(appPath, "dist");

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

    const hostingOrigin = new cloudfront_origins.S3Origin(websiteBucket);

    const myResponseHeadersPolicy = new cf.ResponseHeadersPolicy(
      this,
      "ResponseHeadersPolicy",
      {
        responseHeadersPolicyName:
          "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        comment: "ResponseHeadersPolicy" + cdk.Aws.STACK_NAME + "-" + cdk.Aws.REGION,
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cf.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
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

    this.distribution = new cf.Distribution(
      this,
      "Distribution",
      {
        comment: "Multi agent orchestrator demo app",
        defaultRootObject: "index.html",
        httpVersion: cf.HttpVersion.HTTP2_AND_3,
        minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultBehavior:{
          origin: hostingOrigin,
          responseHeadersPolicy: myResponseHeadersPolicy,
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
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

    this.authFunction = new cf.experimental.EdgeFunction(
      this,
      `AuthFunctionAtEdge`,
      {
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/auth"))
      },
    );

    this.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${
            cdk.Stack.of(this).account
          }:secret:UserPoolSecret*`,
        ],
      })
    );

    const cachePolicy = new cf.CachePolicy(
      this,
      "CachingDisabledButWithAuth",
      {
        defaultTtl: cdk.Duration.minutes(0),
        minTtl: cdk.Duration.minutes(0),
        maxTtl: cdk.Duration.minutes(1),
        headerBehavior: cf.CacheHeaderBehavior.allowList("Authorization"),
      }
    );

    const commonBehaviorOptions: cf.AddBehaviorOptions = {
      viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
      cachePolicy: cachePolicy,
      originRequestPolicy: cf.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
      responseHeadersPolicy:
        cf.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
    };

    this.behaviorOptions = {
      ...commonBehaviorOptions,
      edgeLambdas: [
        {
          functionVersion: this.authFunction.currentVersion,
          eventType: cf.LambdaEdgeEventType.ORIGIN_REQUEST,
          includeBody: true,
        },
      ],
      allowedMethods: cf.AllowedMethods.ALLOW_ALL,
    };

    const secret = new secretsmanager.Secret(this, "UserPoolSecret", {
      secretName: "UserPoolSecretConfig",
      secretObjectValue: {
        ClientID: cdk.SecretValue.unsafePlainText(
          userPoolClient.userPoolClientId
        ),
        UserPoolID: cdk.SecretValue.unsafePlainText(userPool.userPoolId),
      },
    });

    const exportsAsset = s3deploy.Source.jsonData("aws-exports.json", {
      region: cdk.Aws.REGION,
      domainName: "https://" + this.distribution.domainName,
      Auth: {
        Cognito: {
          userPoolClientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId,
          identityPoolId: identityPool.identityPoolId,
        },
      }
    });

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
                },
              };

              execSync(`npm --silent --prefix "${appPath}" install`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              Utils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    const distribution = this.distribution;

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      sources: [asset, exportsAsset],
      destinationBucket: websiteBucket,
      distribution,
    });

    this.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "AllowInvokeFunctionUrl",
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunctionUrl"],
        resources: [
          props!.multiAgentLambdaFunctionUrl.functionArn,
        ],
        conditions: {
          StringEquals: { "lambda:FunctionUrlAuthType": "AWS_IAM" },
        },
      })
    );

    this.distribution.addBehavior(
      "/chat/*",
      new cloudfront_origins.HttpOrigin(cdk.Fn.select(2, cdk.Fn.split("/", props!.multiAgentLambdaFunctionUrl.url))),
      this.behaviorOptions
    );



    // ###################################################
    // Outputs
    // ###################################################
    new cdk.CfnOutput(this, "UserInterfaceDomainName", {
      value: `https://${this.distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, "CognitoUserPool", {
      value: `${userPool.userPoolId}`,
    });
  }
}