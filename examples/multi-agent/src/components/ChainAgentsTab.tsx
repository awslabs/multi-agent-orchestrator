import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Node, Edge, Controls, Background, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { Box, VStack, HStack, Input, Button, useToast } from "@chakra-ui/react";
import { Agent } from '../types';

const ChainAgentsTab: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const toast = useToast();

  const fetchAgents = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      const filteredAgents = response.data.filter((agent: Agent) => agent.type !== 'ChainAgent');
      setAgents(filteredAgents);
      setNodes(filteredAgents.map((agent: Agent, index: number) => ({
        id: agent.id!,
        data: { label: agent.name },
        position: { x: 100 + (index * 150), y: 100 + (index * 50) },
        style: { background: '#4FD1C5', color: 'white', border: '1px solid #2C7A7B', borderRadius: '5px' }
      })));
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

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAddAgent = async () => {
    if (newAgentName.trim()) {
      try {
        await axios.post('http://localhost:8000/agents', {
          name: newAgentName.trim(),
          description: `New agent: ${newAgentName.trim()}`,
          type: 'CustomAgent'
        });
        setNewAgentName('');
        fetchAgents();
        toast({
          title: "Agent added successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error adding new agent:', error);
        toast({
          title: "Error adding agent",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const onConnect = (params: Connection) => {
    if (params.source && params.target) {
      setSelectedAgents([params.source, params.target]);
      setEdges((eds) => [...eds, { ...params, animated: true, style: { stroke: '#FF4500' } } as Edge]);
    }
  };

  const handleCreateChainAgent = async () => {
    if (selectedAgents.length === 2) {
      try {
        const response = await axios.post('http://localhost:8000/chain-agents', {
          name: `Chain: ${agents.find(a => a.id === selectedAgents[0])?.name} -> ${agents.find(a => a.id === selectedAgents[1])?.name}`,
          description: `Chain agent connecting ${agents.find(a => a.id === selectedAgents[0])?.name} to ${agents.find(a => a.id === selectedAgents[1])?.name}`,
          type: 'ChainAgent',
          chain_agents: selectedAgents
        });
        fetchAgents();
        setSelectedAgents([]);
        setEdges([]);
        toast({
          title: "Chain agent created successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error creating chain agent:', error);
        toast({
          title: "Error creating chain agent",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <HStack>
        <Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="New Agent Name" />
        <Button onClick={handleAddAgent} colorScheme="teal">Add Agent</Button>
      </HStack>
      <Box height="500px" border="1px solid #ccc">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <Background color="#aaa" gap={16} />
        </ReactFlow>
      </Box>
      <Button onClick={handleCreateChainAgent} colorScheme="blue" isDisabled={selectedAgents.length !== 2}>
        Create Chain Agent
      </Button>
    </VStack>
  );
};

export default ChainAgentsTab;