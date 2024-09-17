import React, { useState } from 'react';
import { ChakraProvider, Box, VStack, Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import ChatTab from './components/ChatTab';
import AgentsTab from './components/AgentsTab';
import ChainAgentsTab from './components/ChainAgentsTab';
import KnowledgeBaseTab from './components/KnowledgeBaseTab';

const App: React.FC = () => {
  return (
    <ChakraProvider>
      <Box p={5}>
        <VStack spacing={4} align="stretch">
          <Box bg="blue.500" color="white" p={4} borderRadius="md">
            <h1>Multi-Agent AI Orchestrator Demo</h1>
          </Box>
          <Tabs isFitted variant="enclosed">
            <TabList mb="1em">
              <Tab>Chat</Tab>
              <Tab>Agents</Tab>
              <Tab>Chain Agents</Tab>
              <Tab>Knowledge Base</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <ChatTab />
              </TabPanel>
              <TabPanel>
                <AgentsTab />
              </TabPanel>
              <TabPanel>
                <ChainAgentsTab />
              </TabPanel>
              <TabPanel>
                <KnowledgeBaseTab />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Box>
    </ChakraProvider>
  );
};

export default App;