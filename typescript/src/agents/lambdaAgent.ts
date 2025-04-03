import {  ConversationMessage, ParticipantRole } from "../types";
import { Agent, AgentOptions } from "./agent";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { addUserAgentMiddleware } from '../common/src/awsSdkUtils';

export interface LambdaAgentOptions extends AgentOptions {
    functionName: string;
    functionRegion: string;
    inputPayloadEncoder?: (inputText: string, ...additionalParams: any) => any | Promise<any>;
    outputPayloadDecoder?: (response: any) => ConversationMessage | Promise<ConversationMessage>;
}

export class LambdaAgent extends Agent {
    private options: LambdaAgentOptions;
    private lambdaClient: LambdaClient;

    constructor(options: LambdaAgentOptions) {
        super(options);
        this.options = options;
        this.lambdaClient = new LambdaClient({region:this.options.functionRegion});
        addUserAgentMiddleware(this.lambdaClient, "lambda-agent");
    }

    private defaultInputPayloadEncoder(inputText: string, chatHistory: ConversationMessage[], userId: string, sessionId:string, additionalParams?: Record<string, string>):string {
        return JSON.stringify({
            query: inputText,
            chatHistory: chatHistory,
            additionalParams: additionalParams,
            userId: userId,
            sessionId: sessionId,
        });
    }

    private defaultOutputPayloaderDecoder(response: any): ConversationMessage {
        const decodedResponse = JSON.parse(JSON.parse(new TextDecoder("utf-8").decode(response.Payload)).body).response;
        const message: ConversationMessage = {
            role: ParticipantRole.ASSISTANT,
            content: [{ text: `${decodedResponse}` }]
        };
        return message;
    }

    async processRequest(
        inputText: string,
        userId: string,
        sessionId: string,
        chatHistory: ConversationMessage[],
        additionalParams?: Record<string, string>
      ): Promise<ConversationMessage>{

        // Use encoder (handling both sync and async versions)
        const payloadEncoder = this.options.inputPayloadEncoder || this.defaultInputPayloadEncoder;
        const payload = await Promise.resolve(payloadEncoder(inputText, chatHistory, userId, sessionId, additionalParams));
        const invokeParams = {
            FunctionName: this.options.functionName,
            Payload: payload,
        };

        const response = await this.lambdaClient.send(new InvokeCommand(invokeParams));

        // Use decoder (handling both sync and async versions)
        const payloadDecoder = this.options.outputPayloadDecoder || this.defaultOutputPayloaderDecoder;

        return Promise.resolve(payloadDecoder(response));
      }
}
