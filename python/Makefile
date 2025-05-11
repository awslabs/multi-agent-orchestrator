# Commands
.PHONY: code-quality test

check_dirs := src/agent_squad

# Check code quality of the source code
code-quality:
	ruff check $(check_dirs)
#	ruff format --check $(check_dirs)

# Run agent-squad tests
test:
	pytest ./src/tests/
