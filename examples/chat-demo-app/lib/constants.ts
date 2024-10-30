export const USER_INPUT_ACTION_NAME = "UserInputAction";
export const USER_INPUT_PARENT_SIGNATURE = "AMAZON.UserInput";

export const AMAZON_BEDROCK_METADATA = 'AMAZON_BEDROCK_METADATA';
export const AMAZON_BEDROCK_TEXT_CHUNK = 'AMAZON_BEDROCK_TEXT_CHUNK';
export const KB_DEFAULT_VECTOR_FIELD = 'bedrock-knowledge-base-default-vector';
export const MAX_KB_SUPPORTED = 2;

export const DEFAULT_BLOCKED_INPUT_MESSAGE ='Invalid input. Query violates our usage policy.';
export const DEFAULT_BLOCKED_OUTPUT_MESSAGE = 'Unable to process. Query violates our usage policy.';

export class BedrockKnowledgeBaseModels {

    public static readonly TITAN_EMBED_TEXT_V1 = new BedrockKnowledgeBaseModels("amazon.titan-embed-text-v1", 1536);
    public static readonly COHERE_EMBED_ENGLISH_V3 = new BedrockKnowledgeBaseModels("cohere.embed-english-v3", 1024);
    public static readonly COHERE_EMBED_MULTILINGUAL_V3 = new BedrockKnowledgeBaseModels("cohere.embed-multilingual-v3", 1024);

    public readonly modelName: string;
    public readonly vectorDimension: number;
    constructor(modelName: string, vectorDimension: number) {
        this.modelName = modelName;
        this.vectorDimension = vectorDimension;
    }
    public getArn(region:string): string {
        return `arn:aws:bedrock:${region}::foundation-model/${this.modelName}`;
    }
}