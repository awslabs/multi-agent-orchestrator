import React from 'react';
import { Agent } from '../types';

interface AgentListProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onDeleteAgent: (agentId: string) => void;
}

const AgentList: React.FC<AgentListProps> = ({ agents, onSelectAgent, onDeleteAgent }) => {
  return (
    <div className="agent-list">
      <h2>Agents</h2>
      {agents.map(agent => (
        <div key={agent.id} className="agent-item">
          <div className="agent-info">
            <strong>{agent.name}</strong>
            <span className="agent-type">{agent.type}</span>
          </div>
          <div className="agent-actions">
            <button onClick={() => onSelectAgent(agent)}>Edit</button>
            <button onClick={() => onDeleteAgent(agent.id!)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentList;