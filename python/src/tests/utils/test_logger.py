import pytest
import logging
from typing import Dict, Any
from multi_agent_orchestrator.types import ConversationMessage, OrchestratorConfig
from multi_agent_orchestrator.utils import Logger

@pytest.fixture
def logger_instance():
    return Logger()

@pytest.fixture
def mock_logger(mocker):
    return mocker.Mock(spec=logging.Logger)

def test_logger_initialization():
    logger = Logger()
    assert isinstance(logger.config, OrchestratorConfig)
    assert isinstance(logger._logger, logging.Logger)

def test_logger_initialization_with_custom_config():
    custom_config = OrchestratorConfig(**{'LOG_AGENT_CHAT': True, 'LOG_CLASSIFIER_CHAT': False})
    logger = Logger(config=custom_config)
    assert logger.config == custom_config

def test_set_logger(mock_logger):
    Logger.set_logger(mock_logger)
    assert Logger._logger == mock_logger

@pytest.mark.parametrize("log_method", ["info", "info", "error", "debug"])
def test_log_methods(mock_logger, log_method):
    Logger.set_logger(mock_logger)
    log_func = getattr(Logger, log_method)
    log_func("Test message")
    getattr(mock_logger, log_method).assert_called_once_with("Test message")

def test_log_header(mock_logger):
    Logger.set_logger(mock_logger)
    Logger.log_header("Test Header")
    mock_logger.info.assert_any_call("\n** TEST HEADER **")
    mock_logger.info.assert_any_call("=================")

def test_print_chat_history_agent(logger_instance, mock_logger, mocker):
    logger_instance.config = OrchestratorConfig(**{'LOG_AGENT_CHAT': True})
    Logger.set_logger(mock_logger)
    chat_history = [
        ConversationMessage(role="user", content="Hello"),
        ConversationMessage(role="assistant", content="Hi there")
    ]
    logger_instance.print_chat_history(chat_history, agent_id="agent1")
    assert mock_logger.info.call_count >= 4  # Header + 2 messages + empty line

def test_not_print_chat_history_agent(logger_instance, mock_logger, mocker):
    logger_instance.config = OrchestratorConfig(**{'LOG_AGENT_CHAT': False})
    Logger.set_logger(mock_logger)
    chat_history = [
        ConversationMessage(role="user", content="Hello"),
        ConversationMessage(role="assistant", content="Hi there")
    ]
    logger_instance.print_chat_history(chat_history, agent_id="agent1")
    assert mock_logger.info.call_count == 0

def test_print_chat_history_classifier(logger_instance, mock_logger, mocker):
    logger_instance.config = OrchestratorConfig(**{'LOG_CLASSIFIER_CHAT': True})
    Logger.set_logger(mock_logger)
    chat_history = [
        ConversationMessage(role="user", content="Classify this"),
        ConversationMessage(role="assistant", content="Classification result")
    ]
    logger_instance.print_chat_history(chat_history)
    assert mock_logger.info.call_count >= 4  # Header + 2 messages + empty line

def test_not_print_chat_history_classifier(logger_instance, mock_logger, mocker):
    logger_instance.config = OrchestratorConfig(**{'LOG_CLASSIFIER_CHAT': False})
    Logger.set_logger(mock_logger)
    chat_history = [
        ConversationMessage(role="user", content="Classify this"),
        ConversationMessage(role="assistant", content="Classification result")
    ]
    logger_instance.print_chat_history(chat_history)
    assert mock_logger.info.call_count == 0

def test_log_classifier_output(logger_instance, mock_logger):
    logger_instance.config = OrchestratorConfig(**{'LOG_CLASSIFIER_OUTPUT': True})
    Logger.set_logger(mock_logger)
    output = {"result": "test"}
    logger_instance.log_classifier_output(output)
    assert mock_logger.info.call_count >= 3  # Header + output + empty line


def test_not_log_classifier_output(logger_instance, mock_logger):
    logger_instance.config = OrchestratorConfig(**{'LOG_CLASSIFIER_OUTPUT': False})
    Logger.set_logger(mock_logger)
    output = {"result": "test"}
    logger_instance.log_classifier_output(output)
    assert mock_logger.info.call_count == 0

def test_print_execution_times(logger_instance, mock_logger):
    logger_instance.config = OrchestratorConfig(**{'LOG_EXECUTION_TIMES': True})
    Logger.set_logger(mock_logger)
    execution_times = {"task1": 100.0, "task2": 200.0}
    logger_instance.print_execution_times(execution_times)
    assert mock_logger.info.call_count >= 4  # Header + 2 tasks + empty line

def test_log_methods_with_args(mock_logger):
    Logger.set_logger(mock_logger)
    Logger.info("Test %s", "message")
    mock_logger.info.assert_called_once_with("Test %s", "message")

def test_print_chat_history_empty(logger_instance, mock_logger):
    logger_instance.config.LOG_AGENT_CHAT=True
    mock_logger.config = logger_instance.config
    Logger.set_logger(mock_logger)
    logger_instance.print_chat_history([], agent_id="agent1")
    mock_logger.info.assert_any_call("> - None -")

def test_print_execution_times_empty(logger_instance, mock_logger):
    logger_instance.config = OrchestratorConfig(**{'LOG_EXECUTION_TIMES': True})
    Logger.set_logger(mock_logger)
    logger_instance.print_execution_times({})
    mock_logger.info.assert_any_call("> - None -")

def test_not_print_execution_times_empty(logger_instance, mock_logger):
    logger_instance.config = OrchestratorConfig(**{'LOG_EXECUTION_TIMES': False})
    Logger.set_logger(mock_logger)
    logger_instance.print_execution_times({})
    assert mock_logger.info.call_count == 0