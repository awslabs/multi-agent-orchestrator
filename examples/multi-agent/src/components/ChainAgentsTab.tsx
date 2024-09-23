// src/components/ChainAgentsTab.jsx
import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Node,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { Box, HStack, Input, Button, useToast, IconButton, Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/react";
import { Agent } from '../types';

interface AgentPositions {
  [key: string]: { x: number; y: number };
}

const ChainAgentsTab: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [chainAgentName, setChainAgentName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const toast = useToast();

  const fetchAgents = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      const filteredAgents = response.data.filter((agent: Agent) => agent.type !== 'ChainAgent');
      const newNodes = filteredAgents.map((agent: Agent, index: number) => ({
        id: agent.id!,
        data: { label: agent.name },
        position: agent.position || { x: 100 + (index * 150), y: 100 + (index * 50) },
        type: 'customNode',
      }));
      setNodes(newNodes);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error fetching agents",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast, setNodes]);

  useEffect(() => {
    fetchAgents();
    // document.body.style.overflow = 'hidden'; // Disable scrolling on the body when the component is mounted
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = 'auto'; // Re-enable scrolling when the component unmounts
    };
  }, [fetchAgents]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: { stroke: '#FF4500' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#FF4500',
        },
      }, eds));
    },
    [setEdges]
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: node.position } : n)));
    },
    [setNodes]
  );

  const handleDuplicateAgent = useCallback((nodeId: string) => {
    const nodeToDuplicate = nodes.find(node => node.id === nodeId);
    if (nodeToDuplicate) {
      const newNode: Node = {
        ...nodeToDuplicate,
        id: `${nodeToDuplicate.id}-copy-${Date.now()}`,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      // Add the duplicated agent to the backend
      const duplicateData = {
        id: nodeToDuplicate.id,  // Send the original ID for duplication
        name: `${nodeToDuplicate.data.label} (Copy)`,
        description: nodeToDuplicate.data.description || '',
        type: nodeToDuplicate.data.type || 'BedrockLLMAgent',  // Ensure this matches your backend expectation
        model_id: nodeToDuplicate.data.model_id,
        lambda_function_name: nodeToDuplicate.data.lambda_function_name,
      };
      
      console.log("Sending duplicate request with data:", duplicateData);  // Add this for debugging
      
      axios.post('http://localhost:8000/agents', duplicateData)
        .then((response) => {
          console.log("Duplication response:", response.data);  // Add this for debugging
          fetchAgents(); // Refresh the agents list
          toast({
            title: "Agent duplicated",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }).catch((error) => {
          console.error('Error duplicating agent:', error.response ? error.response.data : error);
          toast({
            title: "Error duplicating agent",
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        });
    }
    setContextMenu(null);
  }, [nodes, setNodes, toast, fetchAgents]);

  const handleDisconnectAgent = useCallback((nodeId: string) => {
    setEdges((eds) => eds.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    ));
    toast({
      title: "Agent disconnected",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    setContextMenu(null);
  }, [setEdges, toast]);

  const handleCreateChainAgent = async () => {
    if (!chainAgentName.trim()) {
      toast({
        title: "Please enter a name for the chain agent",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
  
    // Sort edges by source (to maintain order)
    const sortedEdges = [...edges].sort((a, b) => {
      return nodes.findIndex(n => n.id === a.source) - nodes.findIndex(n => n.id === b.source);
    });
  
    // Create chain_agents array based on the sorted edges
    const chainAgents = sortedEdges.map((edge, index) => ({
      agent_id: edge.source,
      input: index === 0 ? 'user_input' : 'previous_output'
    }));
  
    // Add the last node if it's not a source in any edge
    const lastNodeId = nodes[nodes.length - 1].id;
    if (!sortedEdges.some(edge => edge.source === lastNodeId)) {
      chainAgents.push({
        agent_id: lastNodeId,
        input: 'previous_output'
      });
    }
  
    const agentPositions: AgentPositions = nodes.reduce((acc, node) => {
      acc[node.id] = node.position;
      return acc;
    }, {} as AgentPositions);
  
    try {
      await axios.post('http://localhost:8000/chain-agents', {
        name: chainAgentName,
        description: `Chain agent connecting ${chainAgents.length} agents`,
        type: 'ChainAgent',
        chain_agents: chainAgents,
        agent_positions: agentPositions
      });
      setChainAgentName('');
      fetchAgents();
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
  };
  
  const CustomNode: React.FC<NodeProps> = ({ id, data }) => {
    const handleRemove = () => {
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    };

    return (
      <div
        style={{
          padding: '10px',
          border: '2px solid #ddd',
          borderRadius: '5px',
          background: 'white',
          position: 'relative',
        }}
      >
        <IconButton
          aria-label="Remove node"
          icon={<span>×</span>} 
          size="xs"
          position="absolute"
          top="-10px"
          right="-10px"
          onClick={handleRemove}
        />
        <Handle type="target" position={Position.Top} />
        <div>{data.label}</div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  };

  const nodeTypes = {
    customNode: CustomNode,
  };

  const handleContextMenu = (event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId,
    });
  };

  return (
    <Box height="calc(100vh - 100px)" position="relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        onNodeContextMenu={(event, node) => handleContextMenu(event, node.id)} 
      >
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
      <Box position="absolute" bottom={4} left={4} right={4}>
        <HStack>
          <Input
            value={chainAgentName}
            onChange={(e) => setChainAgentName(e.target.value)}
            placeholder="Chain Agent Name"
          />
          <Button
            onClick={handleCreateChainAgent}
            colorScheme="blue"
            isDisabled={edges.length === 0 || !chainAgentName.trim()}
          >
            Create Chain Agent
          </Button>
        </HStack>
      </Box>
      {contextMenu && (
        <Menu isOpen={true} onClose={() => setContextMenu(null)}>
          <MenuButton as={Box} position="fixed" top={contextMenu.y} left={contextMenu.x} />
          <MenuList>
            <MenuItem onClick={() => handleDuplicateAgent(contextMenu.nodeId!)}>Duplicate Agent</MenuItem>
            <MenuItem onClick={() => handleDisconnectAgent(contextMenu.nodeId!)}>Disconnect Agent</MenuItem>
          </MenuList>
        </Menu>
      )}
    </Box>
  );
};

export default ChainAgentsTab;
