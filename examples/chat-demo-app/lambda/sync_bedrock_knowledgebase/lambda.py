import boto3

client = boto3.client('bedrock-agent')


def lambda_handler(event, context):
    response = client.start_ingestion_job(
        dataSourceId=event.get('dataSourceId'),
        knowledgeBaseId=event.get('knowledgeBaseId')
    )
    print(response)