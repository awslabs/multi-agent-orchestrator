## BedrockFlowsAgent example
This example, in Python and Typescript, show how to integrate your Bedrock Flows into the multi-agent orchestrator.

This is the flow we used for our testing.

### tech-agent-flow

In this flow we connected an input node to a prompt node and the output of the prompt is connected to an output node.


![tech-agent-flow](./tech-agent-flow.png)


The prompt node has 2 inputs:
- question (current question)
- history (previous conversation)

![prompt-node-configuration](./prompt-config.png)


📝 Note

📅 As of December 2, 2024, Bedrock Flows does not include a memory feature to retain previous interactions.

In this example, we demonstrate:
- 1️⃣ How to integrate your flow into a multi-agent orchestrator.
- 2️⃣ How to incorporate conversation history into your flow to provide a smoother user experience and generate more accurate results.

🚀 Let's get started!

