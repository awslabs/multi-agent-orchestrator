import React, { useState, useEffect } from 'react';
import { Agent, LambdaFunction } from '../types';

interface AgentEditorProps {
  agent: Agent | null;
  onSave: (agent: Agent) => void;
  lambdaFunctions: LambdaFunction[];
}

const AgentEditor: React.FC<AgentEditorProps> = ({ agent, onSave, lambdaFunctions }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('BedrockLLMAgent');
  const [modelId, setModelId] = useState('anthropic.claude-3-sonnet-20240229-v1:0');
  const [lambdaFunctionName, setLambdaFunctionName] = useState('');
  const [chainAgents, setChainAgents] = useState('');
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setDescription(agent.description);
      setType(agent.type);
      setModelId(agent.model_id || 'anthropic.claude-3-sonnet-20240229-v1:0');
      setLambdaFunctionName(agent.lambda_function_name || '');
      setChainAgents(agent.chain_agents?.join(', ') || '');
      setEnableWebSearch(agent.enable_web_search || false);
    } else {
      resetForm();
    }
  }, [agent]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('BedrockLLMAgent');
    setModelId('anthropic.claude-3-sonnet-20240229-v1:0');
    setLambdaFunctionName('');
    setChainAgents('');
    setEnableWebSearch(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAgent: Agent = {
      name,
      description,
      type,
      model_id: modelId,
      lambda_function_name: type === 'LambdaAgent' ? lambdaFunctionName : undefined,
      chain_agents: type === 'ChainAgent' ? chainAgents.split(',').map(a => a.trim()) : undefined,
      enable_web_search: enableWebSearch,
    };
    if (agent && agent.id) {
      newAgent.id = agent.id;
    }
    onSave(newAgent);
    resetForm();
  };

  return (
    <form onSubmit={handleSubmit} className="agent-editor">
      <h2>{agent ? 'Edit Agent' : 'Add New Agent'}</h2>
      <div className="form-group">
        <label htmlFor="agent-name">Agent Name:</label>
        <input
          id="agent-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="agent-description">Description:</label>
        <textarea
          id="agent-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label>Agent Type:</label>
        <div className="agent-type-buttons">
          <button type="button" onClick={() => setType('BedrockLLMAgent')} className={type === 'BedrockLLMAgent' ? 'active' : ''}>Bedrock LLM Agent</button>
          <button type="button" onClick={() => setType('LambdaAgent')} className={type === 'LambdaAgent' ? 'active' : ''}>Lambda Agent</button>
          <button type="button" onClick={() => setType('ChainAgent')} className={type === 'ChainAgent' ? 'active' : ''}>Chain Agent</button>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="model-id">Model:</label>
        <select
          id="model-id"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          required
        >
          <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
          <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
          <option value="anthropic.claude-v2">Claude v2</option>
        </select>
      </div>
      {type === 'LambdaAgent' && (
        <div className="form-group">
          <label htmlFor="lambda-function">Lambda Function:</label>
          <select
            id="lambda-function"
            value={lambdaFunctionName}
            onChange={(e) => setLambdaFunctionName(e.target.value)}
            required
          >
            <option value="">Select a Lambda function</option>
            {lambdaFunctions.map((func) => (
              <option key={func.arn} value={func.name}>{func.name}</option>
            ))}
          </select>
        </div>
      )}
      {type === 'ChainAgent' && (
        <div className="form-group">
          <label htmlFor="chain-agents">Chain Agents:</label>
          <input
            id="chain-agents"
            type="text"
            placeholder="Agent1, Agent2, Agent3"
            value={chainAgents}
            onChange={(e) => setChainAgents(e.target.value)}
            required
          />
        </div>
      )}
      <div className="form-group">
        <label htmlFor="enable-web-search">
          <input
            id="enable-web-search"
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
          />
          Enable Web Search
        </label>
      </div>
      <button type="submit" className="submit-button">{agent ? 'Update Agent' : 'Add Agent'}</button>
    </form>
  );
};

export default AgentEditor;