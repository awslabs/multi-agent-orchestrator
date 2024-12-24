import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

interface LogMessage {
  destination: string;
  message: string;
}

export class SQSLogger {
  private sqsClient: SQSClient;
  private queueUrl: string;
  private destination: string;

  constructor(queueUrl: string, destination: string, region: string = "us-east-1") {
    this.sqsClient = new SQSClient({ region });
    this.queueUrl = queueUrl;
    this.destination = destination;
  }

  private async sendToSQS(message: string): Promise<void> {
    const logMessage: LogMessage = {
      destination: this.destination,
      message: message,
    };

    const params = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(logMessage),
    };

    try {
      await this.sqsClient.send(new SendMessageCommand(params));
    } catch (error) {
      console.error("Error sending message to SQS:", error);
    }
  }



  private formatMessage(...args: any[]): string {
    return args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
  }

  log(...args: any[]): void {
    const message = this.formatMessage(...args);
    this.sendToSQS(message);
  }

  info(...args: any[]): void {
    this.log('[INFO]', ...args);
  }

  warn(...args: any[]): void {
    this.log('[WARN]', ...args);
  }

  error(...args: any[]): void {
    this.log('[ERROR]', ...args);
  }

  debug(...args: any[]): void {
    this.log('[DEBUG]', ...args);
  }
}