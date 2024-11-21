import json
import datetime

def lambda_handler(event, context):
    try:
        # Get the message from the event
        message = event.get('message', '')
        
        # Mock service status check - replace with your actual status checking logic
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status_response = {
            "timestamp": current_time,
            "services": {
                "database": "healthy",
                "api": "healthy",
                "web": "healthy"
            },
            "message": f"Checking status in response to: {message}"
        }
        
        # Return formatted response
        return {
            'statusCode': 200,
            'body': json.dumps(status_response),
            'headers': {
                'Content-Type': 'application/json'
            }
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            }),
            'headers': {
                'Content-Type': 'application/json'
            }
        } 