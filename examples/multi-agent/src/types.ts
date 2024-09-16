export interface Agent {
  id?: string;
  name: string;
  description: string;
  type: string;
  model_id?: string;
  lambda_function_name?: string;
  chain_agents?: string[];
  enable_web_search?: boolean;
}

export interface LambdaFunction {
  name: string;
  arn: string;
}