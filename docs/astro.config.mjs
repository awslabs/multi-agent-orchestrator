import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: process.env.ASTRO_SITE,
	base: '/multi-agent-orchestrator',
	markdown: {
		gfm: true
  },
	integrations: [
		starlight({
			title: 'Multi-Agent Orchestrator',
			description: 'Flexible and powerful framework for managing multiple AI agents and handling complex conversations 🤖🚀',
			defaultLocale: 'en',
			favicon: '/src/assets/favicon.ico',
			customCss: [
				'./src/styles/landing.css',
				'./src/styles/font.css',
				'./src/styles/custom.css',
				'./src/styles/terminal.css'
			],
			social: {
				github: 'https://github.com/awslabs/multi-agent-orchestrator'
			},
			sidebar: [
				{
				  label: 'Introduction',
				  items: [
					{ label: 'Introduction', link: '/general/introduction' },
					{ label: 'How it works', link: '/general/how-it-works' },
					{ label: 'Quickstart', link: '/general/quickstart' },
					{ label: 'FAQ', link: '/general/faq' }
				  ]
				},
				{
					label: 'Orchestrator',
					items: [
					  { label: 'Overview', link: '/orchestrator/overview' },
					]
				},{
					label: 'Classifier',
					items: [
					  { label: 'Overview', link: '/classifiers/overview' },
					  {
						label: 'Built-in classifiers',
						items: [
						  { label: 'Bedrock Classifier', link: '/classifiers/built-in/bedrock-classifier'},
						  { label: 'Anthropic Classifier', link: '/classifiers/built-in/anthropic-classifier' },
						]
					  },
					  { label: 'Custom Classifier', link: '/classifiers/custom-classifier' },
					]
				},
				{
				  label: 'Agents',
				  items: [
					{ label: 'Overview', link: '/agents/overview' },
					{
					  label: 'Built-in Agents',
					  items: [
						{ label: 'Bedrock LLM Agent', link: '/agents/built-in/bedrock-llm-agent'},
						{ label: 'Amazon Bedrock Agent', link: '/agents/built-in/amazon-bedrock-agent' },
						{ label: 'Amazon Lex Bot Agent', link: '/agents/built-in/lex-bot-agent' },
						{ label: 'AWS Lambda Agent', link: '/agents/built-in/lambda-agent' },
						{ label: 'OpenAI Agent', link: '/agents/built-in/openai-agent' }
					  ]
					},
					{ label: 'Custom Agents', link: '/agents/custom-agents' }
				  ]
				},
				{
				  label: 'Conversation Storage',
				  items: [
					{ label: 'Overview', link: '/storage/overview' },
					{
						label: 'Built-in storage',
						items: [
							{ label: 'In-Memory', link: '/storage/in-memory' },
							{ label: 'DynamoDB', link: '/storage/dynamodb' },
						]
					},
					{ label: 'Custom Storage', link: '/storage/custom' }
				  ]
				},
				{
					label: 'Retrievers',
					items: [
					  { label: 'Overview', link: '/retrievers/overview' },
					  {
						label: 'Built-in retrievers',
						items: [
							{ label: 'Bedrock Knowledge Base', link: '/retrievers/built-in/bedrock-kb-retriever' },
						]
					},					  
					  { label: 'Custom Retriever', link: '/retrievers/custom-retriever' },
					]
				},
				{
				  label: 'Advanced Features',
				  items: [
					{ label: 'Agent Overlap Analysis', link: '/advanced-features/agent-overlap' },
					{ label: 'Create a Weather Agent using Tools', link: '/advanced-features/weather-tool-use' },
					{ label: 'Create a Math Agent using Tools', link: '/advanced-features/math-tool-use' },
					{ label: 'Logging', link: '/advanced-features/logging' },
				  ]
				},
				{
					label: 'Deployment',
					items: [
					  { label: 'Local Development', link: '/deployment/local' },
					  { label: 'AWS Lambda Integration', link: '/deployment/aws-lambda' },
					  { label: 'Demo Web App', link: '/deployment/demo-web-app' },
					]
				  },
				  {
					  label: 'Use cases',
					  items: [
						{ label: 'Use case examples', link: '/use-cases/use-cases' },
					  ]
				  },
			  ]
		})
	]
});
