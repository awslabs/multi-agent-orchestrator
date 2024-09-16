import boto3
import json

def test_bedrock_connection():
    try:
        bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name='us-east-1'  # Replace with your preferred region
        )

        payload = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, Claude. How are you today?"
                }
            ],
            "temperature": 0.5,
            "top_p": 1,
        }

        response = bedrock_runtime.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=json.dumps(payload)
        )
        response_body = json.loads(response['body'].read())
        print("Bedrock connection successful!")
        print("Response:", response_body['content'][0]['text'])
    except Exception as e:
        print("Error connecting to Bedrock:", str(e))

if __name__ == "__main__":
    test_bedrock_connection()