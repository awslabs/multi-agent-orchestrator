# Commands
.PHONY: code-quality test

check_dirs := src/multi_agent_orchestrator

# Check code quality of the source code
code-quality:
	ruff check $(check_dirs)
#	ruff format --check $(check_dirs)
	
# Run multi-agent-orchestrator tests
test:
	pytest ./src/tests/
