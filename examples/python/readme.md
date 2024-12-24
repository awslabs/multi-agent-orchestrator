# AWS Multi-Agent Orchestrator Demos

This Streamlit application showcases various demos powered by the AWS Multi-Agent Orchestrator framework, demonstrating how multiple AI agents can collaborate to solve complex tasks using Amazon Bedrock.

## 🎯 Current Demos

### 🎬 [AI Movie Production](../movie-production/README.md)
**Requirements**: AWS Account with Amazon Bedrock access (Claude models enabled)

Transform your movie ideas into detailed concepts with this AI-powered production assistant. Simply describe your movie idea, choose a genre and target audience, and the system will generate a complete script outline and suggest suitable actors for main roles based on real-time casting research. Powered by a team of specialized AI agents using Claude 3 on Amazon Bedrock.

### ✈️ [AI Travel Planner](../travel-planner/README.md)
**Requirements**: Anthropic API Key

Create personalized travel itineraries with this AI-powered travel assistant. Input your destination and duration, and the system will research attractions, accommodations, and activities in real-time, crafting a detailed day-by-day itinerary tailored to your preferences. Built using specialized research and planning agents powered by Amazon Bedrock.

## 🚀 Getting Started

### Prerequisites
- Python 3.8 or higher
- For Movie Production Demo:
  - AWS account with access to Amazon Bedrock
  - AWS credentials configured ([How to configure AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html))
  - Claude models enabled in Amazon Bedrock ([Enable Bedrock model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html))
- For Travel Planner Demo:
  - Anthropic API Key ([Get your API key](https://console.anthropic.com/account/keys))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/awslabs/multi-agent-orchestrator.git
```

2. Navigate to the demos directory:
```bash
cd examples/python
python -m venv venv
source venv/bin/activate # On Windows use `venv\Scripts\activate`
```

3. Install the required dependencies:
```bash
# For running all demos through main app
python -m venv venv_main
source venv/bin/activate # On Windows use `venv_main\Scripts\activate`
pip install -r requirements.txt
```

4. Configure AWS credentials:
   - Follow the [AWS documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) to set up your credentials using your preferred method (AWS CLI, environment variables, or credentials file)

5. Run the Streamlit app:
```bash
streamlit run main-app.py
```

## 💡 How It Works

The application uses the Multi-Agent Orchestrator framework to coordinate multiple specialized AI agents powered by Amazon Bedrock. Each demo showcases different aspects of agent collaboration:
- **Movie Production**: Demonstrates creative collaboration between script writing and casting agents
- **Travel Planning**: Shows how research and planning agents can work together to create personalized travel experiences

Each agent is powered by Claude 3 on Amazon Bedrock and can communicate with other agents through a supervisor agent that orchestrates the entire process.

## 🛠️ Technologies Used
- AWS Multi-Agent Orchestrator
- Amazon Bedrock
- Claude 3 (Anthropic)
- Streamlit
- Python

## 📚 Documentation

For more information about the Multi-Agent Orchestrator framework and its capabilities, visit our [documentation](https://awslabs.github.io/multi-agent-orchestrator/).

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.