.PHONY: venv install install-dev test clean

# Default Python interpreter
PYTHON = python3

# Virtual environment directory
VENV = .venv

# Activate virtual environment
ACTIVATE = . \$(VENV)/bin/activate

# Create virtual environment
venv:
	\$(PYTHON) -m venv \$(VENV)
	\$(ACTIVATE)

# Install base dependencies
install:
	\$(ACTIVATE) && \
	pip install --upgrade pip && \
	pip install -e .

# Install development dependencies
install-dev:
	\$(ACTIVATE) && \
	pip install --upgrade pip && \
	pip install -e .[dev,test]

# Install specific extras
install-aws:
	\$(ACTIVATE) && \
	pip install -e .[aws]

install-anthropic:
	\$(ACTIVATE) && \
	pip install -e .[anthropic]

install-openai:
	\$(ACTIVATE) && \
	pip install -e .[openai]

install-all:
	\$(ACTIVATE) && \
	pip install -e .[all]

# Run tests
test:
	\$(ACTIVATE) && \
	pytest

# Clean virtual environment and cache files
clean:
	rm -rf \$(VENV)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
