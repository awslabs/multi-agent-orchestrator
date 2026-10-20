import { AnthropicAgent } from '../../src/agents/anthropicAgent';
import { BedrockLLMAgent } from '../../src/agents/bedrockLLMAgent';
import { ConversationMessage, ParticipantRole } from '../../src/types';

const additionalParams = { tenantId: 'tenant-1' };

const anthropicToolUseResponse = {
  content: [{ type: 'tool_use', id: 'tool-1', name: 'lookup', input: {} }],
  stop_reason: 'tool_use',
};
const anthropicFinalResponse = {
  content: [{ type: 'text', text: 'done' }],
  stop_reason: 'end_turn',
};

const bedrockToolUseResponse: ConversationMessage = {
  role: ParticipantRole.ASSISTANT,
  content: [{ toolUse: { toolUseId: 'tool-1', name: 'lookup', input: {} } }],
};
const bedrockFinalResponse: ConversationMessage = {
  role: ParticipantRole.ASSISTANT,
  content: [{ text: 'done' }],
};

const toolResultMessage: ConversationMessage = {
  role: ParticipantRole.USER,
  content: [{ text: 'tool result' }],
};

async function drain(stream: AsyncIterable<any>) {
  for await (const _chunk of stream) {
    // consume
  }
}

describe('useToolHandler receives additionalParams', () => {
  describe('AnthropicAgent', () => {
    it('passes additionalParams to the tool handler (non-streaming)', async () => {
      const useToolHandler = jest.fn().mockResolvedValue(toolResultMessage);
      const create = jest
        .fn()
        .mockResolvedValueOnce(anthropicToolUseResponse)
        .mockResolvedValueOnce(anthropicFinalResponse);

      const agent = new AnthropicAgent({
        name: 'Test Agent',
        description: 'test',
        client: { messages: { create } } as any,
        toolConfig: { tool: [], useToolHandler },
      });

      await agent.processRequest('hi', 'user', 'session', [], additionalParams);

      expect(useToolHandler).toHaveBeenCalledTimes(1);
      expect(useToolHandler.mock.calls[0][2]).toEqual(additionalParams);
    });

    it('passes additionalParams to the tool handler (streaming)', async () => {
      const useToolHandler = jest.fn().mockResolvedValue(toolResultMessage);
      const toolUseEvents = [
        {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: 'tool-1', name: 'lookup', input: {} },
        },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
        { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
      ];
      const finalEvents = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'done' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      ];
      const stream = jest
        .fn()
        .mockResolvedValueOnce(toolUseEvents)
        .mockResolvedValueOnce(finalEvents);

      const agent = new AnthropicAgent({
        name: 'Test Agent',
        description: 'test',
        streaming: true,
        client: { messages: { stream } } as any,
        toolConfig: { tool: [], useToolHandler },
      });

      const response = await agent.processRequest('hi', 'user', 'session', [], additionalParams);
      await drain(response as AsyncIterable<any>);

      expect(useToolHandler).toHaveBeenCalledTimes(1);
      expect(useToolHandler.mock.calls[0][2]).toEqual(additionalParams);
    });
  });

  describe('BedrockLLMAgent', () => {
    it('passes additionalParams to the tool handler (non-streaming)', async () => {
      const useToolHandler = jest.fn().mockResolvedValue(toolResultMessage);
      const send = jest
        .fn()
        .mockResolvedValueOnce({ output: { message: bedrockToolUseResponse } })
        .mockResolvedValueOnce({ output: { message: bedrockFinalResponse } });

      const agent = new BedrockLLMAgent({
        name: 'Test Agent',
        description: 'test',
        client: { send } as any,
        toolConfig: { tool: [], useToolHandler },
      });

      await agent.processRequest('hi', 'user', 'session', [], additionalParams);

      expect(useToolHandler).toHaveBeenCalledTimes(1);
      expect(useToolHandler.mock.calls[0][2]).toEqual(additionalParams);
    });

    it('passes additionalParams to the tool handler (streaming)', async () => {
      const useToolHandler = jest.fn().mockResolvedValue(toolResultMessage);
      const toolUseChunks = [
        { contentBlockStart: { start: { toolUse: { toolUseId: 'tool-1', name: 'lookup' } } } },
        { contentBlockDelta: { delta: { toolUse: { input: '{}' } } } },
        { messageStop: { stopReason: 'tool_use' } },
      ];
      const finalChunks = [
        { contentBlockDelta: { delta: { text: 'done' } } },
        { messageStop: { stopReason: 'end_turn' } },
      ];
      const send = jest
        .fn()
        .mockResolvedValueOnce({ stream: toolUseChunks })
        .mockResolvedValueOnce({ stream: finalChunks });

      const agent = new BedrockLLMAgent({
        name: 'Test Agent',
        description: 'test',
        streaming: true,
        client: { send } as any,
        toolConfig: { tool: [], useToolHandler },
      });

      const response = await agent.processRequest('hi', 'user', 'session', [], additionalParams);
      await drain(response as AsyncIterable<any>);

      expect(useToolHandler).toHaveBeenCalledTimes(1);
      expect(useToolHandler.mock.calls[0][2]).toEqual(additionalParams);
    });
  });
});
