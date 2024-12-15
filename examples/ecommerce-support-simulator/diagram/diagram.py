from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.database import Dynamodb
from diagrams.aws.storage import S3
from diagrams.aws.security import Cognito
from diagrams.aws.integration import SQS
from diagrams.aws.analytics import Quicksight
from diagrams.generic.storage import Storage
from diagrams.onprem.client import User

with Diagram("AI E-commerce Support Simulator Architecture", show=False, direction="TB"):
    user = User("Customer")

    with Cluster("Frontend"):
        website_bucket = S3("Website Hosting Bucket")
        browser = Storage("User Browser")

    with Cluster("Authentication"):
        cognito = Cognito("Cognito User Pool")

    with Cluster("Backend"):
        appsync = Quicksight("AppSync API")  # Replacing with a placeholder for visualization
        customer_message_lambda = Lambda("Customer Message Lambda")
        support_message_lambda = Lambda("Support Message Lambda")
        send_response_lambda = Lambda("Send Response Lambda")

        with Cluster("Data Storage"):
            session_table = Dynamodb("Session Table")

    with Cluster("Queues - Key Components", direction="TB"):
        customer_messages_queue = SQS("Customer Messages Queue")
        support_messages_queue = SQS("Support Messages Queue")
        outgoing_messages_queue = SQS("Outgoing Messages Queue")

    # Connections
    user >> Edge(label="Access Website") >> browser
    browser >> Edge(label="Authenticate") >> cognito
    
    customer_message_lambda >> Edge(label="Send to Customer Messages Queue") >> customer_messages_queue
    support_message_lambda >> Edge(label="Send to Support Messages Queue") >> support_messages_queue
    outgoing_messages_queue >> Edge(label="Invoke Send Response Lambda") >> send_response_lambda
    appsync >> Edge(label="Coordinate Backend Services") >> [customer_message_lambda, support_message_lambda, send_response_lambda]