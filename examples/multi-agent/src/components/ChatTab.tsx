import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, VStack, HStack, Select, Input, Button, Text } from "@chakra-ui/react";
import { Agent, ChainResult } from '../types';
import ChainExecutionVisualizer from './ChainExecutionVisualizer';

interface ChatMessage {
  sender: string;
  content: string;
  isIntermediate?: boolean;
  agentName?: string;
}

const ChatTab: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chainResults, setChainResults] = useState<ChainResult[]>([]);

  useEffect(() => {
    fetchAgents();
    fetchKnowledgeBases();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchKnowledgeBases = async () => {
    try {
      const response = await axios.get('http://localhost:8000/knowledge-bases');
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inputMessage.trim()) {
      setChatMessages([...chatMessages, { sender: 'user', content: inputMessage }]);
      try {
        const response = await axios.post('http://localhost:8000/chat', {
          message: inputMessage,
          agent_id: selectedAgent,
          knowledge_base: selectedKnowledgeBase
        });
        if (Array.isArray(response.data.response)) {
          setChainResults(response.data.response);
          response.data.response.forEach((result: ChainResult, index: number) => {
            setChatMessages(prevMessages => [
              ...prevMessages,
              { 
                sender: 'assistant', 
                content: result.output, 
                isIntermediate: index < response.data.response.length - 1,
                agentName: result.agent
              }
            ]);
          });
        } else {
          setChatMessages(prevMessages => [...prevMessages, { sender: 'assistant', content: response.data.response }]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setChatMessages(prevMessages => [...prevMessages, { sender: 'error', content: 'An error occurred. Please try again.' }]);
      }
      setInputMessage('');
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <Select placeholder="Select an agent" value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>{agent.name}</option>
        ))}
      </Select>
      <Select placeholder="Select Knowledge Base (Optional)" value={selectedKnowledgeBase} onChange={(e) => setSelectedKnowledgeBase(e.target.value)}>
        {knowledgeBases.map(kb => (
          <option key={kb} value={kb}>{kb}</option>
        ))}
      </Select>
      <Box height="300px" overflowY="auto" borderWidth={1} borderRadius="md" p={2}>
        {chatMessages.map((msg, index) => (
          <Box key={index} mb={2} textAlign={msg.sender === 'user' ? 'right' : 'left'}>
            {msg.agentName && <Text fontSize="xs" color="gray.500">{msg.agentName}</Text>}
            <Text
              display="inline-block"
              bg={msg.sender === 'user' ? 'blue.100' : msg.isIntermediate ? 'gray.100' : 'green.100'}
              px={2}
              py={1}
              borderRadius="md"
            >
              {msg.content}
            </Text>
          </Box>
        ))}
      </Box>
      {chainResults.length > 0 && (
        <Box>
          <Text fontWeight="bold">Chain Execution Results:</Text>
          <ChainExecutionVisualizer results={chainResults} />
        </Box>
      )}
      <form onSubmit={handleSendMessage}>
        <HStack>
          <Input value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type your message" />
          <Button type="submit" colorScheme="blue">Send</Button>
        </HStack>
      </form>
    </VStack>
  );
};

export default ChatTab;