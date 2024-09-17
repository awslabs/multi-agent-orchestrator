import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Box, VStack, HStack, Input, Textarea, Select, Checkbox, Button, useToast } from "@chakra-ui/react";
import { Agent, LambdaFunction } from '../types';

const AgentsTab: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [lambdaFunctions, setLambdaFunctions] = useState<LambdaFunction[]>([]);
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: '',
    description: '',
    type: 'BedrockLLMAgent',
    model_id: 'anthropic.claude-3-sonnet-20240229-v1:0',
    enable_web_search: false
  });
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const toast = useToast();

  const fetchAgents = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      setAgents(response.data.filter((agent: Agent) => agent.type !== 'ChainAgent'));
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error fetching agents",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  const fetchLambdaFunctions = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/lambda-functions');
      setLambdaFunctions(response.data);
    } catch (error) {
      console.error('Error fetching Lambda functions:', error);
      toast({
        title: "Error fetching Lambda functions",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchAgents();
    fetchLambdaFunctions();
  }, [fetchAgents, fetchLambdaFunctions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAgent(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNewAgent(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAgent) {
        await axios.put(`http://localhost:8000/agents/${editingAgent.id}`, newAgent);
      } else {
        await axios.post('http://localhost:8000/agents', newAgent);
      }
      fetchAgents();
      setNewAgent({
        name: '',
        description: '',
        type: 'BedrockLLMAgent',
        model_id: 'anthropic.claude-3-sonnet-20240229-v1:0',
        enable_web_search: false
      });
      setEditingAgent(null);
      toast({
        title: editingAgent ? "Agent updated successfully" : "Agent added successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({
        title: "Error saving agent",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setNewAgent(agent);
  };

  const handleDelete = async (agentId: string) => {
    try {
      await axios.delete(`http://localhost:8000/agents/${agentId}`);
      fetchAgents();
      toast({
        title: "Agent deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: "Error deleting agent",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <Box>
          <h2>Manage Agents</h2>
          {agents.map(agent => (
            <HStack key={agent.id} justifyContent="space-between" p={2} bg="gray.100" borderRadius="md">
              <Box>
                {agent.name} ({agent.type})
              </Box>
              <HStack>
                <Button size="sm" onClick={() => handleEdit(agent)} colorScheme="blue">Edit</Button>
                <Button size="sm" onClick={() => handleDelete(agent.id!)} colorScheme="red">Delete</Button>
              </HStack>
            </HStack>
          ))}
        </Box>
        <form onSubmit={handleSubmit}>
          <VStack spacing={4} align="stretch">
            <Input
              name="name"
              value={newAgent.name}
              onChange={handleInputChange}
              placeholder="Agent Name"
              required
            />
            <Textarea
              name="description"
              value={newAgent.description}
              onChange={handleInputChange}
              placeholder="Description"
              required
            />
            <Select
              name="type"
              value={newAgent.type}
              onChange={handleInputChange}
              required
            >
              <option value="BedrockLLMAgent">Bedrock LLM Agent</option>
              <option value="LambdaAgent">Lambda Agent</option>
            </Select>
            {(newAgent.type === 'BedrockLLMAgent' || newAgent.type === 'LambdaAgent') && (
              <Select
                name="model_id"
                value={newAgent.model_id}
                onChange={handleInputChange}
                required
              >
                <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
                <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
                <option value="anthropic.claude-v2">Claude v2</option>
              </Select>
            )}
            {newAgent.type === 'LambdaAgent' && (
              <Select
                name="lambda_function_name"
                value={newAgent.lambda_function_name}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Lambda Function</option>
                {lambdaFunctions.map(func => (
                  <option key={func.arn} value={func.name}>{func.name}</option>
                ))}
              </Select>
            )}
            <Checkbox
              name="enable_web_search"
              isChecked={newAgent.enable_web_search}
              onChange={handleCheckboxChange}
            >
              Enable Web Search
            </Checkbox>
            <Button type="submit" colorScheme="teal">
              {editingAgent ? 'Update Agent' : 'Add Agent'}
            </Button>
          </VStack>
        </form>
      </VStack>
    </Box>
  );
};

export default AgentsTab;