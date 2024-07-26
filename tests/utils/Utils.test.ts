import { AgentOverlapAnalyzer } from '../../src/agentOverlapAnalyzer';
import { Logger } from '../../src/utils/logger';

// Mock the Logger
jest.mock('../../src/utils/logger', () => ({
  Logger: {
    logger: {
      info: jest.fn(),
    },
  },
}));

describe('AgentOverlapAnalyzer', () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should handle less than two agents', () => {
    const analyzer = new AgentOverlapAnalyzer({
      agent1: { name: 'Agent 1', description: 'Description 1' },
    });

    analyzer.analyzeOverlap();

    expect(Logger.logger.info).toHaveBeenCalledWith('Agent Overlap Analysis requires at least two agents.');
    expect(Logger.logger.info).toHaveBeenCalledWith('Current number of agents: 1');
    expect(Logger.logger.info).toHaveBeenCalledWith('\nSingle Agent Information:');
    expect(Logger.logger.info).toHaveBeenCalledWith('Agent Name: agent1');
    expect(Logger.logger.info).toHaveBeenCalledWith('Description: Description 1');
  });

  it('should analyze overlap for two agents', () => {
    const analyzer = new AgentOverlapAnalyzer({
      agent1: { name: 'Agent 1', description: 'This is a unique description for agent 1' },
      agent2: { name: 'Agent 2', description: 'This is a different description for agent 2' },
    });

    analyzer.analyzeOverlap();

    expect(Logger.logger.info).toHaveBeenCalledWith('Pairwise Overlap Results:');
    expect(Logger.logger.info).toHaveBeenCalledWith('_________________________\n');
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent1 - agent2:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Overlap Percentage -'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Potential Conflict -'));

    expect(Logger.logger.info).toHaveBeenCalledWith('Uniqueness Scores:');
    expect(Logger.logger.info).toHaveBeenCalledWith('_________________\n');
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Agent: agent1, Uniqueness Score:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Agent: agent2, Uniqueness Score:'));
  });

  it('should analyze overlap for multiple agents with varying similarities', () => {
    const analyzer = new AgentOverlapAnalyzer({
      agent1: { name: 'Agent 1', description: 'This is a unique description for agent 1' },
      agent2: { name: 'Agent 2', description: 'This is a similar description for agent 2' },
      agent3: { name: 'Agent 3', description: 'This is a completely different description' },
    });

    analyzer.analyzeOverlap();

    expect(Logger.logger.info).toHaveBeenCalledWith('Pairwise Overlap Results:');
    expect(Logger.logger.info).toHaveBeenCalledWith('_________________________\n');
    expect(Logger.logger.info).toHaveBeenCalledTimes(11); 

    // Check for all pairwise comparisons
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent1 - agent2:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent1 - agent3:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent2 - agent3:'));

    // Check for uniqueness scores
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Agent: agent1, Uniqueness Score:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Agent: agent2, Uniqueness Score:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Agent: agent3, Uniqueness Score:'));
  });

  it('should handle agents with identical descriptions', () => {
    const analyzer = new AgentOverlapAnalyzer({
      agent1: { name: 'Agent 1', description: 'This is the same description' },
      agent2: { name: 'Agent 2', description: 'This is the same description' },
    });

    analyzer.analyzeOverlap();

    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent1 - agent2:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Overlap Percentage - 100.00%'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Potential Conflict - High'));
  });

  it('should handle agents with completely different descriptions', () => {
    const analyzer = new AgentOverlapAnalyzer({
      agent1: { name: 'Agent 1', description: 'This is a unique description for agent 1' },
      agent2: { name: 'Agent 2', description: 'Completely different words for the second agent' },
    });

    analyzer.analyzeOverlap();

    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('agent1 - agent2:'));
    expect(Logger.logger.info).toHaveBeenCalledWith(expect.stringContaining('Potential Conflict - Low'));
  });
});