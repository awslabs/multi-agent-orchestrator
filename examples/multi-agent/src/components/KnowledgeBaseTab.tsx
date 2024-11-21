import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  Text,
  List,
  ListItem,
  useToast,
  Heading,
} from "@chakra-ui/react";

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  files: string[];
}

const KnowledgeBaseTab: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState('');
  const [newKnowledgeBaseDescription, setNewKnowledgeBaseDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
    try {
      const response = await axios.get('http://localhost:8000/knowledge-bases');
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      toast({
        title: "Error fetching knowledge bases",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddKnowledgeBase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newKnowledgeBaseName.trim()) {
      try {
        await axios.post('http://localhost:8000/knowledge-bases', {
          name: newKnowledgeBaseName.trim(),
          description: newKnowledgeBaseDescription.trim(),
        });
        setNewKnowledgeBaseName('');
        setNewKnowledgeBaseDescription('');
        fetchKnowledgeBases();
        toast({
          title: "Knowledge base added successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error adding knowledge base:', error);
        toast({
          title: "Error adding knowledge base",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const handleDeleteKnowledgeBase = async (id: string) => {
    try {
      await axios.delete(`http://localhost:8000/knowledge-bases/${id}`);
      fetchKnowledgeBases();
      toast({
        title: "Knowledge base deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      toast({
        title: "Error deleting knowledge base",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (selectedFile && selectedKnowledgeBase) {
      const formData = new FormData();
      formData.append('file', selectedFile);
      try {
        await axios.post(`http://localhost:8000/knowledge-bases/${selectedKnowledgeBase}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        setSelectedFile(null);
        fetchKnowledgeBases();
        toast({
          title: "File uploaded successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Error uploading file",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading as="h2" size="lg" mb={4}>Knowledge Bases</Heading>
          <List spacing={3}>
            {knowledgeBases.map(kb => (
              <ListItem key={kb.id} p={4} shadow="md" borderWidth="1px" borderRadius="md">
                <Text fontWeight="bold">{kb.name}</Text>
                <Text>{kb.description}</Text>
                <Text>Files: {kb.files.join(', ')}</Text>
                <Button onClick={() => handleDeleteKnowledgeBase(kb.id)} size="sm" colorScheme="red" mt={2}>
                  Delete
                </Button>
              </ListItem>
            ))}
          </List>
        </Box>
        <Box as="form" onSubmit={handleAddKnowledgeBase}>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Name</FormLabel>
              <Input
                value={newKnowledgeBaseName}
                onChange={(e) => setNewKnowledgeBaseName(e.target.value)}
                placeholder="Knowledge Base Name"
                required
              />
            </FormControl>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={newKnowledgeBaseDescription}
                onChange={(e) => setNewKnowledgeBaseDescription(e.target.value)}
                placeholder="Description"
              />
            </FormControl>
            <Button type="submit" colorScheme="blue" width="full">Add Knowledge Base</Button>
          </VStack>
        </Box>
        <Box>
          <FormControl>
            <FormLabel>Select Knowledge Base</FormLabel>
            <select
              value={selectedKnowledgeBase || ''}
              onChange={(e) => setSelectedKnowledgeBase(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', borderColor: '#E2E8F0' }}
            >
              <option value="">Select a Knowledge Base</option>
              {knowledgeBases.map(kb => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          </FormControl>
          <FormControl mt={4}>
            <FormLabel>Upload File</FormLabel>
            <Input type="file" onChange={handleFileChange} />
          </FormControl>
          <Button
            onClick={handleFileUpload}
            disabled={!selectedFile || !selectedKnowledgeBase}
            colorScheme="green"
            mt={4}
            width="full"
          >
            Upload File
          </Button>
        </Box>
      </VStack>
    </Box>
  );
};

export default KnowledgeBaseTab;
