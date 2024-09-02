import { Agent, AgentOptions } from "./agent";
import { ConversationMessage, ParticipantRole } from "../types";
import { Logger } from "../utils/logger";
import { 
  ComprehendClient, 
  DetectSentimentCommand, 
  DetectPiiEntitiesCommand, 
  DetectToxicContentCommand,
  DetectSentimentCommandOutput,
  DetectPiiEntitiesCommandOutput,
  DetectToxicContentCommandOutput,
  LanguageCode
} from "@aws-sdk/client-comprehend";

// Interface for toxic content labels returned by Comprehend
interface ToxicContent {
  Name: "GRAPHIC" | "HARASSMENT_OR_ABUSE" | "HATE_SPEECH" | "INSULT" | "PROFANITY" | "SEXUAL" | "VIOLENCE_OR_THREAT";
  Score: number;
}

// Interface for toxic labels result structure
interface ToxicLabels {
  Labels: ToxicContent[];
  Toxicity: number;
}

// Type definition for custom check functions
type CheckFunction = (input: string) => Promise<string | null>;

// Extended options for ComprehendContentFilterAgent
export interface ComprehendFilterAgentOptions extends AgentOptions {
    enableSentimentCheck?: boolean;
    enablePiiCheck?: boolean;
    enableToxicityCheck?: boolean;
    sentimentThreshold?: number;
    toxicityThreshold?: number;
    allowPii?: boolean;
    languageCode?: LanguageCode;
}

export class ComprehendFilterAgent extends Agent {
  private comprehendClient: ComprehendClient;
  private customChecks: CheckFunction[] = [];

  private enableSentimentCheck: boolean;
  private enablePiiCheck: boolean;
  private enableToxicityCheck: boolean;
  private sentimentThreshold: number;
  private toxicityThreshold: number;
  private allowPii: boolean;
  private languageCode: LanguageCode;

  constructor(options: ComprehendFilterAgentOptions) {
    super(options);

    this.comprehendClient = options.region
      ? new ComprehendClient({ region: options.region })
      : new ComprehendClient();

    this.enableSentimentCheck = options.enableSentimentCheck ?? true;
    this.enablePiiCheck = options.enablePiiCheck ?? true;
    this.enableToxicityCheck = options.enableToxicityCheck ?? true;
    this.sentimentThreshold = options.sentimentThreshold ?? 0.7;
    this.toxicityThreshold = options.toxicityThreshold ?? 0.7;
    this.allowPii = options.allowPii ?? false;
    this.languageCode = this.validateLanguageCode(options.languageCode) ?? 'en';

    if (!this.enableSentimentCheck && 
        !this.enablePiiCheck && 
        !this.enableToxicityCheck) {
      this.enableToxicityCheck = true;
    }
  }

  /**
   * Processes a user request by sending it to the Amazon Bedrock agent for processing.
   * @param inputText - The user input as a string.
   * @param userId - The ID of the user sending the request.
   * @param sessionId - The ID of the session associated with the conversation.
   * @param chatHistory - An array of Message objects representing the conversation history.
   * @param additionalParams - Optional additional parameters as key-value pairs.
   * @returns A Promise that resolves to a Message object containing the agent's response.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage> {
    try {
      const issues: string[] = [];

      const [sentimentResult, piiResult, toxicityResult] = await Promise.all([
        this.enableSentimentCheck ? this.detectSentiment(inputText) : null,
        this.enablePiiCheck ? this.detectPiiEntities(inputText) : null,
        this.enableToxicityCheck ? this.detectToxicContent(inputText) : null
      ]);

      if (this.enableSentimentCheck && sentimentResult) {
        const sentimentIssue = this.checkSentiment(sentimentResult);
        if (sentimentIssue) issues.push(sentimentIssue);
      }

      if (this.enablePiiCheck && piiResult) {
        const piiIssue = this.checkPii(piiResult);
        if (piiIssue) issues.push(piiIssue);
      }

      if (this.enableToxicityCheck && toxicityResult) {
        const toxicityIssue = this.checkToxicity(toxicityResult);
        if (toxicityIssue) issues.push(toxicityIssue);
      }

      for (const check of this.customChecks) {
        const customIssue = await check(inputText);
        if (customIssue) issues.push(customIssue);
      }

      if (issues.length > 0) {
        Logger.logger.warn(`Content filter issues detected: ${issues.join('; ')}`);
        return this.createErrorResponse("Content filter issues detected", new Error(issues.join('; ')));
      }

      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: inputText }]
      };

    } catch (error) {
      Logger.logger.error("Error in ComprehendContentFilterAgent:", error);
      return this.createErrorResponse("An error occurred while processing your request", error);
    }
  }

  addCustomCheck(check: CheckFunction) {
    this.customChecks.push(check);
  }

  private checkSentiment(result: DetectSentimentCommandOutput): string | null {
    if (result.Sentiment === 'NEGATIVE' && 
        result.SentimentScore?.Negative > this.sentimentThreshold) {
      return `Negative sentiment detected (${result.SentimentScore.Negative.toFixed(2)})`;
    }
    return null;
  }

  private checkPii(result: DetectPiiEntitiesCommandOutput): string | null {
    if (!this.allowPii && result.Entities && result.Entities.length > 0) {
      return `PII detected: ${result.Entities.map(e => e.Type).join(', ')}`;
    }
    return null;
  }

  private checkToxicity(result: DetectToxicContentCommandOutput): string | null {
    const toxicLabels = this.getToxicLabels(result);
    if (toxicLabels.length > 0) {
      return `Toxic content detected: ${toxicLabels.join(', ')}`;
    }
    return null;
  }

  private async detectSentiment(text: string) {
    const command = new DetectSentimentCommand({
      Text: text,
      LanguageCode: this.languageCode
    });
    return this.comprehendClient.send(command);
  }

  private async detectPiiEntities(text: string) {
    const command = new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: this.languageCode
    });
    return this.comprehendClient.send(command);
  }

  private async detectToxicContent(text: string) {
    const command = new DetectToxicContentCommand({
      TextSegments: [{ Text: text }],
      LanguageCode: this.languageCode
    });
    return this.comprehendClient.send(command);
  }

  private getToxicLabels(toxicityResult: DetectToxicContentCommandOutput): string[] {
    const toxicLabels: string[] = [];

    if (toxicityResult.ResultList && Array.isArray(toxicityResult.ResultList)) {
      toxicityResult.ResultList.forEach((result: ToxicLabels) => {
        if (result.Labels && Array.isArray(result.Labels)) {
          result.Labels.forEach((label: ToxicContent) => {
            if (label.Score > this.toxicityThreshold) {
              toxicLabels.push(label.Name);
            }
          });
        }
      });
    }

    return toxicLabels;
  }

  setLanguageCode(languageCode: LanguageCode): void {
    const validatedLanguageCode = this.validateLanguageCode(languageCode);
    if (validatedLanguageCode) {
      this.languageCode = validatedLanguageCode;
    } else {
      throw new Error(`Invalid language code: ${languageCode}`);
    }
  }

  private validateLanguageCode(languageCode: LanguageCode | undefined): LanguageCode | undefined {
    if (!languageCode) return undefined;

    const validLanguageCodes: LanguageCode[] = [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'hi', 'ja', 'ko', 'zh', 'zh-TW'
    ];

    return validLanguageCodes.includes(languageCode) ? languageCode : undefined;
  }
}