# python/src/tests/integration/classifier/test_classifier_integration.py

import json
import yaml
import pytest
from pathlib import Path
from typing import List, Dict
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator
from multi_agent_orchestrator.agents import BedrockLLMAgent, BedrockLLMAgentOptions
from multi_agent_orchestrator.classifiers import BedrockClassifier, BedrockClassifierOptions


class ClassifierTestRunner:
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.orchestrator = None
        self.config = self.load_all_configs()

    def load_all_configs(self) -> Dict:
        """Load all configuration files"""
        config = {
            "orchestrator": self.load_json_file("orchestrator_config.json"),
            "agents": self.load_json_file("agents.json"),
            "test_cases": self.load_json_file("user_input.json")
        }
        return config

    def load_json_file(self, filename: str) -> Dict:
        """Load and parse a JSON configuration file"""
        file_path = self.config_dir / filename
        print(f"Loading configuration file: {file_path}")
        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")
        
        with open(file_path) as f:
            return json.load(f)

    def setup_orchestrator(self):
        """Configure orchestrator with specified classifier"""

        
        # Configure classifier based on orchestrator_config.json
        classifier_config = self.config["orchestrator"].get("classifier", None)
        classifier = None

        if classifier_config and classifier_config["type"] == "bedrock":
            classifier = BedrockClassifier(BedrockClassifierOptions(
                model_id=classifier_config["model_id"],
                inference_config=classifier_config.get("parameters", {})
            ))
        else:
            raise ValueError(f"Unsupported classifier type: {classifier_config['type']}")
        
        self.orchestrator = MultiAgentOrchestrator(classifier=classifier)

    def setup_agents(self):
        """Configure orchestrator with agents from config"""
        for agent_config in self.config["agents"]["agents"]:
            agent = BedrockLLMAgent(BedrockLLMAgentOptions(
                name=agent_config["name"],
                description=agent_config["description"],
                model_id=agent_config["model_id"]
            ))
            self.orchestrator.add_agent(agent)

    def dump_config(self, format: str = 'yaml') -> str:
        """Dump current configuration state"""
        if not self.orchestrator:
            raise RuntimeError("Orchestrator is not configured")
        
        config_dump = {
            "orchestrator_config": {
                "classifier": {
                    "type": self.config["orchestrator"]["classifier"]["type"],
                    "model_id": self.config["orchestrator"]["classifier"]["model_id"],
                    "parameters": self.config["orchestrator"]["classifier"].get("parameters", {})
                }
            },
            "agents": [
                {
                    "name": agent.get("name"),
                    "description": agent.get("description"),
                    "model_id": agent.get("model_id")
                }
                for agent in self.config["agents"]["agents"]
            ],
            "test_cases": self.config["test_cases"]["cases"]
        }
        
        if format == 'json':
            return json.dumps(config_dump, indent=2)
        else:  # yaml
            return yaml.dump(config_dump, default_flow_style=False)

    def evaluate_result(self, response, test_case: Dict) -> Dict:
        """Evaluate if the test case passed based on routing and optional confidence"""
        # Check if confidence threshold is specified
        min_confidence = float(test_case.get("min_confidence", 0.00))

        if response.selected_agent is None:
            return {
                "passed": False,
                "routed_to": "no agent",
                "confidence": 0.0,
                "failure_reason": "No agent selected",
                "confidence_threshold": min_confidence if min_confidence else None
            }

        correct_routing = response.selected_agent.name == test_case["expected"]
        
        # Convert confidence to enum
        confidence = float(response.confidence)
        
        meets_confidence = (confidence > min_confidence)
        
        passed = correct_routing and meets_confidence
        # passed = correct_routing
        
        failure_reason = None
        if not passed:
            if not correct_routing:
                failure_reason = f"Misrouted to {response.selected_agent.name}"
            elif not meets_confidence:
                failure_reason = f"Confidence {confidence} below threshold {min_confidence}"
        
        return {
            "passed": passed,
            "routed_to": response.selected_agent.name,
            "confidence": confidence,
            "confidence_threshold": min_confidence if min_confidence else None,
            "failure_reason": failure_reason
        }

    async def run_test_case(self, test_case: Dict, session_id: str) -> List[Dict]:
        """Run a single test case and return results"""
        results = []
        
        for message in test_case["input"]:
            print(f"Running test case: {message}")
            response = await self.orchestrator.classify_request(
                message,
                "test_user",
                session_id
            )
            
            evaluation = self.evaluate_result(response, test_case)
            results.append({
                "input": message,
                "expected": test_case["expected"],
                **evaluation
            })
            
        return results

    async def run_all_tests(self) -> List[Dict]:
        """Run all test cases"""
        self.setup_orchestrator()
        self.setup_agents()

        # Dump current configuration (optional)
        print("\nCurrent Configuration:")
        print(self.dump_config())
        
        all_results = []
        for i, test_case in enumerate(self.config["test_cases"]["cases"]):
            session_id = f"test_session_{i}"
            results = await self.run_test_case(test_case, session_id)
            all_results.extend(results)
            
        return all_results

def generate_report(results: List[Dict]) -> str:
    """Generate a readable test report"""
    report = []
    passed = 0
    total = len(results)
    
    report.append("\nClassifier Integration Test Results")
    report.append("=" * 40)
    
    # Group results by test session
    current_input = None
    test_counter = 0
    
    for result in results:
        # Start new test section if this is a new input sequence
        if current_input != result["input"]:
            test_counter += 1
            current_input = result["input"]
            report.append(f"\nTest {test_counter}:")
        
        status = "✅ PASSED" if result["passed"] else "❌ FAILED"
        
        # Basic test information
        report.append(f"Input: {result['input']}")
        report.append(f"Expected Agent: {result['expected']}")
        report.append(f"Routed To: {result['routed_to']}")
        
        # Confidence information
        confidence_info = f"Confidence: {result['confidence']}"
        if result["confidence_threshold"] is not None:
            confidence_info += f" (Threshold: {result['confidence_threshold']})"
        report.append(confidence_info)
        
        # Status and failure reason
        report.append(f"Status: {status}")
        if not result["passed"] and result["failure_reason"]:
            report.append(f"Failure Reason: {result['failure_reason']}")
        
        report.append("-" * 20)  # Separator between results
        
        if result["passed"]:
            passed += 1
    
    # Summary section
    report.append("\n" + "=" * 40)
    report.append("Summary:")
    report.append(f"Tests Passed: {passed}/{total}")
    report.append(f"Success Rate: {(passed/total)*100:.1f}%")
    
    return "\n".join(report)


@pytest.mark.asyncio
async def test_classifier_integration():
    """Main test function"""
    base_path = Path("python/src/tests/integration/classifier")
    runner = ClassifierTestRunner(base_path)
    
    results = await runner.run_all_tests()
    report = generate_report(results)
    print(report)
    
    # Assert all tests passed
    assert all(r["passed"] for r in results), "Some classification tests failed"
