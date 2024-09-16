import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Agent } from '../types';

interface ChatProps {
  agents: Agent[];
}

const Chat: React.FC<ChatProps> = ({ agents }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0].id || null);
    }
  }, [agents, selectedAgent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAgent) {
      alert('Please select an agent to chat with.');
      return;
    }

    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');

    try {
      const response = await axios.post('http://localhost:8000/chat', { message: input, agent_id: selectedAgent });
      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Error in chat:', error);
      setMessages(prevMessages => [...prevMessages, { role: 'error', content: 'An error occurred. Please try again.' }]);
    }
  };

  return (
    <div className="chat">
      <h2>Chat</h2>
      <select
        value={selectedAgent || ''}
        onChange={(e) => setSelectedAgent(e.target.value)}
      >
        <option value="">Select an agent</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>{agent.name}</option>
        ))}
      </select>
      <div className="message-list">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <strong>{message.role === 'user' ? 'You:' : 'AI:'}</strong> {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;