import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AgentList from './components/AgentList';
import AgentEditor from './components/AgentEditor';
import Chat from './components/Chat';
import Examples from './components/Examples';
import { Agent, LambdaFunction } from './types';

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [lambdaFunctions, setLambdaFunctions] = useState<LambdaFunction[]>([]);

  useEffect(() => {
    fetchAgents();
    testBedrockConnection();
    fetchLambdaFunctions();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const testBedrockConnection = async () => {
    try {
      const response = await axios.get('http://localhost:8000/test-bedrock');
      setTestResponse(response.data.response);
    } catch (error) {
      console.error('Error testing Bedrock connection:', error);
      setTestResponse('Error connecting to Bedrock');
    }
  };

  const fetchLambdaFunctions = async () => {
    try {
      const response = await axios.get('http://localhost:8000/lambda-functions');
      setLambdaFunctions(response.data);
    } catch (error) {
      console.error('Error fetching Lambda functions:', error);
    }
  };

  const addAgent = async (agent: Agent) => {
    try {
      const response = await axios.post('http://localhost:8000/agents', agent);
      setAgents([...agents, response.data]);
    } catch (error) {
      console.error('Error adding agent:', error);
    }
  };

  const updateAgent = async (updatedAgent: Agent) => {
    try {
      await axios.put(`http://localhost:8000/agents/${updatedAgent.id}`, updatedAgent);
      const updatedAgents = agents.map(a => a.id === updatedAgent.id ? updatedAgent : a);
      setAgents(updatedAgents);
    } catch (error) {
      console.error('Error updating agent:', error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      await axios.delete(`http://localhost:8000/agents/${agentId}`);
      const updatedAgents = agents.filter(a => a.id !== agentId);
      setAgents(updatedAgents);
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Multi-Agent AI Orchestrator Demo</h1>
      </header>
      <main>
        <div className="test-response">
          <h2>Bedrock Test Response:</h2>
          {testResponse ? (
            <p>{testResponse}</p>
          ) : (
            <p>Testing Bedrock connection...</p>
          )}
        </div>
        <div className="agent-management">
          <AgentList 
            agents={agents} 
            onSelectAgent={setSelectedAgent}
            onDeleteAgent={deleteAgent}
          />
          <AgentEditor 
            agent={selectedAgent} 
            onSave={selectedAgent ? updateAgent : addAgent}
            lambdaFunctions={lambdaFunctions}
          />
        </div>
        <Examples />
        <Chat agents={agents} />
      </main>
    </div>
  );
};

export default App;