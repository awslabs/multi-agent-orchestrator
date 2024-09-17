import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, VStack, HStack, Select, Input, Button, Text } from "@chakra-ui/react";
import { Agent } from '../types';

const ChatTab: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: string; content: string }[]>([]);
  const [inputMessage, setInputMessage] = useState('');

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
        setChatMessages(prevMessages => [...prevMessages, { sender: 'assistant', content: response.data.response }]);
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
            <Text display="inline-block" bg={msg.sender === 'user' ? 'blue.100' : 'gray.100'} px={2} py={1} borderRadius="md">
              {msg.content}
            </Text>
          </Box>
        ))}
      </Box>
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