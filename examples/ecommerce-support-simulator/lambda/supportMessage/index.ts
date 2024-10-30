import { SQSEvent, SQSHandler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Get the queue URL from environment variables
  const queueUrl = process.env.QUEUE_URL;
  if (!queueUrl) {
    throw new Error("QUEUE_URL environment variable is not set");
  }

  // Process each record in the SQS event
  for (const record of event.Records) {
    try {
      // Parse the message body
      const body = JSON.parse(record.body);

      // Create the message object using data from the SQS event
      const message = {
        destination: "customer", // This lambda always sends to 'customer'
        message: body.message,
      };

      // Send the message to another SQS queue
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
      });

      const response = await sqs.send(command);
      console.log('Message sent to SQS:', response.MessageId);
    } catch (error) {
      console.error('Error processing record:', error);
      // You might want to handle this error differently depending on your requirements
    }
  }

  return {
    message: `Processed ${event.Records.length} messages`
  };
};