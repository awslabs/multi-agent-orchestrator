export interface Agent {
  id?: string;
  name: string;
  description: string;
  type: string;
  model_id?: string;
  lambda_function_name?: string;
  chain_agents?: Array<{ agent_id: string; input: string }>;
  enable_web_search?: boolean;
  position?: { x: number; y: number };
}

export interface LambdaFunction {
  name: string;
  arn: string;
}

export interface ChainResult {
  agent: string;
  input: string;
  output: string;
}

export interface ChainAgentStep {
  agent_id: string;
  input: string;
}
