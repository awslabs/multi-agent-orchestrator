import React from 'react';

const Examples: React.FC = () => {
  return (
    <div className="examples">
      <h2>How to Use the Multi-Agent System</h2>
      <ol>
        <li>
          <strong>Create Agents:</strong> Use the Agent Editor to create different types of agents (BedrockLLM, Lambda, Chain, Translator).
        </li>
        <li>
          <strong>Chat with Agents:</strong> Use the Chat interface to interact with the multi-agent system. The system will automatically route your request to the most appropriate agent.
        </li>
        <li>
          <strong>Web Browsing:</strong> BedrockLLM agents have web browsing capabilities. Try asking questions that require up-to-date information.
        </li>
        <li>
          <strong>Chaining Agents:</strong> Create a Chain Agent to combine the capabilities of multiple agents for complex tasks.
        </li>
        <li>
          <strong>Translation:</strong> Use the Bedrock Translator Agent for language translation tasks.
        </li>
      </ol>
      <h3>Example Prompts:</h3>
      <ul>
        <li>"What's the latest news about artificial intelligence?"</li>
        <li>"Translate 'Hello, how are you?' to French, then to Japanese."</li>
        <li>"Calculate the fibonacci sequence up to the 10th number, then summarize its significance in mathematics."</li>
      </ul>
    </div>
  );
};

export default Examples;