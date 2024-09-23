import React from 'react';
import { Box, VStack, Text } from "@chakra-ui/react";
import { ChainResult } from '../types';

interface ChainExecutionVisualizerProps {
  results: ChainResult[];
}

const ChainExecutionVisualizer: React.FC<ChainExecutionVisualizerProps> = ({ results }) => {
  return (
    <VStack spacing={4} align="stretch">
      {results.map((result, index) => (
        <Box key={index} borderWidth={1} borderRadius="md" p={4}>
          <Text fontWeight="bold">{result.agent}</Text>
          <Text color="gray.500">Input: {result.input}</Text>
          <Text mt={2}>Output: {result.output}</Text>
        </Box>
      ))}
    </VStack>
  );
};

export default ChainExecutionVisualizer;