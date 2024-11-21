import React, { useState } from 'react';
import { Agent } from '../types';

// Remove or comment out the local Agent interface
// interface Agent {
//   id: string;
//   name: string;
//   prompt: string;
// }

interface AgentListProps {
  agents: Agent[];
  onAgentSelect: (agent: Agent) => void;
  onAgentRemove: (agentId: string) => void;
  getAgentPrompt: (agentId: string) => Promise<string>;
}

const AgentList: React.FC<AgentListProps> = ({ agents, onAgentSelect, onAgentRemove, getAgentPrompt }) => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');

  const handleEditPrompt = async (agent: Agent) => {
    setSelectedAgent(agent);
    if (agent.id) {
      try {
        const fetchedPrompt = await getAgentPrompt(agent.id);
        setCurrentPrompt(fetchedPrompt);
      } catch (error) {
        console.error('Failed to fetch agent prompt:', error);
        setCurrentPrompt('');
      }
    } else {
      setCurrentPrompt('');
    }
    setShowModal(true);
  };

  const handleRemoveAgent = (agentId: string | undefined) => {
    if (agentId) {
      onAgentRemove(agentId);
    } else {
      console.error('Attempted to remove an agent with undefined id');
    }
  };

  return (
    <div className="agent-list">
      {agents.map((agent) => (
        <div key={agent.id || `temp-${agent.name}`} className="agent-item">
          <div className="agent-info">
            <strong>{agent.name}</strong>
          </div>
          <div className="agent-actions">
            <button onClick={() => onAgentSelect(agent)}>Edit</button>
            <button onClick={() => handleEditPrompt(agent)}>Edit Prompt</button>
            <button onClick={() => handleRemoveAgent(agent.id)}>X</button>
          </div>
        </div>
      ))}
      {showModal && selectedAgent && (
        <div className="modal">
          <h2>Edit Prompt for {selectedAgent.name}</h2>
          <textarea
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
          />
          <button onClick={() => {
            // Handle saving the updated prompt
            setShowModal(false);
          }}>Save</button>
          <button onClick={() => setShowModal(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default AgentList;