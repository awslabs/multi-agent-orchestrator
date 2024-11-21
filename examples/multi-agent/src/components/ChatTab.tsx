import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, VStack, HStack, Select, Input, Button, Text } from "@chakra-ui/react";
import { Agent, ChainResult } from '../types';
import ChainExecutionVisualizer from './ChainExecutionVisualizer';

interface ChatMessage {
  sender: string;
  content: string | { text: string };
  isIntermediate?: boolean;
  agentName?: string;
}

const ChatTab: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chainAgents, setChainAgents] = useState<Agent[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chainResults, setChainResults] = useState<ChainResult[]>([]);

  useEffect(() => {
    fetchAgents();
    fetchChainAgents();
    fetchKnowledgeBases();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('http://localhost:8000/agents');
      setAgents(response.data.filter((agent: Agent) => agent.type !== 'ChainAgent'));
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchChainAgents = async () => {
    try {
      const response = await axios.get('http://localhost:8000/chain-agents');
      setChainAgents(response.data);
    } catch (error) {
      console.error('Error fetching chain agents:', error);
    }
  };

  const fetchKnowledgeBases = async () => {
    try {
      const response = await axios.get('http://localhost:8000/knowledge-bases');
      setKnowledgeBases(response.data.map((kb: any) => kb.name));
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
    }
  };

  const formatContent = (content: any): string => {
    if (typeof content === 'string') {
      try {
        const parsedContent = JSON.parse(content);
        if (parsedContent.content && Array.isArray(parsedContent.content)) {
          return parsedContent.content[0].text;
        }
      } catch (e) {
        // If parsing fails, it's not JSON, so we return the original content
      }
      return content;
    }
    if (typeof content === 'object' && content !== null) {
      if (content.content && Array.isArray(content.content)) {
        return content.content[0].text;
      }
      if (content.text) {
        return content.text;
      }
      return JSON.stringify(content);
    }
    return String(content);
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inputMessage.trim()) {
      setChatMessages([...chatMessages, { sender: 'user', content: inputMessage }]);
      try {
        const endpoint = selectedAgent.includes('chain') ? '/chain-chat' : '/chat';
        const response = await axios.post(`http://localhost:8000${endpoint}`, {
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
                content: formatContent(result.output), 
                isIntermediate: index < response.data.response.length - 1,
                agentName: result.agent
              }
            ]);
          });
        } else {
          setChatMessages(prevMessages => [...prevMessages, { 
            sender: 'assistant', 
            content: formatContent(response.data.response)
          }]);
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
      <Select placeholder="Select an agent or chain" value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
        <optgroup label="Agents">
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>{agent.name} ({agent.type})</option>
          ))}
        </optgroup>
        <optgroup label="Chain Agents">
          {chainAgents.map(agent => (
            <option key={agent.id} value={agent.id}>{agent.name} (ChainAgent)</option>
          ))}
        </optgroup>
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
              whiteSpace="pre-wrap"
            >
              {formatContent(msg.content)}
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
