---
title: Custom classifier
description: How to configure and customize the Classifier in the Multi-Agent Orchestrator System
---

This guide explains how to create a custom classifier for the Multi-Agent Orchestrator by extending the abstract `Classifier` class. Custom classifiers allow you to implement your own logic for intent classification and agent selection.

## Overview

To create a custom classifier, you need to:

1. Extend the abstract `Classifier` class
2. Implement the required `processRequest` method
3. Optionally override other methods for additional customization

## Step-by-Step Guide

### 1. Extend the Classifier Class

Create a new class that extends the abstract `Classifier` class:

```typescript
import { Classifier } from './path-to-classifier';
import { ClassifierResult, ConversationMessage } from './path-to-types';

export class MyCustomClassifier extends Classifier {
  // Implementation will go here
}
```

### 2. Implement the processRequest Method

The `processRequest` method is the core of your custom classifier. It should analyze the input and return a `ClassifierResult`:

```typescript
export class MyCustomClassifier extends Classifier {
  async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    // Your custom classification logic goes here
    
    return {
      selectedAgent: firstAgent,
      confidence: 1.0
    };
  }
}
```


## Using Your Custom Classifier

To use your custom classifier with the Multi-Agent Orchestrator:

```typescript
import { MultiAgentOrchestrator } from './path-to-multi-agent-orchestrator';
import { MyCustomClassifier } from './path-to-my-custom-classifier';

const customClassifier = new MyCustomClassifier('custom value');
const orchestrator = new MultiAgentOrchestrator({ classifier: customClassifier });
```

## Best Practices

1. **Robust Analysis**: Implement thorough analysis of the input text and chat history to make informed classification decisions.
2. **Error Handling**: Include proper error handling in your `processRequest` method to gracefully handle unexpected inputs or processing errors.
3. **Extensibility**: Design your custom classifier to be easily extensible for future improvements or adaptations.
4. **Performance**: Consider the performance implications of your classification logic, especially for high-volume applications.

## Example: Keyword-Based Classifier

Here's an example of a simple keyword-based classifier:

```typescript
import { Classifier } from './path-to-classifier';
import { ClassifierResult, ConversationMessage, Agent } from './path-to-types';

export class KeywordClassifier extends Classifier {
  private keywordMap: { [keyword: string]: string };

  constructor(keywordMap: { [keyword: string]: string }) {
    super();
    this.keywordMap = keywordMap;
  }

  async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    const lowercaseInput = inputText.toLowerCase();
    
    for (const [keyword, agentId] of Object.entries(this.keywordMap)) {
      if (lowercaseInput.includes(keyword)) {
        const selectedAgent = this.getAgentById(agentId);
        return {
          selectedAgent,
          confidence: 0.8 // Simple fixed confidence
        };
      }
    }

    // Default to the first agent if no keyword matches
    const defaultAgent = Object.values(this.agents)[0];
    return {
      selectedAgent: defaultAgent,
      confidence: 0.5
    };
  }
}

// Usage
const keywordMap = {
  'technical': 'tech-support-agent',
  'billing': 'billing-agent',
  'sales': 'sales-agent'
};
const keywordClassifier = new KeywordClassifier(keywordMap);
const orchestrator = new MultiAgentOrchestrator({ classifier: keywordClassifier });
```

This example demonstrates a basic keyword-based classification strategy. You can expand on this concept to create more sophisticated custom classifiers based on your specific needs.

## Conclusion

Creating a custom classifier allows you to implement specialized logic for intent classification and agent selection in the Multi-Agent Orchestrator. By extending the `Classifier` class and implementing the `processRequest` method, you can tailor the classification process to your specific use case and requirements.

Remember to thoroughly test your custom classifier to ensure it performs well across a wide range of inputs and scenarios.