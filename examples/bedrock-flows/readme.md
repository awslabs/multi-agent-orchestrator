## BedrockFlowsAgent examples
This example, in Python and Typescript, show how to integrate your Bedrock Flows into the multi-agent orchestrator.
This is the flow we used for our testing.

### tech-agent-flow

In this flow we connected an input node to a prompt node and the output of the prompt is connec to an output node.


![tech-agent-flow](./tech-agent-flow.png)


The prompt node has 2 inputs:
- question (current question)
- history (previous conversation)

![prompt-node-configuration](./prompt-config.png)

Note: as of 2nd of December, 2024, Bedrock Flows does not offer a memory feature that would allow for a flow to keep track of previous interaction with it.

In this example, we show you how to not only integrate your flow into the multi-agent orchestrator, but also, how to integrate your flow converation history into a flow for greater user experience and better results.






