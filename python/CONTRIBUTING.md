# Contributing to Multi-Agent Orchestrator Python version

## Python Development Setup

### Python Version
This project supports Python 3.11 or higher. 

#### Installation Options:
- Windows: [Python Official Website](https://www.python.org/downloads/windows/)
- macOS: 
  - [Python Official Website](https://www.python.org/downloads/macos/)
  - Homebrew: `brew install python@3.11`
- Linux (Ubuntu/Debian): 
  ```bash
  sudo add-apt-repository ppa:deadsnakes/ppa
  sudo apt update
  sudo apt install python3.11 python3.11-venv python3.11-dev
  ```

### Development Environment Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/REPOSITORY_NAME.git
cd REPOSITORY_NAME
```

#### 2. Create Virtual Environment
```bash
python3.11 -m venv .venv
```

#### 3. Activate Virtual Environment

##### Windows (PowerShell)
```powershell
.venv\Scripts\activate
```

##### Windows (CMD)
```cmd
.venv\Scripts\activate.bat
```

##### macOS/Linux
```bash
source .venv/bin/activate
```

#### 4. Install Dependencies
```bash
pip install --upgrade pip
pip install -r test_requirements.txt
```

### Development Workflows

Before submitting a Pull Request (PR), please ensure your code complies with our formatting and linting standards, and that all tests pass successfully.

#### Code format and linter

To check and format your code according to our standards, run:

```bash
# Linux/macOS
make code-quality

# Windows
ruff check src/multi_agent_orchestrator
ruff format --check src/multi_agent_orchestrator
```

#### Running Tests

To execute the test suite and verify all tests pass:

```bash
# Linux/macOS
make test

# Windows
python -m pytest src/tests/
```

#### Running Specific Tests
```bash
# Run tests for a specific module
python -m pytest src/tests/test_specific_module.py

# Run tests with specific markers
python -m pytest -m asyncio
```

### Managing Dependencies

#### Adding New Dependencies

Before adding additional dependencies make sure this is aligned with maintainers.

- Update `setup.cfg` if you need to add additional dependencies

### Troubleshooting

#### Virtual Environment Issues
- Ensure you're using Python 3.11
- Completely remove and recreate `.venv` if needed
```bash
rm -rf .venv
python3.11 -m venv .venv
```

#### Dependency Conflicts
- Use `pip-compile` for dependency resolution
```bash
pip install pip-tools
pip-compile requirements.in
pip-sync
```
