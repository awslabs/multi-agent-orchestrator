---
title: Cost-Efficient Routing Pattern
description: Cost-Efficient Routing Pattern using the Multi-Agent Orchestrator framework
---


The Multi-Agent Orchestrator can intelligently route queries to the most cost-effective agent based on task complexity, optimizing resource utilization and reducing operational costs.

## How It Works

1. **Task Complexity Analysis**
   - The classifier assesses incoming query complexity
   - Considers factors like required expertise, computational intensity, and expected response time
   - Makes routing decisions based on task requirements

2. **Agent Cost Tiers**
   - Agents are categorized into different cost tiers:
     - Low-cost: General-purpose models for simple tasks
     - Mid-tier: Balanced performance and cost
     - High-cost: Specialized expert models for complex tasks

3. **Dynamic Routing**
   - Simple queries route to cheaper models
   - Complex tasks route to specialized agents
   - Automatic routing based on query analysis

## Implementation Example

```typescript
// Configure low-cost agent for simple queries
const basicAgent = new BedrockLLMAgent({
  name: "Basic Agent",
  modelId: "mistral.mistral-small-2402-v1:0",
  description: "Handles simple queries and basic information retrieval",
  streaming: true,
  inferenceConfig: { temperature: 0.0 }
});

// Configure expert agent for complex tasks
const expertAgent = new BedrockLLMAgent({
  name: "Expert Agent",
  modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
  description: "Handles complex analysis and specialized tasks",
  streaming: true,
  inferenceConfig: { temperature: 0.0 }
});

// Add agents to orchestrator
orchestrator.addAgent(basicAgent);
orchestrator.addAgent(expertAgent);
```

## Benefits
- Optimal resource utilization
- Cost reduction for simple tasks
- Improved response quality for complex queries
- Efficient scaling based on query complexity