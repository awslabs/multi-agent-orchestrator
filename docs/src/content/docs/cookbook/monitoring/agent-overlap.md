---
title: Agent Overlap Analysis
description: Understanding and using the Agent Overlap Analysis feature in the Multi-Agent Orchestrator framework
---

Agent Overlap Analysis is a feature of the Multi-Agent Orchestrator framework designed to optimize agent configurations by analyzing the descriptions of your agents. This tool helps identify similarities, potential conflicts, and the uniqueness of each agent's role within the system.

The core idea behind Agent Overlap Analysis is to quantitatively assess how similar or different your agents are based on their descriptions. This analysis helps in:

1. Identifying redundancies in agent roles
2. Detecting potential conflicts where agents might have overlapping responsibilities
3. Ensuring each agent has a distinct purpose within the system
4. Optimizing the overall efficiency of your multi-agent setup

## How It Works

The Agent Overlap Analysis uses natural language processing and information retrieval techniques to compare agent descriptions:

1. **Text Preprocessing**: Agent descriptions are tokenized and stopwords are removed to focus on meaningful content.

2. **TF-IDF Calculation**: Term Frequency-Inverse Document Frequency (TF-IDF) is [computed](https://naturalnode.github.io/natural/tfidf.html) for each agent's description. This weighs the importance of words in the context of all agent descriptions.

3. **Pairwise Comparison**: Each agent's description is compared with every other agent's description using cosine similarity of their TF-IDF vectors. This provides a measure of how similar any two agents are.

4. **Uniqueness Scoring**: A uniqueness score is calculated for each agent based on its average dissimilarity from all other agents.

## Implementation Details

The `AgentOverlapAnalyzer` class is the core of this feature. Here's a breakdown of its main components:

- `constructor(agents)`: Initializes the analyzer with a dictionary of agents, where each agent has a name and description.
- `analyzeOverlap()`: The main method that performs the analysis and outputs the results.
- `calculateCosineSimilarity(terms1, terms2)`: A helper method that calculates the cosine similarity between two sets of TF-IDF terms.

## Using Agent Overlap Analysis


Install the framework

```bash
    npm install multi-agent-orchestrator
```
To use the Agent Overlap Analysis feature:

```typescript
import { AgentOverlapAnalyzer } from "multi-agent-orchestrator";

const agents = {
  finance: { name: "Finance Agent", description: "Handles financial queries and calculations" },
  tech: { name: "Tech Support", description: "Provides technical support and troubleshooting" },
  hr: { name: "HR Assistant", description: "Assists with human resources tasks and queries" }
};

const analyzer = new AgentOverlapAnalyzer(agents);
analyzer.analyzeOverlap();
```

## Understanding the Results

The analysis provides two main types of results:

### 1. Pairwise Overlap Results

For each pair of agents, you'll see:
- **Overlap Percentage**: How similar their descriptions are (higher percentage means more overlap).
- **Potential Conflict**: Categorized as "High", "Medium", or "Low" based on the overlap percentage.

### 2. Uniqueness Scores

For each agent, you'll see a uniqueness score indicating how distinct its role is within the system.

## Example Output

Here's an example of what the output might look like:

```
Pairwise Overlap Results:
_________________________

finance - tech:
- Overlap Percentage - 15.23%
- Potential Conflict - Medium

finance - hr:
- Overlap Percentage - 8.75%
- Potential Conflict - Low

tech - hr:
- Overlap Percentage - 12.10%
- Potential Conflict - Medium

Uniqueness Scores:
_________________

Agent: finance, Uniqueness Score: 89.55%
Agent: tech, Uniqueness Score: 86.32%
Agent: hr, Uniqueness Score: 91.20%
```

## Interpreting and Acting on Results

- **High Overlap (>30%) / Low Uniqueness**: Consider refining agent descriptions to create clearer distinctions between their roles.
- **Medium Overlap (10-30%)**: Some overlap can be acceptable, especially for related domains. Use your judgment to decide if refinement is needed.
- **Low Overlap (<10%) / High Uniqueness**: This generally indicates well-differentiated agents, but ensure the agents still cover all necessary domains.

## Best Practices

1. **Run Analysis Regularly**: Perform this analysis whenever you add new agents or modify existing agent descriptions.
2. **Iterative Refinement**: Use the results to refine your agent descriptions, then re-run the analysis to see the impact of your changes.
3. **Balance Specificity and Coverage**: Aim for agent descriptions that are specific enough to be unique but broad enough to cover their intended domain.
4. **Consider Context**: Remember that some overlap might be necessary or beneficial, depending on your use case.

## Limitations

- The analysis is based solely on textual descriptions. It doesn't account for the actual functionality or implementation of the agents.
- Very short or overly generic descriptions may lead to less meaningful results.
- The effectiveness of the analysis depends on the quality and specificity of the agent descriptions.

By leveraging the Agent Overlap Analysis feature, you can continuously refine and optimize your agents, ensuring each agent has a clear, distinct purpose while collectively covering all necessary domains of expertise.