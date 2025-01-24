# Multi-Agent Payment Processing System

A Streamlit-based application that processes payments for gig workers using a multi-agent orchestration system. The system performs validation, fraud detection, and payment processing through a chain of specialized agents.

## Features

- Payment request validation through a multi-agent system
- Demonistration of building building a graph or chaining multiple agents
- Agents using deterministic function calling as tools to make decision
- Fraud detection analysis using historical data
- Secure payment processing with device and location verification
- User-friendly Streamlit web interface for initiating payments

## System Architecture

The application uses three main agents orchestrated in a chain:

1. **Validation Agent**: Verifies worker eligibility for payments
2. **Fraud Detection Agent**: Analyzes transactions for suspicious patterns
3. **Payment Agent**: Handles the actual payment processing

## Prerequisites

- Python 3.x
- Streamlit
- Amazon Bedrock access
- Required Python packages:
  - uuid
  - asyncio
  - json
  - streamlit
  - multi_agent_orchestrator
  - multi_agent_orchestrator

## Installation

1. Clone the repository
2. Install required dependencies:
```bash
pip install -r requirements.txt
```

## Configuration

The system requires a `workers.json` file in the `payment_backend` directory containing worker information with the following structure:

```json
{
  "worker_id": string,
  "payment_history": [float],
  "registered_devices": [string],
  "location": string
}
```

The `workers.json` file should be placed in the `payment_backend` subdirectory of the project.

## Usage

1. Start the Streamlit application:
```bash
streamlit run app.py
```

2. Enter the required information in the web interface (check details in `workers.json` file under `payment_backend` folder):
   - Worker ID
   - Payment Amount
   - Device ID
   - Location

3. Click "Process Payment" to initiate the payment process

4. Enable Bedrock [Logging](https://community.aws/content/2kkmm6q5ae1AruqcgHADjNl1Zx0/monitoring-foundation-models-with-amazon-cloudwatch) and you can see individual agent's messages passing to other sequentially with their analysis and tool usage in CloudWatch Logs.

## Payment Processing Flow

1. **Validation Check**:
   - Verifies worker existence
   - Checks payment history
   - Validates payment amount limits (<$1000 is set in the code)
   - Confirms device registration

2. **Fraud Detection**:
   - Analyzes payment history
   - Checks for unusual payment amounts
   - Verifies worker location
   - Validates device registration

3. **Payment Processing**:
   - Issues payment if all checks pass
   - Provides transaction confirmation

## Error Handling

The system includes comprehensive error handling for:
- Invalid worker IDs
- Unregistered devices
- Excessive payment amounts
- Suspicious transactions
- System processing errors

## Security Features

- Unique session IDs for each transaction
- Device validation
- Payment amount limits
- Historical transaction analysis
- Location verification

## Technical Details

- Uses Amazon Bedrock's Claude 3 Haiku model for agent intelligence
- Implements async/await pattern for efficient processing
- Utilizes multi-agent orchestration for complex decision making
- Maintains transaction state through the process chain

## Tests to check the functionality

Before you test all tests, check the `workers.json` file in payment_backend and you can use the data from it to issue payments and check for ineligible an fraud payments. if the payment is valid, the file even gets updated with the payment into the payment history (simulating real world transactions)

## Test cases for `validate_payment_request`
### Test case: Validate a valid payment request
- Input: Valid worker ID, payment amount
- Expected output: JSON string with status "success" and message "Payment request validated."

### Test case: Validate a payment request with a non-existent worker
- Input: Invalid worker ID, valid payment amount
- Expected output: JSON string with status "failed" and message "Worker not found."

### Test case: Validate a payment request with insufficient payment history
- Input: Valid worker ID with no payment history, valid payment amount
- Expected output: JSON string with status "failed" and message "Insufficient payment history."

### Test case: Validate a payment request with an excessive payment amount
- Input: Valid worker ID, payment amount greater than 1000
- Expected output: JSON string with status "failed" and message "Payment amount exceeds limit."

## Test cases for `detect_fraud` method

### Test case: Detect fraud for a valid payment request
- Input: Valid worker ID, payment amount, device ID, and location ID
- Expected output: JSON string with status "success" and message "No fraud detected."

### Test case: Detect fraud for a non-existent worker
- Input: Invalid worker ID, valid payment amount, device ID, and location ID
- Expected output: JSON string with status "failed" and message "Worker not found."

### Test case: Detect fraud with an unusually high payment amount
- Input: Valid worker ID, payment amount significantly higher than the average payment history, valid device ID, and location ID
- Expected output: JSON string with status "failed" and message "Fraud detected: Payment amount is unusually high."

### Test case: Detect fraud with a suspicious location
- Input: Valid worker ID, payment amount, valid device ID, and location ID not matching the worker's location
- Expected output: JSON string with status "failed" and message "Fraud detected: Suspicious location."

### Test case: Detect fraud with an unregistered device ID
- Input: Valid worker ID, payment amount, invalid device ID, and valid location ID
- Expected output: JSON string with status "failed" and message "Fraud detected: Device ID not registered with this worker."

## Test cases for `issue_payment` method

### Test case: Issue a valid payment
- Input: Valid worker ID, payment amount, device ID, and location ID
- Expected output: JSON string with status "success" and message "Payment of {payment_amount} issued to worker {worker_id}."

### Test case: Issue a payment for a non-existent worker
- Input: Invalid worker ID, valid payment amount, device ID, and location ID
- Expected output: JSON string with status "failed" and message "Worker not found."

### Test case: Any of the combinations that from validate payment and fraud check to test invalid payment
- Input: Valid worker ID but invalid payment amount and/or invalid device ID and/or invalid location ID
- Expected output: JSON string with status "failed" and relevant message in response.