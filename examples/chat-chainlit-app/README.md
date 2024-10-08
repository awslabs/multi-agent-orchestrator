To set up and run the application first install dependencies from `requirements.txt` file, follow these steps:

### Prerequisites

- Ensure you have Python installed on your system. It's recommended to use Python 3.7 or higher.
- Make sure you have `pip`, the Python package installer, available.
- Make sure you have [`ollama`](https://ollama.com/) installed and running the model specified in `ollamaAgent.py`

### Steps

1. **Clone the Repository (if necessary)**

   If you haven't already, clone the repository containing the application code to your local machine.

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Create a Virtual Environment (Optional but Recommended)**

   It's a good practice to use a virtual environment to manage dependencies for your project.

   ```bash
   python -m venv venv
   ```

   Activate the virtual environment:

   - On Windows:

     ```bash
     venv\Scripts\activate
     ```

   - On macOS and Linux:

     ```bash
     source venv/bin/activate
     ```

3. **Install Dependencies**

   Use the `requirements.txt` file to install the necessary Python packages.

   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**

   Use the `chainlit` command to run the application.

   ```bash
   chainlit run app.py -w
   ```

### Additional Information

- Ensure that any environment variables or configuration files needed by `multi_agent_orchestrator` or other components are properly set up.
- If you encounter any issues with package installations, ensure that your Python and pip versions are up to date.

By following these steps, you should be able to install the necessary dependencies and run the application successfully.

### Sample test questions
- What are some best places to visit in Seattle?
    - This should route to travel agent on Bedrock
- What are some cool tech companies in Seattle
    - This should route to tech agent on Bedrock
- What kind of pollen is causing allergies in Seattle?
    - This should health agent running local machine ollama
- (Ask a followup quesiton to the Travel agent by referring to some context in first response) 