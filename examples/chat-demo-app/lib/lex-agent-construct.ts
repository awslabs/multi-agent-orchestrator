import * as cdk from 'aws-cdk-lib';
import * as cfn_include from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';
import * as path from "path";

export class LexAgentConstruct extends Construct {
    public readonly lexBotDescription:string = 'Helps users book and manage their flight reservation';
    public readonly lexBotName;
    public readonly lexBotId;
    public readonly lexBotAliasId;
    public readonly lexBotLocale = 'en_US';
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const template = new cfn_include.CfnInclude(this, "template", {
      templateFile: path.join(__dirname, "airlines.yaml"),
    });

    const lexBotResource = template.getResource('InvokeLexImportFunction') as cdk.CfnResource;
    const lexBotName = template.getParameter('BotName') as cdk.CfnParameter;

    this.lexBotName = lexBotName.valueAsString;
    this.lexBotId = lexBotResource.getAtt('bot_id').toString();
    this.lexBotAliasId = lexBotResource.getAtt('bot_alias_id').toString();
  }
}
