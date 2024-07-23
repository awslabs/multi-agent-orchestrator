---
title: Use cases
description: An overview of the use cases that are possible to implement using this framework
---

The Multi-Agent Orchestrator framework can enable a wide range of powerful use cases across various industries and domains. Here are some potential use cases that can benefit from this flexible and scalable framework:

## 1. Cost efficient routing:

The Multi-Agent Orchestrator can intelligently route queries to the most cost-effective agent based on the complexity of the task, optimizing resource utilization and reducing overall operational costs.

Key aspects of this approach include:

1. Task Complexity Analysis: The classifier assesses the complexity of each incoming query, considering factors like required expertise, computational intensity, and expected response time.

2. Agent Cost Tiers: Agents are categorized into different cost tiers, ranging from low-cost, general-purpose models to high-cost, specialized expert models.

3. Dynamic Routing: Queries are dynamically routed to the lowest-cost agent capable of handling the task effectively. Simple queries (e.g., basic information retrieval, short summaries) are directed to cheaper, less powerful models, while complex tasks are routed to more expensive, specialized agents.

This approach ensures that expensive computational resources are used judiciously, reserving them for tasks that truly require advanced capabilities. It allows organizations to manage costs effectively while still providing high-quality responses across a wide range of query complexities.


## 2. Multi-lingual routing:
By integrating language-specific agents, the Multi-Agent Orchestrator can facilitate multi-lingual support, enabling users to interact with the system in their preferred language while maintaining consistent experiences across languages.

Key aspects of this approach include:

1. Language Detection: The classifier incorporates language detection capabilities to identify the language of incoming queries.
2. Language-Specific Agents: The system includes a range of agents specialized in different languages, each trained to handle queries and generate responses in their respective languages.
3. Dynamic Language Routing: Queries are automatically routed to the appropriate language-specific agent based on the detected language of the user's input.


### Note:
While not all existing components may inherently support both cost-efficient and multi-lingual routing, the modular and extensible nature of the Multi-Agent Orchestrator framework allows for relatively straightforward expansion to incorporate these features. Developers can leverage the framework's flexibility to implement custom classifiers, agents, or additional logic to enable these advanced routing capabilities without significant architectural overhauls.